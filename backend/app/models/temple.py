"""
SQLAlchemy models for the Temple Management module (BE-33).

The "no two confirmed bookings for the same seva_type+date+slot" rule is
enforced in the service layer rather than a DB constraint, since a plain
UniqueConstraint can't express "only among confirmed rows" and would wrongly
block re-booking a slot after a cancellation. temple_events/
temple_event_signups mirror the Community Hub events pattern (BE-31), whose
rsvp/volunteer split fits temple event/volunteer management directly.
"""

import uuid

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


# ── TempleBooking ─────────────────────────────────────────────────────────────

class TempleBooking(Base):
    __tablename__ = "temple_bookings"

    booking_id    = Column(String, primary_key=True, default=_uuid)
    resident_id   = Column(String, ForeignKey("residents.resident_id"), nullable=False)

    # ENUM values: monthly_pooja / abhishekam / archana / sandhana_kaapu
    seva_type     = Column(String(30), nullable=False)
    booking_date  = Column(Date, nullable=False)
    slot          = Column(String(20), nullable=True)
    amount        = Column(Numeric(10, 2), nullable=False)
    # ENUM values: confirmed / cancelled
    status        = Column(String(20), nullable=False, default="confirmed")

    created_at    = Column(DateTime, nullable=False, default=func.now())
    updated_at    = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    resident = relationship("Resident", backref="temple_bookings")

    __table_args__ = (
        Index("ix_temple_bookings_resident_id", "resident_id"),
        Index("ix_temple_bookings_slot_lookup", "seva_type", "booking_date", "slot"),
        Index("ix_temple_bookings_status", "status"),
    )


# ── TempleDonation ────────────────────────────────────────────────────────────

class TempleDonation(Base):
    __tablename__ = "temple_donations"

    donation_id   = Column(String, primary_key=True, default=_uuid)
    # Nullable - anonymous/non-resident donors are allowed (donor_name is
    # required instead; enforced in the Pydantic schema).
    resident_id   = Column(String, ForeignKey("residents.resident_id"), nullable=True)
    donor_name    = Column(String(100), nullable=True)

    # ENUM values: general / annadanam / festival / renovation / other
    purpose       = Column(String(30), nullable=True)
    amount        = Column(Numeric(10, 2), nullable=False)
    # ENUM values: cash / upi / online_transfer / cheque - mirrors Payment.payment_method
    payment_mode  = Column(String(20), nullable=True)
    receipt_no    = Column(String(50), unique=True, nullable=True)
    notes         = Column(Text, nullable=True)

    donated_at    = Column(DateTime, nullable=False, default=func.now())
    created_at    = Column(DateTime, nullable=False, default=func.now())
    updated_at    = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    resident = relationship("Resident", backref="temple_donations")

    __table_args__ = (
        Index("ix_temple_donations_resident_id", "resident_id"),
        Index("ix_temple_donations_donated_at", "donated_at"),
    )


# ── TempleEvent ───────────────────────────────────────────────────────────────

class TempleEvent(Base):
    __tablename__ = "temple_events"

    event_id           = Column(String, primary_key=True, default=_uuid)
    title               = Column(String(200), nullable=False)
    description         = Column(Text, nullable=True)
    event_date          = Column(DateTime, nullable=False)
    venue               = Column(String(100), nullable=True)
    # Informational only - unlike CommunityActivity.capacity, this is not
    # enforced against signups (BE-33's AC asks for "manage events/volunteers",
    # not capacity limits, unlike BE-34's explicit "capacity is validated").
    volunteers_needed   = Column(Integer, nullable=True)
    # ENUM values: upcoming / ongoing / completed / cancelled
    status              = Column(String(20), nullable=False, default="upcoming")

    created_at          = Column(DateTime, nullable=False, default=func.now())
    updated_at          = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    signups = relationship(
        "TempleEventSignup", back_populates="event", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_temple_events_status", "status"),
        Index("ix_temple_events_event_date", "event_date"),
    )


# ── TempleEventSignup ─────────────────────────────────────────────────────────

class TempleEventSignup(Base):
    __tablename__ = "temple_event_signups"

    signup_id     = Column(String, primary_key=True, default=_uuid)
    event_id      = Column(String, ForeignKey("temple_events.event_id"), nullable=False)
    resident_id   = Column(String, ForeignKey("residents.resident_id"), nullable=False)

    # ENUM values: rsvp / volunteer - a resident may do both for the same event
    type          = Column(String(10), nullable=False)
    signed_up_at  = Column(DateTime, nullable=False, default=func.now())

    event    = relationship("TempleEvent", back_populates="signups")
    resident = relationship("Resident", backref="temple_event_signups")

    __table_args__ = (
        UniqueConstraint("event_id", "resident_id", "type", name="uq_temple_event_signup"),
        Index("ix_temple_event_signups_event_id", "event_id"),
        Index("ix_temple_event_signups_resident_id", "resident_id"),
    )
