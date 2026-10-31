"""SQLAlchemy model for the Notification Center module (BE-37)."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, String
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    """
    Current UTC time, naive, with microsecond precision.

    Used instead of server_default=func.now(): SQLite's CURRENT_TIMESTAMP is
    only second-resolution, which would make same-second notifications sort
    unpredictably under ORDER BY created_at DESC.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(String, primary_key=True, default=_uuid)

    # Who receives this notification
    resident_id = Column(String, nullable=False)  # soft FK to residents

    # Content
    title   = Column(String(100), nullable=False)
    message = Column(String(500), nullable=False)

    # Classification
    # ENUM values: general | complaint_status_change | payment_due |
    #              visitor_approval | maintenance_update | announcement |
    #              emergency_alert
    notification_type = Column(String(50), nullable=False, default="general")

    # Source tracing (module + object id that triggered this notification)
    # ENUM values: complaints | payments | visitors | maintenance |
    #              announcements | alerts | general
    source_module   = Column(String(50), nullable=True, default="general")
    source_event_id = Column(String, nullable=True)   # UUID of triggering object

    # Priority: low | normal | high
    priority = Column(String(10), nullable=False, default="normal")

    # Read state
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=_utcnow, nullable=False)
