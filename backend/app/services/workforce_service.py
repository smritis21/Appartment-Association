"""Service layer for the Workforce Management module (BE-26)."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import residents as resident_crud
from app.crud import workforce as crud
from app.schemas.workforce import (
    HouseHelpAttendanceCreate,
    HouseHelpAttendanceOut,
    HouseHelpBookingCreate,
    HouseHelpBookingOut,
    HouseHelpCreate,
    HouseHelpOut,
    HouseHelpRatingCreate,
    HouseHelpRatingOut,
    ProviderCreate,
    ProviderJobCreate,
    ProviderJobOut,
    ProviderOut,
)

# Booking status: booked -> completed / cancelled. Terminal once resolved -
# no reopening, matching the read-only-history intent of "book house help".
BOOKING_TRANSITIONS: dict[str, set[str]] = {
    "booked": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}

# A job moves forward one stage at a time; cancellation is allowed from any
# non-terminal state. Mirrors complaint_service.ALLOWED_TRANSITIONS (BE-16).
JOB_TRANSITIONS: dict[str, set[str]] = {
    "requested": {"assigned", "cancelled"},
    "assigned": {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}


def _overlaps(a_start, a_end, b_start, b_end) -> bool:
    return a_start < b_end and b_start < a_end


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_house_help_or_404(db: Session, house_help_id: str):
    house_help = crud.get_house_help(db, house_help_id)
    if not house_help:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"House help '{house_help_id}' not found.",
        )
    return house_help


# ── House help directory ─────────────────────────────────────────────────────

def create_house_help(db: Session, data: HouseHelpCreate) -> HouseHelpOut:
    house_help = crud.create_house_help(db, data)
    db.commit()
    db.refresh(house_help)
    return HouseHelpOut.model_validate(house_help)


def list_house_help(
    db: Session, service_type: str | None = None, active_only: bool = False
) -> list[HouseHelpOut]:
    rows = crud.list_house_help(db, service_type=service_type, active_only=active_only)
    return [HouseHelpOut.model_validate(row) for row in rows]


# ── Bookings ──────────────────────────────────────────────────────────────────

def book_house_help(db: Session, data: HouseHelpBookingCreate) -> HouseHelpBookingOut:
    """
    Book a house help for a time slot (BE-26).

    Errors:
      404 - house help or resident does not exist
      409 - the slot overlaps an existing (non-cancelled) booking for the
            same house help on the same day
      422 - end_time is not after start_time (Pydantic)
    """
    _get_house_help_or_404(db, data.house_help_id)
    if not resident_crud.get_resident(db, data.resident_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{data.resident_id}' not found.",
        )

    existing = crud.get_bookings_for_help_on_date(db, data.house_help_id, data.booking_date)
    for other in existing:
        if _overlaps(data.start_time, data.end_time, other.start_time, other.end_time):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"House help '{data.house_help_id}' is already booked "
                    f"{other.start_time}-{other.end_time} on {data.booking_date}."
                ),
            )

    booking = crud.create_booking(db, data)
    db.commit()
    db.refresh(booking)
    return HouseHelpBookingOut.model_validate(booking)


def update_booking_status(db: Session, booking_id: str, new_status: str) -> HouseHelpBookingOut:
    booking = crud.get_booking(db, booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking '{booking_id}' not found.",
        )
    allowed = BOOKING_TRANSITIONS.get(booking.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition booking from '{booking.status}' to '{new_status}'.",
        )
    booking.status = new_status
    db.commit()
    db.refresh(booking)
    return HouseHelpBookingOut.model_validate(booking)


def list_bookings(
    db: Session,
    house_help_id: str | None = None,
    resident_id: str | None = None,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[HouseHelpBookingOut]:
    rows = crud.list_bookings(
        db, house_help_id=house_help_id, resident_id=resident_id, status=status_filter, skip=skip, limit=limit
    )
    return [HouseHelpBookingOut.model_validate(row) for row in rows]


# ── Attendance ────────────────────────────────────────────────────────────────

def mark_attendance(db: Session, data: HouseHelpAttendanceCreate) -> HouseHelpAttendanceOut:
    """
    Record a house help's attendance for a single day (BE-26).

    Errors:
      404 - house help does not exist, or booking_id does not exist
      400 - booking_id belongs to a different house help
      409 - attendance already recorded for this house help on this date
    """
    _get_house_help_or_404(db, data.house_help_id)

    if data.booking_id:
        booking = crud.get_booking(db, data.booking_id)
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Booking '{data.booking_id}' not found.",
            )
        if booking.house_help_id != data.house_help_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Booking '{data.booking_id}' does not belong to house help '{data.house_help_id}'.",
            )

    if crud.get_attendance_for_help_on_date(db, data.house_help_id, data.attendance_date):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Attendance for house help '{data.house_help_id}' on "
                f"{data.attendance_date} has already been recorded."
            ),
        )

    attendance = crud.create_attendance(db, data)
    db.commit()
    db.refresh(attendance)
    return HouseHelpAttendanceOut.model_validate(attendance)


def list_attendance(
    db: Session,
    house_help_id: str | None = None,
    date_from=None,
    date_to=None,
    skip: int = 0,
    limit: int = 100,
) -> list[HouseHelpAttendanceOut]:
    rows = crud.list_attendance(
        db, house_help_id=house_help_id, date_from=date_from, date_to=date_to, skip=skip, limit=limit
    )
    return [HouseHelpAttendanceOut.model_validate(row) for row in rows]


# ── Ratings ───────────────────────────────────────────────────────────────────

def rate_booking(db: Session, data: HouseHelpRatingCreate) -> HouseHelpRatingOut:
    """
    Rate a completed booking (BE-26).

    Errors:
      404 - booking does not exist
      400 - the booking has not been completed yet, or the resident rating
            it is not the resident who made the booking
      409 - this booking has already been rated (one rating per booking)
      422 - rating is outside 1-5 (Pydantic)
    """
    booking = crud.get_booking(db, data.booking_id)
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Booking '{data.booking_id}' not found.",
        )
    if booking.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Booking '{data.booking_id}' is '{booking.status}'; only completed bookings can be rated.",
        )
    if booking.resident_id != data.resident_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only the resident who made this booking may rate it.",
        )
    if crud.get_rating_for_booking(db, data.booking_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Booking '{data.booking_id}' has already been rated.",
        )

    rating = crud.create_rating(db, booking.house_help_id, data)
    db.commit()
    db.refresh(rating)
    return HouseHelpRatingOut.model_validate(rating)


def list_ratings(db: Session, house_help_id: str) -> list[HouseHelpRatingOut]:
    _get_house_help_or_404(db, house_help_id)
    rows = crud.list_ratings(db, house_help_id)
    return [HouseHelpRatingOut.model_validate(row) for row in rows]


# ── Providers ─────────────────────────────────────────────────────────────────

def create_provider(db: Session, data: ProviderCreate) -> ProviderOut:
    provider = crud.create_provider(db, data)
    db.commit()
    db.refresh(provider)
    return ProviderOut.model_validate(provider)


def list_providers(db: Session, service_type: str | None = None) -> list[ProviderOut]:
    rows = crud.list_providers(db, service_type=service_type)
    return [ProviderOut.model_validate(row) for row in rows]


# ── Provider jobs ─────────────────────────────────────────────────────────────

def create_job(db: Session, data: ProviderJobCreate) -> ProviderJobOut:
    provider = crud.get_provider(db, data.provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider '{data.provider_id}' not found.",
        )
    job = crud.create_job(db, data)
    db.commit()
    db.refresh(job)
    return ProviderJobOut.model_validate(job)


def update_job_status(db: Session, job_id: str, new_status: str) -> ProviderJobOut:
    """
    Transition a provider job's status (BE-26).

    Errors:
      404 - job does not exist
      400 - the transition is not allowed from the job's current status
    """
    job = crud.get_job(db, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider job '{job_id}' not found.",
        )
    allowed = JOB_TRANSITIONS.get(job.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot transition provider job from '{job.status}' to '{new_status}'.",
        )
    job.status = new_status
    if new_status == "completed":
        job.completed_at = _utcnow()
    db.commit()
    db.refresh(job)
    return ProviderJobOut.model_validate(job)


def list_jobs(
    db: Session,
    provider_id: str | None = None,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[ProviderJobOut]:
    rows = crud.list_jobs(db, provider_id=provider_id, status=status_filter, skip=skip, limit=limit)
    return [ProviderJobOut.model_validate(row) for row in rows]
