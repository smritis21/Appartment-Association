"""
SQLAlchemy models for the Community Facilities booking module (BE-32).

facility.capacity is always set (unlike Event.capacity, where NULL means
unlimited) - every facility caps how many confirmed bookings a slot accepts
in parallel. Slots are fixed hourly bands stored as their label string
(e.g. "06:00 - 07:00") rather than rows in a separate table, since the bands
are a fixed constant shared with the frontend. The "no more than `capacity`
confirmed bookings per slot" rule is enforced in the service layer rather
than a DB constraint, since a plain UniqueConstraint can't express "only
among confirmed rows" and would wrongly block re-booking after a
cancellation.
"""

import uuid

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


# ── Facility ──────────────────────────────────────────────────────────────────

class Facility(Base):
    __tablename__ = "facilities"

    facility_id = Column(String, primary_key=True, default=_uuid)
    name        = Column(String(100), nullable=False)
    location    = Column(String(100), nullable=True)
    # Confirmed bookings a single slot accepts in parallel (always set).
    capacity    = Column(Integer, nullable=False, default=1)
    description = Column(Text, nullable=True)
    # ENUM values: active / inactive - an inactive facility takes no bookings.
    status      = Column(String(20), nullable=False, default="active")

    created_at  = Column(DateTime, nullable=False, default=func.now())
    updated_at  = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    bookings = relationship(
        "FacilityBooking", back_populates="facility", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_facilities_status", "status"),
    )


# ── FacilityBooking ───────────────────────────────────────────────────────────

class FacilityBooking(Base):
    __tablename__ = "facility_bookings"

    booking_id   = Column(String, primary_key=True, default=_uuid)
    facility_id  = Column(String, ForeignKey("facilities.facility_id"), nullable=False)
    resident_id  = Column(String, ForeignKey("residents.resident_id"), nullable=False)

    booking_date = Column(Date, nullable=False)
    # Fixed hourly-band label (e.g. "06:00 - 07:00"); validated in the schema.
    slot         = Column(String(20), nullable=False)
    # ENUM values: confirmed / cancelled
    status       = Column(String(20), nullable=False, default="confirmed")

    created_at   = Column(DateTime, nullable=False, default=func.now())
    updated_at   = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    facility = relationship("Facility", back_populates="bookings")
    resident = relationship("Resident", backref="facility_bookings")

    __table_args__ = (
        Index("ix_facility_bookings_slot_lookup", "facility_id", "booking_date", "slot"),
        Index("ix_facility_bookings_resident_id", "resident_id"),
        Index("ix_facility_bookings_status", "status"),
    )
