"""CRUD operations for the Payment Reminders module (BE-12)."""

from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.reminder import PaymentReminder
from app.schemas.reminder import ReminderCreate


# ── Create ────────────────────────────────────────────────────────────────────

def create_reminder(db: Session, data: ReminderCreate) -> PaymentReminder:
    reminder = PaymentReminder(
        bill_id=data.bill_id,
        resident_id=data.resident_id,
        reminder_type=data.reminder_type.value,
        channel=data.channel.value,
        status="sent",
    )
    db.add(reminder)
    return reminder


# ── Read ──────────────────────────────────────────────────────────────────────

def get_reminder(db: Session, reminder_id: str) -> PaymentReminder | None:
    return (
        db.query(PaymentReminder)
        .filter(PaymentReminder.reminder_id == reminder_id)
        .first()
    )


def list_reminders(
    db: Session,
    status: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[PaymentReminder]:
    q = db.query(PaymentReminder)
    if status:
        q = q.filter(PaymentReminder.status == status)
    return q.order_by(PaymentReminder.created_at.desc()).offset(skip).limit(limit).all()


def list_by_bill(db: Session, bill_id: str) -> list[PaymentReminder]:
    return (
        db.query(PaymentReminder)
        .filter(PaymentReminder.bill_id == bill_id)
        .order_by(PaymentReminder.created_at.desc())
        .all()
    )


def list_by_resident(
    db: Session,
    resident_id: str,
    skip: int = 0,
    limit: int = 20,
) -> list[PaymentReminder]:
    return (
        db.query(PaymentReminder)
        .filter(PaymentReminder.resident_id == resident_id)
        .order_by(PaymentReminder.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_active_reminder_for_bill_and_type(
    db: Session, bill_id: str, reminder_type: str
) -> PaymentReminder | None:
    """Return a non-dismissed reminder of the same type for this bill, if one exists."""
    return (
        db.query(PaymentReminder)
        .filter(
            PaymentReminder.bill_id == bill_id,
            PaymentReminder.reminder_type == reminder_type,
            PaymentReminder.status == "sent",
        )
        .first()
    )


# ── Dismiss ───────────────────────────────────────────────────────────────────

def dismiss_reminder(db: Session, reminder: PaymentReminder) -> PaymentReminder:
    reminder.status = "dismissed"
    reminder.dismissed_at = datetime.now(timezone.utc)
    return reminder


# ── Statistics ────────────────────────────────────────────────────────────────

def get_status_counts(db: Session) -> list[tuple[str, int]]:
    """(status, count) across all reminders."""
    return (
        db.query(PaymentReminder.status, func.count(PaymentReminder.reminder_id))
        .group_by(PaymentReminder.status)
        .all()
    )


def get_type_counts(db: Session) -> list[tuple[str, int]]:
    """(reminder_type, count) across all reminders."""
    return (
        db.query(PaymentReminder.reminder_type, func.count(PaymentReminder.reminder_id))
        .group_by(PaymentReminder.reminder_type)
        .all()
    )


def get_channel_counts(db: Session) -> list[tuple[str, int]]:
    """(channel, count) across all reminders."""
    return (
        db.query(PaymentReminder.channel, func.count(PaymentReminder.reminder_id))
        .group_by(PaymentReminder.channel)
        .all()
    )
