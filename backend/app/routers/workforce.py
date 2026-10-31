"""
FastAPI router for the Workforce Management module (BE-26).

/house-help/bookings and /house-help/attendance are literal paths declared
before /house-help/{id}/ratings so they are not swallowed by the path
parameter.
"""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.workforce import (
    HouseHelpAttendanceCreate,
    HouseHelpAttendanceOut,
    HouseHelpBookingCreate,
    HouseHelpBookingOut,
    HouseHelpBookingStatusUpdate,
    HouseHelpCreate,
    HouseHelpOut,
    HouseHelpRatingCreate,
    HouseHelpRatingOut,
    ProviderCreate,
    ProviderJobCreate,
    ProviderJobOut,
    ProviderJobStatusUpdate,
    ProviderOut,
)
from app.services import workforce_service as service

router = APIRouter(prefix="/workforce", tags=["Workforce"])


# ── House help directory ─────────────────────────────────────────────────────

@router.post(
    "/house-help",
    response_model=HouseHelpOut,
    status_code=201,
    summary="Register a house help",
    description="Adds a house help to the bookable directory.",
)
def create_house_help(data: HouseHelpCreate, db: Session = Depends(get_db)):
    return service.create_house_help(db, data)


@router.get(
    "/house-help",
    response_model=list[HouseHelpOut],
    summary="List house help",
    description="Returns house help, optionally filtered by service type and/or active status.",
)
def list_house_help(
    service_type: str | None = Query(None, description="e.g. maid, cook, driver, gardener"),
    active_only: bool = Query(False, description="Only return active house help"),
    db: Session = Depends(get_db),
):
    return service.list_house_help(db, service_type=service_type, active_only=active_only)


# ── Bookings ──────────────────────────────────────────────────────────────────

@router.post(
    "/house-help/bookings",
    response_model=HouseHelpBookingOut,
    status_code=201,
    summary="Book house help",
    description=(
        "Books a house help for a time slot. Rejects a slot that overlaps an "
        "existing non-cancelled booking for the same house help on the same day."
    ),
    responses={
        201: {"description": "Booking created"},
        404: {"description": "House help or resident not found"},
        409: {"description": "Slot overlaps an existing booking for this house help"},
        422: {"description": "Validation error - end_time not after start_time"},
    },
)
def book_house_help(data: HouseHelpBookingCreate, db: Session = Depends(get_db)):
    return service.book_house_help(db, data)


@router.put(
    "/house-help/bookings/{booking_id}/status",
    response_model=HouseHelpBookingOut,
    summary="Update a booking's status",
    description="Transitions a booking to 'completed' or 'cancelled'. A resolved booking cannot be reopened.",
    responses={
        200: {"description": "Booking status updated"},
        400: {"description": "Transition not allowed from the booking's current status"},
        404: {"description": "Booking not found"},
    },
)
def update_booking_status(booking_id: str, data: HouseHelpBookingStatusUpdate, db: Session = Depends(get_db)):
    return service.update_booking_status(db, booking_id, data.status)


