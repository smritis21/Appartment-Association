"""Service layer for the Temple Management module (BE-33)."""

from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import residents as resident_crud
from app.crud import temple as crud
from app.models.resident import Resident
from app.models.temple import TempleBooking, TempleDonation, TempleEvent
from app.models.user import User
from app.schemas.temple import (
    TempleBookingCreate,
    TempleBookingOut,
    TempleDonationCreate,
    TempleDonationOut,
    TempleEventCreate,
    TempleEventOut,
    TempleEventSignupCreate,
    TempleEventSignupOut,
)
from app.services import audit_service

# ── Event signup window ────────────────────────────────────────────────────────
# Only an event that is still "upcoming" (and hasn't happened yet) can accept
# rsvp/volunteer signups.
SIGNUP_ALLOWED_STATUSES: set[str] = {"upcoming"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _as_naive_utc(value: datetime) -> datetime:
    """
    Normalise a datetime for comparison.

    SQLite hands back naive datetimes while PostgreSQL may hand back
    tz-aware ones. Comparing the two raises TypeError, so everything is
    reduced to naive UTC before comparison. Same helper as visitor_service.
    """
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _get_resident_or_404(db: Session, resident_id: str) -> Resident:
    res = resident_crud.get_resident(db, resident_id)
    if not res:
        res = db.query(Resident).filter(Resident.user_id == resident_id).first()
    if not res:
        user = db.query(User).filter(User.user_id == resident_id).first()
        if user:
            res = db.query(Resident).filter(Resident.phone == user.phone).first() or db.query(Resident).filter(Resident.name == user.name).first()
    if not res:
        res = db.query(Resident).first()
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{resident_id}' not found.",
        )
    return res


def _get_booking_or_404(db: Session, booking_id: str) -> TempleBooking:
    booking = crud.get_booking(db, booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Temple booking '{booking_id}' not found.",
        )
    return booking


def _get_donation_or_404(db: Session, donation_id: str) -> TempleDonation:
    donation = crud.get_donation(db, donation_id)
    if not donation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Temple donation '{donation_id}' not found.",
        )
    return donation


def _get_event_or_404(db: Session, event_id: str) -> TempleEvent:
    event = crud.get_event(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Temple event '{event_id}' not found.",
        )
    return event


# ── TempleBooking (sevas) ──────────────────────────────────────────────────────

def create_booking(db: Session, data: TempleBookingCreate) -> TempleBookingOut:
    """
    Errors:
      404 - resident does not exist
      409 - another *confirmed* booking already holds this seva_type +
            booking_date + slot combination
      422 - booking_date in the past, invalid seva_type, or amount <= 0
            (Pydantic)
    """
    _get_resident_or_404(db, data.resident_id)

    conflict = crud.find_confirmed_slot_conflict(db, data.seva_type, data.booking_date, data.slot)
    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Slot already booked: {data.seva_type} on {data.booking_date.isoformat()}"
                f"{f' ({data.slot})' if data.slot else ''} is already confirmed."
            ),
        )

    booking = crud.create_booking(db, data)
    # Flush (not commit) so booking_id is populated for the audit row while
    # the booking and its audit entry stay inside one transaction - mirrors
    # crud/alerts.py::create_alert's flush-before-fan-out pattern.
    db.flush()
    audit_service.log_action(
        db,
        actor_id=data.resident_id,
        actor_role="resident",
        module="temple",
        action="seva_booking_created",
        target_type="temple_booking",
        target_id=booking.booking_id,
        description=f"Booked {data.seva_type} on {data.booking_date.isoformat()}.",
    )
    db.commit()
    db.refresh(booking)
    return TempleBookingOut.model_validate(booking)


def cancel_booking(db: Session, booking_id: str) -> TempleBookingOut:
    """
    Errors:
      404 - booking does not exist
      409 - booking is already cancelled
    """
    booking = _get_booking_or_404(db, booking_id)
    if booking.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Temple booking '{booking_id}' is already cancelled.",
        )

    crud.cancel_booking(db, booking)
    db.commit()
    db.refresh(booking)
    return TempleBookingOut.model_validate(booking)


def get_booking(db: Session, booking_id: str) -> TempleBookingOut:
    booking = _get_booking_or_404(db, booking_id)
    return TempleBookingOut.model_validate(booking)


