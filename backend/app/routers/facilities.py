"""FastAPI router for the Community Facilities booking module (BE-32)."""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.facility import (
    BookingStatus,
    FacilityAvailabilityOut,
    FacilityBookingCreate,
    FacilityBookingOut,
    FacilityCreate,
    FacilityOut,
    FacilityStatus,
)
from app.services import facility_service as service

router = APIRouter(prefix="/facilities", tags=["Facilities"])


@router.post(
    "",
    response_model=FacilityOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a bookable facility",
    description=(
        "Registers a shared amenity residents can reserve. `capacity` is how "
        "many confirmed bookings a single slot accepts in parallel (1 for a "
        "court, more for the gym/pool)."
    ),
    responses={
        201: {"description": "Facility created"},
        422: {"description": "Validation error"},
    },
)
def create_facility(data: FacilityCreate, db: Session = Depends(get_db)):
    return service.create_facility(db, data)


@router.get(
    "",
    response_model=list[FacilityOut],
    summary="List bookable facilities",
    description="Returns facilities alphabetically. Filter by status.",
    responses={422: {"description": "Invalid status filter value"}},
)
def list_facilities(
    status_filter: FacilityStatus | None = Query(
        None, alias="status", description="active / inactive"
    ),
    db: Session = Depends(get_db),
):
    return service.list_facilities(db, status_filter)


@router.get(
    "/{facility_id}",
    response_model=FacilityOut,
    summary="Get a facility",
    responses={404: {"description": "Facility not found"}},
)
def get_facility(facility_id: str, db: Session = Depends(get_db)):
    return service.get_facility(db, facility_id)


@router.get(
    "/{facility_id}/availability",
    response_model=FacilityAvailabilityOut,
    summary="Get slot availability for a facility on a date",
    description=(
        "Returns every fixed hourly band with its state (available / booked / "
        "past), the number of confirmed bookings it holds and the spots "
        "remaining. `date` defaults to today."
    ),
    responses={
        200: {"description": "Slot availability grid"},
        404: {"description": "Facility not found"},
    },
)
def get_availability(
    facility_id: str,
    booking_date: date | None = Query(
        None, alias="date", description="Date to check (defaults to today)"
    ),
    db: Session = Depends(get_db),
):
    from datetime import datetime, timezone

    target = booking_date or datetime.now(timezone.utc).replace(tzinfo=None).date()
    return service.get_availability(db, facility_id, target)


@router.post(
    "/{facility_id}/bookings",
    response_model=FacilityBookingOut,
    status_code=status.HTTP_201_CREATED,
    summary="Book a facility slot",
    description=(
        "Reserves a slot for a resident. Rejected if the facility is inactive, "
        "the resident already holds a confirmed booking for the slot, or the "
        "slot is already full (confirmed bookings have reached capacity)."
    ),
    responses={
        201: {"description": "Booking created"},
        400: {"description": "Facility inactive"},
        404: {"description": "Facility or resident not found"},
        409: {"description": "Slot full, or resident already booked this slot"},
        422: {"description": "Validation error - unknown slot or past date"},
    },
)
def book_slot(
    facility_id: str, data: FacilityBookingCreate, db: Session = Depends(get_db)
):
    return service.create_booking(db, facility_id, data)


@router.get(
    "/{facility_id}/bookings",
    response_model=list[FacilityBookingOut],
    summary="List bookings for a facility",
    description=(
        "Returns bookings for a facility, soonest-first. Filter by resident, "
        "date or status (e.g. status=confirmed for a resident's active bookings)."
    ),
    responses={404: {"description": "Facility not found"}},
)
def list_bookings(
    facility_id: str,
    resident_id: str | None = Query(None, description="Only this resident's bookings"),
    booking_date: date | None = Query(
        None, alias="date", description="Only bookings on this date"
    ),
    status_filter: BookingStatus | None = Query(
        None, alias="status", description="confirmed / cancelled"
    ),
    db: Session = Depends(get_db),
):
    return service.list_bookings(
        db, facility_id, resident_id, booking_date, status_filter
    )


@router.post(
    "/bookings/{booking_id}/cancel",
    response_model=FacilityBookingOut,
    summary="Cancel a facility booking",
    description="Cancels a confirmed booking, freeing its slot for re-booking.",
    responses={
        200: {"description": "Booking cancelled"},
        404: {"description": "Booking not found"},
        409: {"description": "Booking is already cancelled"},
    },
)
def cancel_booking(booking_id: str, db: Session = Depends(get_db)):
    return service.cancel_booking(db, booking_id)