@router.get(
    "/house-help/bookings",
    response_model=list[HouseHelpBookingOut],
    summary="Booking history",
    description="Returns bookings newest-first, optionally filtered by house help, resident and/or status.",
)
def list_bookings(
    house_help_id: str | None = Query(None),
    resident_id: str | None = Query(None),
    status: str | None = Query(None, description="booked / completed / cancelled"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return service.list_bookings(
        db, house_help_id=house_help_id, resident_id=resident_id, status_filter=status, skip=skip, limit=limit
    )


# ── Attendance ────────────────────────────────────────────────────────────────

@router.post(
    "/house-help/attendance",
    response_model=HouseHelpAttendanceOut,
    status_code=201,
    summary="Log house help attendance",
    description=(
        "Records a house help's attendance for a single day. Exactly one "
        "attendance record is allowed per house help per date."
    ),
    responses={
        201: {"description": "Attendance recorded"},
        400: {"description": "booking_id does not belong to this house help"},
        404: {"description": "House help or booking not found"},
        409: {"description": "Attendance already recorded for this house help on this date"},
    },
)
def mark_attendance(data: HouseHelpAttendanceCreate, db: Session = Depends(get_db)):
    return service.mark_attendance(db, data)


@router.get(
    "/house-help/attendance",
    response_model=list[HouseHelpAttendanceOut],
    summary="Attendance history",
    description="Returns attendance records newest-first, optionally filtered by house help and/or date range.",
)
def list_attendance(
    house_help_id: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return service.list_attendance(
        db, house_help_id=house_help_id, date_from=date_from, date_to=date_to, skip=skip, limit=limit
    )


# ── Ratings ───────────────────────────────────────────────────────────────────

@router.post(
    "/house-help/ratings",
    response_model=HouseHelpRatingOut,
    status_code=201,
    summary="Rate a completed booking",
    description=(
        "Records a resident's rating of a house help booking. Only the "
        "resident who made the booking may rate it, and only after the "
        "booking has been marked 'completed'. One rating per booking."
    ),
    responses={
        201: {"description": "Rating recorded"},
        400: {"description": "Booking is not completed, or resident_id does not match the booking"},
        404: {"description": "Booking not found"},
        409: {"description": "This booking has already been rated"},
        422: {"description": "Validation error - rating outside 1-5"},
    },
)
def rate_booking(data: HouseHelpRatingCreate, db: Session = Depends(get_db)):
    return service.rate_booking(db, data)


@router.get(
    "/house-help/{house_help_id}/ratings",
    response_model=list[HouseHelpRatingOut],
    summary="A house help's ratings",
    description="Returns all ratings recorded for a house help, newest first.",
    responses={404: {"description": "House help not found"}},
)
def list_ratings(house_help_id: str, db: Session = Depends(get_db)):
    return service.list_ratings(db, house_help_id)


# ── Providers ─────────────────────────────────────────────────────────────────

@router.post(
    "/providers",
    response_model=ProviderOut,
    status_code=201,
    summary="Register a provider",
    description="Adds an external service provider (contractor) to the directory.",
)
def create_provider(data: ProviderCreate, db: Session = Depends(get_db)):
    return service.create_provider(db, data)


@router.get(
    "/providers",
    response_model=list[ProviderOut],
    summary="List providers",
    description="Returns providers, optionally filtered by service type.",
)
def list_providers(
    service_type: str | None = Query(None, description="e.g. AC Repair, Pest Control"),
    db: Session = Depends(get_db),
):
    return service.list_providers(db, service_type=service_type)


# ── Provider jobs ─────────────────────────────────────────────────────────────

@router.post(
    "/provider-jobs",
    response_model=ProviderJobOut,
    status_code=201,
    summary="Request a provider job",
    description="Raises a new job against a provider, created in the 'requested' state.",
    responses={
        201: {"description": "Job created"},
        404: {"description": "Provider not found"},
    },
)
def create_job(data: ProviderJobCreate, db: Session = Depends(get_db)):
    return service.create_job(db, data)


@router.put(
    "/provider-jobs/{job_id}/status",
    response_model=ProviderJobOut,
    summary="Transition a provider job's status",
    description=(
        "Advances a job through `requested -> assigned -> in_progress -> completed`. "
        "Cancellation is allowed from any non-terminal state. `completed_at` is stamped "
        "when the job reaches 'completed'."
    ),
    responses={
        200: {"description": "Job status updated"},
        400: {"description": "Transition not allowed from the job's current status"},
        404: {"description": "Job not found"},
        422: {"description": "Validation error - status not one of the allowed values"},
    },
)
def update_job_status(job_id: str, data: ProviderJobStatusUpdate, db: Session = Depends(get_db)):
    return service.update_job_status(db, job_id, data.status)


@router.get(
    "/provider-jobs",
    response_model=list[ProviderJobOut],
    summary="Provider job history",
    description="Returns provider jobs newest-first, optionally filtered by provider and/or status.",
)
def list_jobs(
    provider_id: str | None = Query(None),
    status: str | None = Query(None, description="requested / assigned / in_progress / completed / cancelled"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return service.list_jobs(db, provider_id=provider_id, status_filter=status, skip=skip, limit=limit)
