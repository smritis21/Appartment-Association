"""CRUD operations for the Notification Center module (BE-37)."""

from datetime import datetime, timezone

from sqlalchemy import and_
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.schemas.notification import NotificationCreate


# ── Create ────────────────────────────────────────────────────────────────────

def create_notification(db: Session, obj_in: NotificationCreate) -> Notification:
    db_obj = Notification(
        resident_id       = obj_in.resident_id,
        title             = obj_in.title,
        message           = obj_in.message,
        notification_type = obj_in.notification_type,
        source_module     = obj_in.source_module,
        source_event_id   = obj_in.source_event_id,
        priority          = obj_in.priority,
        is_read           = False,
    )
    db.add(db_obj)
    return db_obj


# ── Read ──────────────────────────────────────────────────────────────────────

def get_notification(db: Session, notification_id: str) -> Notification | None:
    return (
        db.query(Notification)
        .filter(Notification.notification_id == notification_id)
        .first()
    )


def get_notifications(
    db: Session,
    resident_id: str,
    notification_type: str | None = None,
    source_module: str | None = None,
    is_read: bool | None = None,
    priority: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[Notification]:
    """Ordered newest-first."""
    q = db.query(Notification).filter(Notification.resident_id == resident_id)

    if notification_type is not None:
        q = q.filter(Notification.notification_type == notification_type)
    if source_module is not None:
        q = q.filter(Notification.source_module == source_module)
    if is_read is not None:
        q = q.filter(Notification.is_read == is_read)
    if priority is not None:
        q = q.filter(Notification.priority == priority)

    return q.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()


def count_notifications(
    db: Session,
    resident_id: str,
    notification_type: str | None = None,
    source_module: str | None = None,
    is_read: bool | None = None,
    priority: str | None = None,
) -> int:
    """Same filters as get_notifications(), for the pagination envelope."""
    q = db.query(Notification).filter(Notification.resident_id == resident_id)

    if notification_type is not None:
        q = q.filter(Notification.notification_type == notification_type)
    if source_module is not None:
        q = q.filter(Notification.source_module == source_module)
    if is_read is not None:
        q = q.filter(Notification.is_read == is_read)
    if priority is not None:
        q = q.filter(Notification.priority == priority)

    return q.count()


def count_unread(db: Session, resident_id: str) -> int:
    return (
        db.query(Notification)
        .filter(
            Notification.resident_id == resident_id,
            Notification.is_read == False,  # noqa: E712
        )
        .count()
    )


# ── Update (mark as read) ─────────────────────────────────────────────────────

def mark_as_read(
    db: Session,
    resident_id: str,
    notification_ids: list[str] | None,
) -> int:
    """
    Mark notifications as read.
    If notification_ids is None, marks ALL unread for the resident.
    Returns the number of rows updated.
    """
    now = datetime.now(timezone.utc)
    q = db.query(Notification).filter(
        Notification.resident_id == resident_id,
        Notification.is_read == False,  # noqa: E712
    )
    if notification_ids is not None:
        q = q.filter(Notification.notification_id.in_(notification_ids))

    rows = q.all()
    for row in rows:
        row.is_read = True
        row.read_at = now
    return len(rows)


def delete_all_for_resident(db: Session, resident_id: str) -> int:
    """
    Remove every notification belonging to a resident.

    Returns how many rows went, so the caller can tell the user what happened
    rather than reporting a bare success.
    """
    removed = (
        db.query(Notification)
        .filter(Notification.resident_id == resident_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return removed
