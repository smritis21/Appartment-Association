"""CRUD operations for the Temple Management module (BE-33)."""

from datetime import date, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.temple import TempleBooking, TempleDonation, TempleEvent, TempleEventSignup
from app.schemas.temple import TempleBookingCreate, TempleDonationCreate, TempleEventCreate

# ── TempleBooking (sevas) ──────────────────────────────────────────────────────

def get_booking(db: Session, booking_id: str) -> TempleBooking | None:
    return db.query(TempleBooking).filter(TempleBooking.booking_id == booking_id).first()


def list_bookings(
    db: Session,
    resident_id: str | None = None,
    seva_type: str | None = None,
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[TempleBooking]:
    query = db.query(TempleBooking)
    if resident_id:
        query = query.filter(TempleBooking.resident_id == resident_id)
    if seva_type:
        query = query.filter(TempleBooking.seva_type == seva_type)
    if status:
        query = query.filter(TempleBooking.status == status)
    if date_from:
        query = query.filter(TempleBooking.booking_date >= date_from)
    if date_to:
        query = query.filter(TempleBooking.booking_date <= date_to)
    return query.order_by(TempleBooking.booking_date.asc()).all()


def find_confirmed_slot_conflict(
    db: Session, seva_type: str, booking_date: date, slot: str | None
) -> TempleBooking | None:
    """
    A slot conflict only exists among *confirmed* bookings - see the module
    docstring for why this isn't a plain DB UniqueConstraint.
    """
    return (
        db.query(TempleBooking)
        .filter(
            TempleBooking.seva_type == seva_type,
            TempleBooking.booking_date == booking_date,
            TempleBooking.slot == slot,
            TempleBooking.status == "confirmed",
        )
        .first()
    )


def create_booking(db: Session, data: TempleBookingCreate) -> TempleBooking:
    booking = TempleBooking(**data.model_dump())
    db.add(booking)
    return booking


def cancel_booking(db: Session, booking: TempleBooking) -> TempleBooking:
    booking.status = "cancelled"
    db.add(booking)
    return booking


# ── TempleDonation ─────────────────────────────────────────────────────────────

def get_donation(db: Session, donation_id: str) -> TempleDonation | None:
    return db.query(TempleDonation).filter(TempleDonation.donation_id == donation_id).first()


def list_donations(
    db: Session,
    resident_id: str | None = None,
    purpose: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[TempleDonation]:
    query = db.query(TempleDonation)
    if resident_id:
        query = query.filter(TempleDonation.resident_id == resident_id)
    if purpose:
        query = query.filter(TempleDonation.purpose == purpose)
    if date_from:
        query = query.filter(TempleDonation.donated_at >= date_from)
    if date_to:
        query = query.filter(TempleDonation.donated_at <= date_to)
    return query.order_by(TempleDonation.donated_at.desc()).all()


def create_donation(db: Session, data: TempleDonationCreate) -> TempleDonation:
    donation = TempleDonation(**data.model_dump())
    db.add(donation)
    return donation


# ── TempleEvent ────────────────────────────────────────────────────────────────

def get_event(db: Session, event_id: str) -> TempleEvent | None:
    return db.query(TempleEvent).filter(TempleEvent.event_id == event_id).first()


def list_events(
    db: Session,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[TempleEvent]:
    query = db.query(TempleEvent)
    if status:
        query = query.filter(TempleEvent.status == status)
    if date_from:
        query = query.filter(TempleEvent.event_date >= date_from)
    if date_to:
        query = query.filter(TempleEvent.event_date <= date_to)
    return query.order_by(TempleEvent.event_date.asc()).all()


def create_event(db: Session, data: TempleEventCreate) -> TempleEvent:
    event = TempleEvent(**data.model_dump())
    db.add(event)
    return event


# ── TempleEventSignup ──────────────────────────────────────────────────────────

def get_event_signup(
    db: Session, event_id: str, resident_id: str, signup_type: str
) -> TempleEventSignup | None:
    return (
        db.query(TempleEventSignup)
        .filter(
            TempleEventSignup.event_id == event_id,
            TempleEventSignup.resident_id == resident_id,
            TempleEventSignup.type == signup_type,
        )
        .first()
    )


def list_event_signups(db: Session, event_id: str) -> list[TempleEventSignup]:
    return (
        db.query(TempleEventSignup)
        .filter(TempleEventSignup.event_id == event_id)
        .order_by(TempleEventSignup.signed_up_at.asc())
        .all()
    )


def create_event_signup(
    db: Session, event_id: str, resident_id: str, signup_type: str
) -> TempleEventSignup:
    signup = TempleEventSignup(event_id=event_id, resident_id=resident_id, type=signup_type)
    db.add(signup)
    return signup


def delete_event_signup(
    db: Session, event_id: str, resident_id: str, signup_type: str
) -> bool:
    signup = get_event_signup(db, event_id, resident_id, signup_type)
    if signup:
        db.delete(signup)
        return True
    return False


# ── Report aggregates (BE-36) ───────────────────────────────────────────────────

def get_booking_report(db: Session, date_from: date, date_to: date) -> dict:
    q = db.query(TempleBooking).filter(
        TempleBooking.booking_date >= date_from, TempleBooking.booking_date <= date_to
    )
    total = q.with_entities(func.count(TempleBooking.booking_id)).scalar()
    by_seva_type = (
        q.with_entities(TempleBooking.seva_type, func.count(TempleBooking.booking_id))
        .group_by(TempleBooking.seva_type)
        .all()
    )
    residents = [r[0] for r in q.with_entities(TempleBooking.resident_id).distinct().all()]
    return {"total": total, "by_seva_type": by_seva_type, "residents": residents}


def get_donation_report(db: Session, date_from: datetime, date_to: datetime) -> dict:
    q = db.query(TempleDonation).filter(
        TempleDonation.donated_at >= date_from, TempleDonation.donated_at <= date_to
    )
    count = q.with_entities(func.count(TempleDonation.donation_id)).scalar()
    total = q.with_entities(func.coalesce(func.sum(TempleDonation.amount), 0)).scalar()
    residents = [
        r[0]
        for r in q.filter(TempleDonation.resident_id.isnot(None))
        .with_entities(TempleDonation.resident_id)
        .distinct()
        .all()
    ]
    return {"count": count, "total": total, "residents": residents}


def get_event_signup_report(db: Session, date_from: datetime, date_to: datetime) -> dict:
    q = db.query(TempleEventSignup).filter(
        TempleEventSignup.signed_up_at >= date_from, TempleEventSignup.signed_up_at <= date_to
    )
    total = q.with_entities(func.count(TempleEventSignup.signup_id)).scalar()
    volunteer_count = (
        q.filter(TempleEventSignup.type == "volunteer")
        .with_entities(func.count(TempleEventSignup.signup_id))
        .scalar()
    )
    residents = [r[0] for r in q.with_entities(TempleEventSignup.resident_id).distinct().all()]
    return {"total": total, "volunteer_count": volunteer_count, "residents": residents}
