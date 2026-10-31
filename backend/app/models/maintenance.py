"""SQLAlchemy model for the Maintenance Scheduling module (BE-17)."""

import uuid

from sqlalchemy import Column, Date, DateTime, ForeignKey, String, Text, Time, func
from sqlalchemy.orm import relationship
from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


class MaintenanceSchedule(Base):
    __tablename__ = "maintenance_schedules"

    schedule_id          = Column(String, primary_key=True, default=_uuid)
    title                = Column(String(150), nullable=False)
    scheduled_date       = Column(Date, nullable=False)
    scheduled_time       = Column(Time, nullable=False)
    affected_facilities  = Column(Text, nullable=False)  # JSON-encoded list of strings
    notes                = Column(Text, nullable=True)
    scheduled_by         = Column(String, nullable=True)
    created_at           = Column(DateTime, nullable=False, default=func.now())


# ── WorkOrder (BE-24) ─────────────────────────────────────────────────────────
# Tracks reactive and preventive maintenance tasks from creation to completion.
# Status flow: open → assigned → in_progress → completed

class WorkOrder(Base):
    __tablename__ = "work_orders"

    work_order_id = Column(String, primary_key=True, default=_uuid)
    title         = Column(String(150), nullable=False)
    description   = Column(Text, nullable=True)
    # Free-text asset reference - no FK because there is no Asset table yet.
    asset_id      = Column(String(50), nullable=True)
    # ENUM values: reactive / preventive
    type          = Column(String(20), nullable=False, default="reactive")
    # ENUM values: low / medium / high / critical
    priority      = Column(String(20), nullable=False, default="medium")
    # ENUM values: open / assigned / in_progress / completed
    status        = Column(String(20), nullable=False, default="open")
    # FK to staff.staff_id - nullable until assigned
    assigned_to   = Column(String, ForeignKey("staff.staff_id"), nullable=True)
    due_date      = Column(Date, nullable=True)
    completed_at  = Column(DateTime, nullable=True)
    outcome       = Column(Text, nullable=True)
    # user_id of whoever created the order (from JWT token)
    created_by    = Column(String, nullable=True)
    created_at    = Column(DateTime, nullable=False, default=func.now())
    updated_at    = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    assigned_staff = relationship("Staff", foreign_keys=[assigned_to])