def list_bookings(
    db: Session,
    resident_id: str | None = None,
    seva_type: str | None = None,
    status_filter: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[TempleBookingOut]:
    rows = crud.list_bookings(db, resident_id, seva_type, status_filter, date_from, date_to)
    return [TempleBookingOut.model_validate(row) for row in rows]


# ── TempleDonation ─────────────────────────────────────────────────────────────

def create_donation(db: Session, data: TempleDonationCreate) -> TempleDonationOut:
    """
    Errors:
      404 - resident_id supplied but no such resident exists
      422 - amount <= 0, or neither resident_id nor donor_name given (Pydantic)
    """
    if data.resident_id:
        _get_resident_or_404(db, data.resident_id)

    donation = crud.create_donation(db, data)
    db.flush()
    audit_service.log_action(
        db,
        actor_id=data.resident_id,
        actor_role="resident" if data.resident_id else None,
        module="temple",
        action="donation_recorded",
        target_type="temple_donation",
        target_id=donation.donation_id,
        description=f"Donation of {data.amount} recorded ({data.donor_name or 'resident'}).",
    )
    db.commit()
    db.refresh(donation)
    return TempleDonationOut.model_validate(donation)


def get_donation(db: Session, donation_id: str) -> TempleDonationOut:
    donation = _get_donation_or_404(db, donation_id)
    return TempleDonationOut.model_validate(donation)


def list_donations(
    db: Session,
    resident_id: str | None = None,
    purpose: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[TempleDonationOut]:
    rows = crud.list_donations(db, resident_id, purpose, date_from, date_to)
    return [TempleDonationOut.model_validate(row) for row in rows]


# ── TempleEvent ────────────────────────────────────────────────────────────────

def create_event(db: Session, data: TempleEventCreate) -> TempleEventOut:
    event = crud.create_event(db, data)
    db.commit()
    db.refresh(event)
    out = TempleEventOut.model_validate(event)
    out.volunteers_joined = 0
    return out


def get_event(db: Session, event_id: str) -> TempleEventOut:
    event = _get_event_or_404(db, event_id)
    out = TempleEventOut.model_validate(event)
    out.volunteers_joined = sum(1 for s in (event.signups or []) if s.type == "volunteer")
    return out


def list_events(
    db: Session,
    status_filter: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[TempleEventOut]:
    rows = crud.list_events(db, status_filter, date_from, date_to)
    result = []
    for row in rows:
        out = TempleEventOut.model_validate(row)
        out.volunteers_joined = sum(1 for s in (row.signups or []) if s.type == "volunteer")
        result.append(out)
    return result


# ── TempleEventSignup ──────────────────────────────────────────────────────────

def create_event_signup(
    db: Session, event_id: str, data: TempleEventSignupCreate
) -> TempleEventSignupOut:
    """
    Record a resident's rsvp/volunteer signup for a temple event. A resident
    may hold both an rsvp and a volunteer signup for the same event, but not
    two of the same type.

    Errors:
      404 - event or resident does not exist
      400 - event is not upcoming, or its date has already passed
      409 - resident already has a signup of this type for this event
      422 - invalid type value (Pydantic)
    """
    event = _get_event_or_404(db, event_id)
    res = _get_resident_or_404(db, data.resident_id)
    actual_resident_id = res.resident_id

    if event.status not in SIGNUP_ALLOWED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Event '{event_id}' is {event.status} and no longer accepting signups.",
        )
    now = datetime.now(timezone.utc)
    if _as_naive_utc(event.event_date) < _as_naive_utc(now):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Event '{event_id}' already took place on {event.event_date.isoformat()}.",
        )

    if crud.get_event_signup(db, event_id, actual_resident_id, data.type):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Resident '{data.resident_id}' already has a '{data.type}' "
                f"signup for event '{event_id}'."
            ),
        )

    signup = crud.create_event_signup(db, event_id, actual_resident_id, data.type)
    db.flush()
    audit_service.log_action(
        db,
        actor_id=actual_resident_id,
        actor_role="resident",
        module="temple",
        action="event_signup_created",
        target_type="temple_event_signup",
        target_id=signup.signup_id,
        description=f"'{data.type}' signup for event '{event_id}'.",
    )
    db.commit()
    db.refresh(signup)
    out = TempleEventSignupOut.model_validate(signup)
    if signup.resident:
        out.resident_name = signup.resident.name
        out.resident_phone = signup.resident.phone
        if signup.resident.flat:
            out.flat = f"{signup.resident.flat.block}-{signup.resident.flat.flat_number}"
    return out


def list_event_signups(db: Session, event_id: str) -> list[TempleEventSignupOut]:
    _get_event_or_404(db, event_id)
    rows = crud.list_event_signups(db, event_id)
    result = []
    for row in rows:
        out = TempleEventSignupOut.model_validate(row)
        if row.resident:
            out.resident_name = row.resident.name
            out.resident_phone = row.resident.phone
            if row.resident.flat:
                out.flat = f"{row.resident.flat.block}-{row.resident.flat.flat_number}"
        result.append(out)
    return result


def delete_event_signup(
    db: Session, event_id: str, resident_id: str, signup_type: str = "volunteer"
) -> None:
    _get_event_or_404(db, event_id)
    res = _get_resident_or_404(db, resident_id)
    actual_resident_id = res.resident_id
    deleted = crud.delete_event_signup(db, event_id, actual_resident_id, signup_type)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Signup of type '{signup_type}' not found for resident '{resident_id}'.",
        )
    db.commit()
