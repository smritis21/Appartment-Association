"""CRUD operations for the Workforce Management module (BE-26)."""

from datetime import date

from sqlalchemy.orm import Session

from app.models.workforce import (
    HouseHelp,
    HouseHelpAttendance,
    HouseHelpBooking,
    HouseHelpRating,
    Provider,
    ProviderJob,
)
from app.schemas.workforce import (
    HouseHelpAttendanceCreate,
    HouseHelpBookingCreate,
    HouseHelpCreate,
    HouseHelpRatingCreate,
    ProviderCreate,
    ProviderJobCreate,
)


# ── House help directory ─────────────────────────────────────────────────────

def get_house_help(db: Session, house_help_id: str) -> HouseHelp | None:
    return db.query(HouseHelp).filter(HouseHelp.house_help_id == house_help_id).first()


def create_house_help(db: Session, data: HouseHelpCreate) -> HouseHelp:
    house_help = HouseHelp(**data.model_dump())
    db.add(house_help)
    return house_help


def list_house_help(
    db: Session, service_type: str | None = None, active_only: bool = False
) -> list[HouseHelp]:
    query = db.query(HouseHelp)
    if service_type:
        query = query.filter(HouseHelp.service_type == service_type)
    if active_only:
        query = query.filter(HouseHelp.is_active == "true")
    return query.order_by(HouseHelp.name).all()


# ── Bookings ──────────────────────────────────────────────────────────────────

def get_booking(db: Session, booking_id: str) -> HouseHelpBooking | None:
    return db.query(HouseHelpBooking).filter(HouseHelpBooking.booking_id == booking_id).first()


def get_bookings_for_help_on_date(db: Session, house_help_id: str, booking_date: date) -> list[HouseHelpBooking]:
    return (
        db.query(HouseHelpBooking)
        .filter(
            HouseHelpBooking.house_help_id == house_help_id,
            HouseHelpBooking.booking_date == booking_date,
            HouseHelpBooking.status != "cancelled",
        )
        .all()
    )


def create_booking(db: Session, data: HouseHelpBookingCreate) -> HouseHelpBooking:
    booking = HouseHelpBooking(**data.model_dump())
    db.add(booking)
    return booking


def list_bookings(
    db: Session,
    house_help_id: str | None = None,
    resident_id: str | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[HouseHelpBooking]:
    query = db.query(HouseHelpBooking)
    if house_help_id:
        query = query.filter(HouseHelpBooking.house_help_id == house_help_id)
    if resident_id:
        query = query.filter(HouseHelpBooking.resident_id == resident_id)
    if status:
        query = query.filter(HouseHelpBooking.status == status)
    return (
        query.order_by(HouseHelpBooking.booking_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ── Attendance ────────────────────────────────────────────────────────────────

def get_attendance_for_help_on_date(
    db: Session, house_help_id: str, attendance_date: date
) -> HouseHelpAttendance | None:
    return (
        db.query(HouseHelpAttendance)
        .filter(
            HouseHelpAttendance.house_help_id == house_help_id,
            HouseHelpAttendance.attendance_date == attendance_date,
        )
        .first()
    )


def create_attendance(db: Session, data: HouseHelpAttendanceCreate) -> HouseHelpAttendance:
    attendance = HouseHelpAttendance(**data.model_dump())
    db.add(attendance)
    return attendance


def list_attendance(
    db: Session,
    house_help_id: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[HouseHelpAttendance]:
    query = db.query(HouseHelpAttendance)
    if house_help_id:
        query = query.filter(HouseHelpAttendance.house_help_id == house_help_id)
    if date_from:
        query = query.filter(HouseHelpAttendance.attendance_date >= date_from)
    if date_to:
        query = query.filter(HouseHelpAttendance.attendance_date <= date_to)
    return (
        query.order_by(HouseHelpAttendance.attendance_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


# ── Ratings ───────────────────────────────────────────────────────────────────

def get_rating_for_booking(db: Session, booking_id: str) -> HouseHelpRating | None:
    return db.query(HouseHelpRating).filter(HouseHelpRating.booking_id == booking_id).first()


def create_rating(db: Session, house_help_id: str, data: HouseHelpRatingCreate) -> HouseHelpRating:
    rating = HouseHelpRating(house_help_id=house_help_id, **data.model_dump())
    db.add(rating)
    return rating


def list_ratings(db: Session, house_help_id: str) -> list[HouseHelpRating]:
    return (
        db.query(HouseHelpRating)
        .filter(HouseHelpRating.house_help_id == house_help_id)
        .order_by(HouseHelpRating.rated_at.desc())
        .all()
    )


# ── Providers ─────────────────────────────────────────────────────────────────

def get_provider(db: Session, provider_id: str) -> Provider | None:
    return db.query(Provider).filter(Provider.provider_id == provider_id).first()


def create_provider(db: Session, data: ProviderCreate) -> Provider:
    provider = Provider(**data.model_dump())
    db.add(provider)
    return provider


def list_providers(db: Session, service_type: str | None = None) -> list[Provider]:
    query = db.query(Provider)
    if service_type:
        query = query.filter(Provider.service_type == service_type)
    return query.order_by(Provider.name).all()


# ── Provider jobs ─────────────────────────────────────────────────────────────

def get_job(db: Session, job_id: str) -> ProviderJob | None:
    return db.query(ProviderJob).filter(ProviderJob.job_id == job_id).first()


def create_job(db: Session, data: ProviderJobCreate) -> ProviderJob:
    job = ProviderJob(**data.model_dump())
    db.add(job)
    return job


def list_jobs(
    db: Session,
    provider_id: str | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[ProviderJob]:
    query = db.query(ProviderJob)
    if provider_id:
        query = query.filter(ProviderJob.provider_id == provider_id)
    if status:
        query = query.filter(ProviderJob.status == status)
    return (
        query.order_by(ProviderJob.requested_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
