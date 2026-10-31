"""Service layer for the Community Facilities booking module (BE-32)."""

from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import facilities as crud
from app.crud import residents as resident_crud
from app.models.facility import Facility
from app.schemas.facility import (
    TIME_SLOTS,
    FacilityAvailabilityOut,
    FacilityBookingCreate,
    FacilityBookingOut,
    FacilityCreate,
    FacilityOut,
    SlotAvailability,
)
from app.services import audit_service, notification_service


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_facility_or_404(db: Session, facility_id: str) -> Facility:
    facility = crud.get_facility(db, facility_id)
    if not facility:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility '{facility_id}' not found.",
        )
    return facility


def _get_resident_or_404(db: Session, resident_id: str) -> None:
    if not resident_crud.get_resident(db, resident_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{resident_id}' not found.",
        )


# ── Facilities ────────────────────────────────────────────────────────────────

def list_facilities(db: Session, status_filter: str | None = None) -> list[FacilityOut]:
    rows = crud.list_facilities(db, status_filter)
    return [FacilityOut.model_validate(row) for row in rows]


def get_facility(db: Session, facility_id: str) -> FacilityOut:
    facility = _get_facility_or_404(db, facility_id)
    return FacilityOut.model_validate(facility)


def create_facility(db: Session, data: FacilityCreate) -> FacilityOut:
    facility = crud.create_facility(db, data)
    db.flush()
    audit_service.log_action(
        db,
        actor_id=None,
        actor_role="admin",
        module="facilities",
        action="facility_created",
        target_type="facility",
        target_id=facility.facility_id,
        description=f"Facility '{facility.name}' created.",
    )
    db.commit()
    db.refresh(facility)
    return FacilityOut.model_validate(facility)


# ── Availability ──────────────────────────────────────────────────────────────

def get_availability(
    db: Session, facility_id: str, booking_date: date
) -> FacilityAvailabilityOut:
    """
    Return the slot grid for a facility on a date: every fixed band with its
    state (available / booked / past), how many confirmed bookings it holds and
    how many spots remain. `past` uses server time and only applies to today -
    it mirrors the frontend getSlotState logic so both ends agree.
    """
    facility = _get_facility_or_404(db, facility_id)

    confirmed = crud.list_confirmed_bookings_for_date(db, facility_id, booking_date)
    taken_by_slot: dict[str, int] = {}
    for booking in confirmed:
        taken_by_slot[booking.slot] = taken_by_slot.get(booking.slot, 0) + 1

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    today = now.date()
    now_hours = now.hour + now.minute / 60

    slots: list[SlotAvailability] = []
    for band in TIME_SLOTS:
        taken = taken_by_slot.get(band["time"], 0)
        spots_remaining = max(facility.capacity - taken, 0)

        is_past = booking_date < today or (
            booking_date == today and band["end"] <= now_hours
        )
        if is_past:
            state = "past"
        elif taken >= facility.capacity:
            state = "booked"
        else:
            state = "available"

        slots.append(
            SlotAvailability(
                slot=band["time"],
                state=state,
                booked=taken,
                spots_remaining=spots_remaining,
            )
        )

    return FacilityAvailabilityOut(
        facility_id=facility_id,
        booking_date=booking_date,
        capacity=facility.capacity,
        slots=slots,
    )


# ── Bookings ──────────────────────────────────────────────────────────────────

def create_booking(
    db: Session, facility_id: str, data: FacilityBookingCreate
) -> FacilityBookingOut:
    """
    Reserve a facility slot for a resident.

    Errors:
      404 - facility or resident does not exist
      400 - facility is inactive
      409 - resident already holds a confirmed booking for this slot
      409 - the slot is full (confirmed bookings have reached capacity)
      422 - unknown slot or a past booking_date (Pydantic)
    """
    facility = _get_facility_or_404(db, facility_id)
    _get_resident_or_404(db, data.resident_id)

    if facility.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Facility '{facility_id}' is {facility.status} and is not "
                "accepting bookings."
            ),
        )

    # Duplicate: the same resident cannot hold two confirmed bookings for one
    # slot. Checked before capacity so a repeat booker gets the clearer message.
    if crud.get_resident_confirmed_booking(
        db, facility_id, data.resident_id, data.booking_date, data.slot
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Resident '{data.resident_id}' already has a confirmed booking "
                f"for {data.slot} on {data.booking_date.isoformat()}."
            ),
        )

    # Capacity / slot conflict: reject once confirmed bookings reach capacity.
    taken = crud.count_confirmed_for_slot(
        db, facility_id, data.booking_date, data.slot
    )
    if taken >= facility.capacity:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Slot {data.slot} on {data.booking_date.isoformat()} is full "
                f"for '{facility.name}' (capacity {facility.capacity})."
            ),
        )

    booking = crud.create_booking(db, facility_id, data)
    # Flush (not commit) so booking_id is populated for the audit row while the
    # booking and its audit entry stay inside one transaction - mirrors
    # temple_service.create_booking's flush-before-audit pattern.
    db.flush()
    audit_service.log_action(
        db,
        actor_id=data.resident_id,
        actor_role="resident",
        module="facilities",
        action="facility_booking_created",
        target_type="facility_booking",
        target_id=booking.booking_id,
        description=(
            f"Booked {facility.name} slot {data.slot} on "
            f"{data.booking_date.isoformat()}."
        ),
    )
    notification_service.notify_resident(
        db,
        data.resident_id,
        title="Booking confirmed",
        message=(
            f"Your booking for {facility.name}, slot {data.slot} on "
            f"{data.booking_date.isoformat()}, is confirmed."
        ),
        notification_type="booking_confirmed",
        source_module="facilities",
        source_event_id=booking.booking_id,
    )
    db.commit()
    db.refresh(booking)
    return FacilityBookingOut.model_validate(booking)


def cancel_booking(db: Session, booking_id: str) -> FacilityBookingOut:
    """
    Cancel a confirmed booking, freeing its slot for re-booking.

    Errors:
      404 - booking does not exist
      409 - booking is already cancelled
    """
    booking = crud.get_booking(db, booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility booking '{booking_id}' not found.",
        )
    if booking.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Facility booking '{booking_id}' is already cancelled.",
        )

    crud.cancel_booking(db, booking)
    db.flush()
    audit_service.log_action(
        db,
        actor_id=booking.resident_id,
        actor_role="resident",
        module="facilities",
        action="facility_booking_cancelled",
        target_type="facility_booking",
        target_id=booking.booking_id,
        description=(
            f"Cancelled booking for slot {booking.slot} on "
            f"{booking.booking_date.isoformat()}."
        ),
    )
    db.commit()
    db.refresh(booking)
    return FacilityBookingOut.model_validate(booking)


def get_booking(db: Session, booking_id: str) -> FacilityBookingOut:
    booking = crud.get_booking(db, booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Facility booking '{booking_id}' not found.",
        )
    return FacilityBookingOut.model_validate(booking)


def list_bookings(
    db: Session,
    facility_id: str,
    resident_id: str | None = None,
    booking_date: date | None = None,
    status_filter: str | None = None,
) -> list[FacilityBookingOut]:
    _get_facility_or_404(db, facility_id)
    rows = crud.list_bookings(
        db, facility_id, resident_id, booking_date, status_filter
    )
    return [FacilityBookingOut.model_validate(row) for row in rows]
