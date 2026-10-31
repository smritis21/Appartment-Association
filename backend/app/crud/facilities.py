"""CRUD operations for the Community Facilities booking module (BE-32)."""

from datetime import date

from sqlalchemy.orm import Session

from app.models.facility import Facility, FacilityBooking
from app.schemas.facility import FacilityBookingCreate, FacilityCreate


# ── Facilities ────────────────────────────────────────────────────────────────

def get_facility(db: Session, facility_id: str) -> Facility | None:
    return db.query(Facility).filter(Facility.facility_id == facility_id).first()


def list_facilities(db: Session, status: str | None = None) -> list[Facility]:
    query = db.query(Facility)
    if status:
        query = query.filter(Facility.status == status)
    return query.order_by(Facility.name.asc()).all()


def create_facility(db: Session, data: FacilityCreate) -> Facility:
    facility = Facility(**data.model_dump())
    db.add(facility)
    return facility


# ── Bookings ──────────────────────────────────────────────────────────────────

def get_booking(db: Session, booking_id: str) -> FacilityBooking | None:
    return (
        db.query(FacilityBooking)
        .filter(FacilityBooking.booking_id == booking_id)
        .first()
    )


def count_confirmed_for_slot(
    db: Session, facility_id: str, booking_date: date, slot: str
) -> int:
    """How many confirmed bookings currently hold this facility+date+slot."""
    return (
        db.query(FacilityBooking)
        .filter(
            FacilityBooking.facility_id == facility_id,
            FacilityBooking.booking_date == booking_date,
            FacilityBooking.slot == slot,
            FacilityBooking.status == "confirmed",
        )
        .count()
    )


def get_resident_confirmed_booking(
    db: Session, facility_id: str, resident_id: str, booking_date: date, slot: str
) -> FacilityBooking | None:
    """
    A resident's own confirmed booking for this facility+date+slot, if any -
    used to reject a duplicate. Only confirmed rows count, so a resident may
    re-book a slot they previously cancelled.
    """
    return (
        db.query(FacilityBooking)
        .filter(
            FacilityBooking.facility_id == facility_id,
            FacilityBooking.resident_id == resident_id,
            FacilityBooking.booking_date == booking_date,
            FacilityBooking.slot == slot,
            FacilityBooking.status == "confirmed",
        )
        .first()
    )


def list_confirmed_bookings_for_date(
    db: Session, facility_id: str, booking_date: date
) -> list[FacilityBooking]:
    """All confirmed bookings for a facility on a date (feeds availability)."""
    return (
        db.query(FacilityBooking)
        .filter(
            FacilityBooking.facility_id == facility_id,
            FacilityBooking.booking_date == booking_date,
            FacilityBooking.status == "confirmed",
        )
        .all()
    )


def list_bookings(
    db: Session,
    facility_id: str,
    resident_id: str | None = None,
    booking_date: date | None = None,
    status: str | None = None,
) -> list[FacilityBooking]:
    query = db.query(FacilityBooking).filter(
        FacilityBooking.facility_id == facility_id
    )
    if resident_id:
        query = query.filter(FacilityBooking.resident_id == resident_id)
    if booking_date:
        query = query.filter(FacilityBooking.booking_date == booking_date)
    if status:
        query = query.filter(FacilityBooking.status == status)
    return query.order_by(
        FacilityBooking.booking_date.asc(), FacilityBooking.slot.asc()
    ).all()


def create_booking(
    db: Session, facility_id: str, data: FacilityBookingCreate
) -> FacilityBooking:
    booking = FacilityBooking(
        facility_id=facility_id,
        resident_id=data.resident_id,
        booking_date=data.booking_date,
        slot=data.slot,
    )
    db.add(booking)
    return booking


def cancel_booking(db: Session, booking: FacilityBooking) -> FacilityBooking:
    booking.status = "cancelled"
    db.add(booking)
    return booking
