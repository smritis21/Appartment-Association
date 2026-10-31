"""FastAPI router for the Community Hub Events module (BE-31)."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.event import (
    EventCreate,
    EventOut,
    EventRegistrationCreate,
    EventRegistrationOut,
    EventStatus,
    RegistrationType,
)
from app.services import event_service as service

router = APIRouter(prefix="/events", tags=["Events"])


@router.post(
    "",
    response_model=EventOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a community event",
    description=(
        "Creates a community event. `capacity` caps RSVP seats (null means "
        "unlimited); `gallery` accepts image references (http(s) URL or "
        "root-relative path), validated on the way in."
    ),
    responses={
        201: {"description": "Event created"},
        422: {"description": "Validation error - bad gallery reference or field"},
    },
)
def create_event(data: EventCreate, db: Session = Depends(get_db)):
    return service.create_event(db, data)


@router.get(
    "",
    response_model=list[EventOut],
    summary="List community events",
    description=(
        "Returns events soonest-first, each with derived rsvp_count, "
        "volunteer_count and spots_remaining. Filter by status or a date window."
    ),
    responses={422: {"description": "Invalid status filter value"}},
)
def list_events(
    status_filter: EventStatus | None = Query(
        None, alias="status", description="upcoming / ongoing / completed / cancelled"
    ),
    date_from: datetime | None = Query(None, description="Only events on/after this time"),
    date_to: datetime | None = Query(None, description="Only events on/before this time"),
    db: Session = Depends(get_db),
):
    return service.list_events(db, status_filter, date_from, date_to)


@router.get(
    "/{event_id}",
    response_model=EventOut,
    summary="Get a community event",
    responses={404: {"description": "Event not found"}},
)
def get_event(event_id: str, db: Session = Depends(get_db)):
    return service.get_event(db, event_id)


@router.post(
    "/{event_id}/register",
    response_model=EventRegistrationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register (RSVP or volunteer) for an event",
    description=(
        "Records a resident's RSVP or volunteer registration. RSVPs are "
        "rejected once the event is at capacity; volunteers are never "
        "capacity-blocked. Rejected if the event is completed/cancelled or the "
        "resident has already registered with the same type."
    ),
    responses={
        201: {"description": "Registration recorded"},
        400: {"description": "Event closed, or RSVP rejected because at capacity"},
        404: {"description": "Event or resident not found"},
        409: {"description": "Resident already registered with this type"},
        422: {"description": "Validation error"},
    },
)
def register_for_event(
    event_id: str, data: EventRegistrationCreate, db: Session = Depends(get_db)
):
    return service.create_registration(db, event_id, data)


@router.delete(
    "/{event_id}/register",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel an RSVP or volunteer registration",
    description=(
        "Cancels a resident's existing RSVP or volunteer registration for an "
        "event. This is the counterpart to POST /{event_id}/register - use it "
        "for 'Cancel RSVP' / 'Cancel Volunteering', never a duplicate POST, "
        "which the register endpoint correctly rejects as a 409."
    ),
    responses={
        204: {"description": "Registration cancelled"},
        404: {"description": "Event not found, or resident has no such registration"},
    },
)
def cancel_registration(
    event_id: str,
    resident_id: str = Query(..., description="Resident whose registration to cancel"),
    type: RegistrationType = Query(..., description="rsvp / volunteer"),
    db: Session = Depends(get_db),
):
    service.cancel_registration(db, event_id, resident_id, type)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{event_id}/registrations",
    response_model=list[EventRegistrationOut],
    summary="List registrations for an event",
    description="Returns RSVPs and volunteers for an event. Filter by type.",
    responses={404: {"description": "Event not found"}},
)
def list_registrations(
    event_id: str,
    type: RegistrationType | None = Query(None, description="rsvp / volunteer"),
    db: Session = Depends(get_db),
):
    return service.list_registrations(db, event_id, type)
