"""Service layer for the Community Hub Events module (BE-31)."""

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import announcements as announcement_crud
from app.crud import events as crud
from app.crud import residents as resident_crud
from app.models.event import Event
from app.schemas.announcement import AnnouncementCreate
from app.schemas.event import (
    EventCreate,
    EventOut,
    EventRegistrationCreate,
    EventRegistrationOut,
)
from app.services import audit_service

# ── Window rules ──────────────────────────────────────────────────────────────
# A registration can only be recorded against an event that hasn't finished or
# been called off yet. Unlike the community module, gating is purely by status:
# `event_date` is a timestamp and an `ongoing` event legitimately has a
# start time in the past, so a past-date guard would wrongly reject it.
CLOSED_STATUSES: set[str] = {"completed", "cancelled"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_event_or_404(db: Session, event_id: str) -> Event:
    event = crud.get_event(db, event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event '{event_id}' not found.",
        )
    return event


def _to_out(db: Session, event: Event) -> EventOut:
    """
    Attach the derived rsvp_count/volunteer_count/spots_remaining fields. These
    are never stored on the row (see model docstring), so every read recomputes
    them. spots_remaining tracks RSVPs only, since capacity caps attendees.
    """
    rsvp_count = crud.count_registrations(db, event.event_id, type="rsvp")
    volunteer_count = crud.count_registrations(db, event.event_id, type="volunteer")
    spots_remaining = (
        None if event.capacity is None else max(event.capacity - rsvp_count, 0)
    )
    return EventOut(
        event_id=event.event_id,
        title=event.title,
        description=event.description,
        event_date=event.event_date,
        venue=event.venue,
        capacity=event.capacity,
        gallery=event.gallery or [],
        created_by=event.created_by,
        status=event.status,
        rsvp_count=rsvp_count,
        volunteer_count=volunteer_count,
        spots_remaining=spots_remaining,
        created_at=event.created_at,
        updated_at=event.updated_at,
    )


# ── Events ────────────────────────────────────────────────────────────────────

def list_events(
    db: Session,
    status_filter: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[EventOut]:
    rows = crud.list_events(db, status_filter, date_from, date_to)
    return [_to_out(db, row) for row in rows]


def get_event(db: Session, event_id: str) -> EventOut:
    event = _get_event_or_404(db, event_id)
    return _to_out(db, event)


def create_event(db: Session, data: EventCreate) -> EventOut:
    event = crud.create_event(db, data)
    db.flush()
    audit_service.log_action(
        db,
        actor_id=data.created_by,
        actor_role="resident",
        module="events",
        action="event_created",
        target_type="event",
        target_id=event.event_id,
        description=f"Event '{event.title}' created.",
    )

    if data.notify_as_announcement:
        # Also publish a matching announcement so residents who only check
        # the announcements feed still hear about the event. Reuses
        # crud.announcements.create_announcement, whose own field defaults
        # (status="published", visibility="public") publish it immediately,
        # same as any announcement created through POST /announcements.
        #
        # create_announcement() commits internally. The event insert and
        # the audit row above are still pending on this session at that
        # point, so that commit is what lands all three together - if it
        # raises instead, the event and audit row roll back with it rather
        # than leaving an event with no announcement.
        venue_note = f" at {event.venue}" if event.venue else ""
        announcement_crud.create_announcement(
            db,
            AnnouncementCreate(
                title=event.title,
                body=(
                    f"New event: '{event.title}' on "
                    f"{event.event_date.strftime('%d %b %Y, %I:%M %p')}"
                    f"{venue_note}."
                ),
                author=data.created_by,
                category="Event",
            ),
        )

    db.commit()
    db.refresh(event)
    return _to_out(db, event)


# ── Registrations ─────────────────────────────────────────────────────────────

def create_registration(
    db: Session, event_id: str, data: EventRegistrationCreate
) -> EventRegistrationOut:
    """
    Record a resident's RSVP or volunteer registration for an event.

    Errors:
      404 - event or resident does not exist
      400 - event is completed/cancelled
      400 - RSVP rejected because the event is at capacity (volunteers exempt)
      409 - resident has already registered with this type for this event
    """
    event = _get_event_or_404(db, event_id)

    if not resident_crud.get_resident(db, data.resident_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{data.resident_id}' not found.",
        )

    if event.status in CLOSED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Event '{event_id}' is {event.status} and no longer "
                "accepting registrations."
            ),
        )

    if crud.get_registration(db, event_id, data.resident_id, data.type):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Resident '{data.resident_id}' has already registered as "
                f"'{data.type}' for this event."
            ),
        )

    # Capacity caps RSVPs only - volunteers help run the event and never take
    # an attendee seat, so they are exempt from the capacity check.
    if data.type == "rsvp" and event.capacity is not None:
        current = crud.count_registrations(db, event_id, type="rsvp")
        if current >= event.capacity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Event '{event_id}' is at capacity ({event.capacity}).",
            )

    registration = crud.create_registration(db, event_id, data.resident_id, data.type)
    # Flush (not commit) so registration_id is populated for the audit row
    # while the registration and its audit entry stay in one transaction -
    # mirrors community_service.create_signup's flush-before-audit pattern.
    db.flush()
    audit_service.log_action(
        db,
        actor_id=data.resident_id,
        actor_role="resident",
        module="events",
        action="event_registration_created",
        target_type="event_registration",
        target_id=registration.registration_id,
        description=f"{data.type} registration for event '{event_id}'.",
    )
    db.commit()
    db.refresh(registration)
    return EventRegistrationOut.model_validate(registration)


def list_registrations(
    db: Session, event_id: str, type: str | None = None
) -> list[EventRegistrationOut]:
    _get_event_or_404(db, event_id)
    rows = crud.list_registrations(db, event_id, type)
    return [EventRegistrationOut.model_validate(row) for row in rows]


def cancel_registration(
    db: Session, event_id: str, resident_id: str, type: str
) -> None:
    """
    Cancel (delete) a resident's existing RSVP or volunteer registration.

    rsvp_count/volunteer_count are never stored - _to_out derives them with a
    live COUNT query (see that function's docstring) - so deleting the
    registration row is all that's needed to "decrement" them; there is no
    denormalised counter to update in step.

    Errors:
      404 - event does not exist
      404 - resident has no registration of this type for this event
    """
    _get_event_or_404(db, event_id)

    registration = crud.get_registration(db, event_id, resident_id, type)
    if not registration:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"Resident '{resident_id}' has no '{type}' registration for "
                f"event '{event_id}' to cancel."
            ),
        )

    registration_id = registration.registration_id
    crud.delete_registration(db, registration)
    # Flush (not commit) so the delete and its audit entry stay in one
    # transaction - mirrors create_registration's flush-before-audit pattern.
    db.flush()
    audit_service.log_action(
        db,
        actor_id=resident_id,
        actor_role="resident",
        module="events",
        action="event_registration_cancelled",
        target_type="event_registration",
        target_id=registration_id,
        description=f"{type} registration cancelled for event '{event_id}'.",
    )
    db.commit()
