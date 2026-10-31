"""FastAPI router for the Temple Management module (BE-33)."""

from datetime import date, datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.temple import (
    BookingStatus,
    DonationPurpose,
    EventStatus,
    SevaType,
    TempleBookingCreate,
    TempleBookingOut,
    TempleDonationCreate,
    TempleDonationOut,
    TempleEventCreate,
    TempleEventOut,
    TempleEventSignupCreate,
    TempleEventSignupOut,
)
from app.services import temple_service as service

router = APIRouter(prefix="/temple", tags=["Temple"])


# ── Sevas ─────────────────────────────────────────────────────────────────────

@router.post(
    "/sevas",
    response_model=TempleBookingOut,
    status_code=status.HTTP_201_CREATED,
    summary="Book a seva/pooja slot",
    description=(
        "Books a seva (monthly pooja, abhishekam, archana, sandhana kaapu) "
        "against a date and slot. Rejected if another confirmed booking "
        "already holds the same seva_type + booking_date + slot."
    ),
    responses={
        201: {"description": "Booking confirmed"},
        404: {"description": "Resident not found"},
        409: {"description": "Slot already confirmed by another booking"},
        422: {"description": "Validation error"},
    },
)
def book_seva(data: TempleBookingCreate, db: Session = Depends(get_db)):
    return service.create_booking(db, data)


@router.get(
    "/sevas",
    response_model=list[TempleBookingOut],
    summary="List seva bookings",
    description="Returns seva bookings soonest-first, optionally filtered.",
)
def list_sevas(
    resident_id: str | None = Query(None, description="Only bookings for this resident"),
    seva_type: SevaType | None = Query(None),
    status_filter: BookingStatus | None = Query(None, alias="status"),
    date_from: date | None = Query(None, description="Only bookings on/after this date"),
    date_to: date | None = Query(None, description="Only bookings on/before this date"),
    db: Session = Depends(get_db),
):
    return service.list_bookings(db, resident_id, seva_type, status_filter, date_from, date_to)


@router.get(
    "/sevas/{booking_id}",
    response_model=TempleBookingOut,
    summary="Get a seva booking",
    responses={404: {"description": "Booking not found"}},
)
def get_seva(booking_id: str, db: Session = Depends(get_db)):
    return service.get_booking(db, booking_id)


@router.post(
    "/sevas/{booking_id}/cancel",
    response_model=TempleBookingOut,
    summary="Cancel a seva booking",
    description="Cancels a confirmed booking, freeing its slot for re-booking.",
    responses={
        200: {"description": "Booking cancelled"},
        404: {"description": "Booking not found"},
        409: {"description": "Booking is already cancelled"},
    },
)
def cancel_seva(booking_id: str, db: Session = Depends(get_db)):
    return service.cancel_booking(db, booking_id)


# ── Donations ─────────────────────────────────────────────────────────────────

@router.post(
    "/donations",
    response_model=TempleDonationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Record a donation",
    description=(
        "Records a donation. Either resident_id or donor_name must be "
        "provided (anonymous/non-resident donors supply donor_name only)."
    ),
    responses={
        201: {"description": "Donation recorded"},
        404: {"description": "resident_id supplied but not found"},
        422: {"description": "Validation error"},
    },
)
def record_donation(data: TempleDonationCreate, db: Session = Depends(get_db)):
    return service.create_donation(db, data)


@router.get(
    "/donations",
    response_model=list[TempleDonationOut],
    summary="List donations",
    description="Returns donations newest-first, optionally filtered.",
)
def list_donations(
    resident_id: str | None = Query(None, description="Only donations from this resident"),
    purpose: DonationPurpose | None = Query(None),
    date_from: date | None = Query(None, description="Only donations on/after this date"),
    date_to: date | None = Query(None, description="Only donations on/before this date"),
    db: Session = Depends(get_db),
):
    return service.list_donations(db, resident_id, purpose, date_from, date_to)


@router.get(
    "/donations/{donation_id}",
    response_model=TempleDonationOut,
    summary="Get a donation",
    responses={404: {"description": "Donation not found"}},
)
def get_donation(donation_id: str, db: Session = Depends(get_db)):
    return service.get_donation(db, donation_id)


# ── Events ────────────────────────────────────────────────────────────────────

@router.post(
    "/events",
    response_model=TempleEventOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a temple event",
    responses={
        201: {"description": "Event created"},
        422: {"description": "Validation error"},
    },
)
def create_event(data: TempleEventCreate, db: Session = Depends(get_db)):
    return service.create_event(db, data)


@router.get(
    "/events",
    response_model=list[TempleEventOut],
    summary="List temple events",
    description="Returns temple events soonest-first, optionally filtered.",
)
def list_events(
    status_filter: EventStatus | None = Query(None, alias="status"),
    date_from: datetime | None = Query(None, description="Only events on/after this timestamp"),
    date_to: datetime | None = Query(None, description="Only events on/before this timestamp"),
    db: Session = Depends(get_db),
):
    return service.list_events(db, status_filter, date_from, date_to)


@router.get(
    "/events/{event_id}",
    response_model=TempleEventOut,
    summary="Get a temple event",
    responses={404: {"description": "Event not found"}},
)
def get_event(event_id: str, db: Session = Depends(get_db)):
    return service.get_event(db, event_id)


@router.post(
    "/events/{event_id}/signup",
    response_model=TempleEventSignupOut,
    status_code=status.HTTP_201_CREATED,
    summary="Sign up for a temple event (rsvp or volunteer)",
    description=(
        "Records a resident's rsvp/volunteer signup for an event. A resident "
        "may hold both an rsvp and a volunteer signup for the same event, "
        "but not two of the same type. Rejected once the event is no longer "
        "upcoming or has already taken place."
    ),
    responses={
        201: {"description": "Signup recorded"},
        400: {"description": "Event closed or already occurred"},
        404: {"description": "Event or resident not found"},
        409: {"description": "Resident already has this type of signup for the event"},
        422: {"description": "Validation error"},
    },
)
def signup_for_event(
    event_id: str, data: TempleEventSignupCreate, db: Session = Depends(get_db)
):
    return service.create_event_signup(db, event_id, data)


@router.get(
    "/events/{event_id}/signups",
    response_model=list[TempleEventSignupOut],
    summary="List signups for a temple event",
    responses={404: {"description": "Event not found"}},
)
def list_event_signups(event_id: str, db: Session = Depends(get_db)):
    return service.list_event_signups(db, event_id)


@router.delete(
    "/events/{event_id}/signup",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Withdraw/remove a signup for a temple event",
)
def withdraw_event_signup(
    event_id: str,
    resident_id: str = Query(..., description="Resident ID"),
    type: str = Query("volunteer", description="rsvp or volunteer"),
    db: Session = Depends(get_db),
):
    service.delete_event_signup(db, event_id, resident_id, type)
