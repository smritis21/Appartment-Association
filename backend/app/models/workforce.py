"""
SQLAlchemy models for the Workforce Management module (BE-26).

House help and providers are two separate directories: house help are
individuals booked for recurring domestic slots (maid, cook, driver), while
providers are external contractors engaged per job (AC repair, pest
control). HouseHelpRating references booking_id rather than house_help_id,
since a resident may only rate a completed booking, not the person in
general.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, Integer, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    """Current UTC time, naive, with microsecond precision."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── House help directory ─────────────────────────────────────────────────────

class HouseHelp(Base):
    __tablename__ = "house_help"

    house_help_id = Column(String, primary_key=True, default=_uuid)
    name           = Column(String(100), nullable=False)
    # e.g. "maid", "cook", "driver", "gardener"
    service_type   = Column(String(50), nullable=False)
    phone          = Column(String(15), nullable=True)
    is_active      = Column(String(5), nullable=False, default="true")  # "true" / "false"

    created_at = Column(DateTime, nullable=False, default=_utcnow)


class HouseHelpBooking(Base):
    __tablename__ = "house_help_bookings"

    booking_id    = Column(String, primary_key=True, default=_uuid)
    house_help_id = Column(String, ForeignKey("house_help.house_help_id"), nullable=False)
    resident_id   = Column(String, ForeignKey("residents.resident_id"), nullable=False)

    booking_date  = Column(Date, nullable=False)
    start_time    = Column(Time, nullable=False)
    end_time      = Column(Time, nullable=False)
    # ENUM values: booked / completed / cancelled
    status        = Column(String(20), nullable=False, default="booked")
    notes         = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    house_help = relationship("HouseHelp", backref="bookings")
    resident   = relationship("Resident", backref="house_help_bookings")

    __table_args__ = (
        Index("ix_house_help_bookings_help_date", "house_help_id", "booking_date"),
    )


class HouseHelpAttendance(Base):
    __tablename__ = "house_help_attendance"

    attendance_id   = Column(String, primary_key=True, default=_uuid)
    house_help_id   = Column(String, ForeignKey("house_help.house_help_id"), nullable=False)
    booking_id      = Column(String, ForeignKey("house_help_bookings.booking_id"), nullable=True)

    attendance_date = Column(Date, nullable=False)
    # ENUM values: present / absent
    status          = Column(String(20), nullable=False)
    notes           = Column(Text, nullable=True)

    marked_at = Column(DateTime, nullable=False, default=_utcnow)

    house_help = relationship("HouseHelp", backref="attendance_records")
    booking    = relationship("HouseHelpBooking")

    __table_args__ = (
        UniqueConstraint("house_help_id", "attendance_date", name="uq_house_help_attendance_help_date"),
    )


class HouseHelpRating(Base):
    __tablename__ = "house_help_ratings"

    rating_id     = Column(String, primary_key=True, default=_uuid)
    house_help_id = Column(String, ForeignKey("house_help.house_help_id"), nullable=False)
    resident_id   = Column(String, ForeignKey("residents.resident_id"), nullable=False)
    booking_id    = Column(String, ForeignKey("house_help_bookings.booking_id"), nullable=False, unique=True)

    rating  = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)

    rated_at = Column(DateTime, nullable=False, default=_utcnow)

    house_help = relationship("HouseHelp", backref="ratings")
    booking    = relationship("HouseHelpBooking", backref="rating")


# ── External service providers ───────────────────────────────────────────────

class Provider(Base):
    __tablename__ = "providers"

    provider_id  = Column(String, primary_key=True, default=_uuid)
    name          = Column(String(100), nullable=False)
    # e.g. "AC Repair", "Pest Control", "Plumbing Contractor"
    service_type  = Column(String(50), nullable=False)
    phone         = Column(String(15), nullable=True)

    created_at = Column(DateTime, nullable=False, default=_utcnow)


class ProviderJob(Base):
    __tablename__ = "provider_jobs"

    job_id       = Column(String, primary_key=True, default=_uuid)
    provider_id  = Column(String, ForeignKey("providers.provider_id"), nullable=False)

    title        = Column(String(150), nullable=False)
    description  = Column(Text, nullable=True)
    # ENUM values: requested / assigned / in_progress / completed / cancelled
    status       = Column(String(20), nullable=False, default="requested")
    requested_by = Column(String, nullable=True)  # resident_id, optional

    requested_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at   = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)
    completed_at = Column(DateTime, nullable=True)

    provider = relationship("Provider", backref="jobs")

    __table_args__ = (
        Index("ix_provider_jobs_provider_status", "provider_id", "status"),
    )
