"""
SQLAlchemy models for the Community Hub Events module (BE-31).

capacity limits RSVPs only, not volunteers: it represents attendee seats,
and volunteers run the event rather than occupy one, so a full RSVP list
never blocks a volunteer signup. UniqueConstraint(event_id, resident_id,
type) lets a resident both RSVP and volunteer for the same event, but blocks
a duplicate of either.
"""

import uuid

from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base

# Maximum gallery image references allowed per event (mirrors schemas/event.py).
MAX_GALLERY_IMAGES = 10


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


# ── Event ─────────────────────────────────────────────────────────────────────

class Event(Base):
    __tablename__ = "events"

    event_id     = Column(String, primary_key=True, default=_uuid)
    title        = Column(String(200), nullable=False)
    description  = Column(Text, nullable=True)
    event_date   = Column(DateTime, nullable=False)
    venue        = Column(String(100), nullable=True)
    # NULL = unlimited RSVPs. Counts RSVPs only, not volunteers.
    capacity     = Column(Integer, nullable=True)
    # No FK to users - none of the community modules depend on one yet.
    created_by   = Column(String, nullable=True)
    # ENUM values: upcoming / ongoing / completed / cancelled
    status       = Column(String(20), nullable=False, default="upcoming")

    # JSON list of image-reference strings; length <= MAX_GALLERY_IMAGES and
    # each entry's format is enforced in the Pydantic schema, not here.
    gallery      = Column(JSON, nullable=False, default=list)

    created_at   = Column(DateTime, nullable=False, default=func.now())
    updated_at   = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    registrations = relationship(
        "EventRegistration", back_populates="event", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_events_status", "status"),
        Index("ix_events_event_date", "event_date"),
    )


# ── EventRegistration ─────────────────────────────────────────────────────────

class EventRegistration(Base):
    __tablename__ = "event_registrations"

    registration_id = Column(String, primary_key=True, default=_uuid)
    event_id        = Column(String, ForeignKey("events.event_id"), nullable=False)
    resident_id     = Column(String, ForeignKey("residents.resident_id"), nullable=False)

    # ENUM values: rsvp / volunteer - a resident may do both for one event
    type            = Column(String(10), nullable=False)
    registered_at   = Column(DateTime, nullable=False, default=func.now())

    event    = relationship("Event", back_populates="registrations")
    resident = relationship("Resident", backref="event_registrations")

    __table_args__ = (
        UniqueConstraint("event_id", "resident_id", "type", name="uq_event_registration"),
        Index("ix_event_registrations_event_id", "event_id"),
        Index("ix_event_registrations_resident_id", "resident_id"),
        Index("ix_event_registrations_type", "type"),
    )
