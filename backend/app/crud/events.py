"""CRUD operations for the Community Hub Events module (BE-31)."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.event import Event, EventRegistration
from app.schemas.event import EventCreate


def get_event(db: Session, event_id: str) -> Event | None:
    return db.query(Event).filter(Event.event_id == event_id).first()


def list_events(
    db: Session,
    status: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> list[Event]:
    query = db.query(Event)
    if status:
        query = query.filter(Event.status == status)
    if date_from:
        query = query.filter(Event.event_date >= date_from)
    if date_to:
        query = query.filter(Event.event_date <= date_to)
    return query.order_by(Event.event_date.asc()).all()


def create_event(db: Session, data: EventCreate) -> Event:
    # notify_as_announcement is a request-only flag consumed by
    # event_service.create_event() - it isn't a column on Event.
    event = Event(**data.model_dump(exclude={"notify_as_announcement"}))
    db.add(event)
    return event


def count_registrations(db: Session, event_id: str, type: str | None = None) -> int:
    query = db.query(EventRegistration).filter(EventRegistration.event_id == event_id)
    if type:
        query = query.filter(EventRegistration.type == type)
    return query.count()


def get_registration(
    db: Session, event_id: str, resident_id: str, type: str
) -> EventRegistration | None:
    return (
        db.query(EventRegistration)
        .filter(
            EventRegistration.event_id == event_id,
            EventRegistration.resident_id == resident_id,
            EventRegistration.type == type,
        )
        .first()
    )


def list_registrations(
    db: Session, event_id: str, type: str | None = None
) -> list[EventRegistration]:
    query = db.query(EventRegistration).filter(EventRegistration.event_id == event_id)
    if type:
        query = query.filter(EventRegistration.type == type)
    return query.order_by(EventRegistration.registered_at.asc()).all()


def create_registration(
    db: Session, event_id: str, resident_id: str, type: str
) -> EventRegistration:
    registration = EventRegistration(
        event_id=event_id, resident_id=resident_id, type=type
    )
    db.add(registration)
    return registration


def delete_registration(db: Session, registration: EventRegistration) -> None:
    db.delete(registration)
