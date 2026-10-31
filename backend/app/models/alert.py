"""
SQLAlchemy models for the Alerts module (BE-19).

alert_deliveries is a separate table (one row per recipient per alert) so
delivery status can be checked per recipient - e.g. "did Mrs Sharma in B-204
actually get the fire alert" - rather than only as a broadcast-wide total.
resident_id has no FK constraint, so the delivery log survives a resident
being deleted or moved out; name and phone are snapshotted onto the row for
the same reason.

created_at is generated in Python rather than via func.now(): SQLite's
CURRENT_TIMESTAMP is only second-resolution, which would collapse "newest
first" ordering for alerts raised in the same second.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    """Current UTC time, naive, with microsecond precision (matches func.now() columns elsewhere)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Alert ─────────────────────────────────────────────────────────────────────

class Alert(Base):
    __tablename__ = "alerts"

    alert_id     = Column(String, primary_key=True, default=_uuid)

    title        = Column(String(120), nullable=False)
    message      = Column(Text, nullable=False)
    # ENUM values: emergency / urgent / info - "emergency" for this endpoint
    severity     = Column(String(20), nullable=False, default="emergency")
    # NULL means every block; otherwise the Flat.block this was scoped to
    target_block = Column(String(10), nullable=True)

    # resident_id of the President who raised it; nullable until auth
    # supplies the caller from the token instead of the request body.
    raised_by    = Column(String, nullable=True)

    recipient_count = Column(Integer, nullable=False, default=0)
    sent_count      = Column(Integer, nullable=False, default=0)
    failed_count    = Column(Integer, nullable=False, default=0)

    created_at   = Column(DateTime, nullable=False, default=_utcnow)

    deliveries = relationship(
        "AlertDelivery",
        back_populates="alert",
        cascade="all, delete-orphan",
        order_by="AlertDelivery.recipient_name",
    )

    __table_args__ = (
        Index("ix_alerts_created_at", "created_at"),
    )


# ── AlertDelivery ─────────────────────────────────────────────────────────────

class AlertDelivery(Base):
    __tablename__ = "alert_deliveries"

    delivery_id   = Column(String, primary_key=True, default=_uuid)
    alert_id      = Column(String, ForeignKey("alerts.alert_id"), nullable=False)

    # No FK (see module docstring); snapshot columns below keep the log
    # readable even if the resident record later changes or disappears.
    resident_id   = Column(String, nullable=False)
    recipient_name = Column(String(100), nullable=True)
    recipient_phone = Column(String(15), nullable=True)
    flat_number   = Column(String(10), nullable=True)

    # ENUM values: sms / email / in_app - one channel today (see mock_notifier)
    channel       = Column(String(20), nullable=False, default="sms")
    # ENUM values: pending / sent / failed
    status        = Column(String(20), nullable=False, default="pending")
    # Populated only on failure, e.g. "No phone number on record."
    failure_reason = Column(String(200), nullable=True)

    delivered_at  = Column(DateTime, nullable=True)

    alert = relationship("Alert", back_populates="deliveries")

    __table_args__ = (
        Index("ix_alert_deliveries_alert_id", "alert_id"),
        Index("ix_alert_deliveries_resident_id", "resident_id"),
    )
