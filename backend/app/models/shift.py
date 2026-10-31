"""
SQLAlchemy models for the Staff Attendance & Shift module (BE-35).

Reuses the existing Staff table (app/models/complaint.py) rather than a
duplicate staff entity. One attendance row per (staff_id, attendance_date)
is enforced with a UNIQUE constraint, with a friendly 409 at the service
layer on a duplicate.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, ForeignKey, Index, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    """Current UTC time, naive, with microsecond precision."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class StaffShift(Base):
    __tablename__ = "staff_shifts"

    shift_id   = Column(String, primary_key=True, default=_uuid)
    staff_id   = Column(String, ForeignKey("staff.staff_id"), nullable=False)

    shift_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time   = Column(Time, nullable=False)
    # e.g. "morning", "evening", "night"
    shift_type = Column(String(30), nullable=True)
    notes      = Column(Text, nullable=True)

    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    staff = relationship("Staff", backref="shifts")

    __table_args__ = (
        Index("ix_staff_shifts_staff_date", "staff_id", "shift_date"),
    )


class StaffAttendance(Base):
    __tablename__ = "staff_attendance"

    attendance_id   = Column(String, primary_key=True, default=_uuid)
    staff_id        = Column(String, ForeignKey("staff.staff_id"), nullable=False)

    attendance_date = Column(Date, nullable=False)
    # ENUM values: present / absent / half_day / on_leave
    status          = Column(String(20), nullable=False)
    shift_id        = Column(String, ForeignKey("staff_shifts.shift_id"), nullable=True)
    notes           = Column(Text, nullable=True)

    marked_at       = Column(DateTime, nullable=False, default=_utcnow)

    staff = relationship("Staff", backref="attendance_records")
    shift = relationship("StaffShift")

    __table_args__ = (
        UniqueConstraint("staff_id", "attendance_date", name="uq_staff_attendance_staff_date"),
        Index("ix_staff_attendance_staff_date", "staff_id", "attendance_date"),
    )
