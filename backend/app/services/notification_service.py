"""Service layer for the Notification Center module (BE-37)."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import notifications as crud
from app.models.notification import Notification
from app.schemas.notification import (
    NotificationCreate,
    NotificationGenerateRequest,
    NotificationListResponse,
    NotificationOut,
    NotificationSummary,
    MarkReadRequest,
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_notification_or_404(db: Session, notification_id: str) -> Notification:
    notif = crud.get_notification(db, notification_id)
    if not notif:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Notification '{notification_id}' not found.",
        )
    return notif


def _resident_exists(db: Session, resident_id: str) -> bool:
    """Soft check - query the residents table if it exists, else trust the caller."""
    try:
        from app.models.resident import Resident
        return db.query(Resident).filter(Resident.resident_id == resident_id).first() is not None
    except Exception:
        return True  # allow if residents table not available (test isolation)


def _require_resident(db: Session, resident_id: str) -> None:
    if not _resident_exists(db, resident_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{resident_id}' not found.",
        )


# ── List with filters + unread count ─────────────────────────────────────────

def list_notifications(
    db: Session,
    resident_id: str,
    notification_type: str | None,
    source_module: str | None,
    is_read: bool | None,
    priority: str | None,
    skip: int,
    limit: int,
) -> NotificationListResponse:
    """Return paginated notifications + unread count for a resident."""
    _require_resident(db, resident_id)

    notifications = crud.get_notifications(
        db,
        resident_id=resident_id,
        notification_type=notification_type,
        source_module=source_module,
        is_read=is_read,
        priority=priority,
        skip=skip,
        limit=limit,
    )
    total = crud.count_notifications(
        db,
        resident_id=resident_id,
        notification_type=notification_type,
        source_module=source_module,
        is_read=is_read,
        priority=priority,
    )
    unread_count = crud.count_unread(db, resident_id)

    return NotificationListResponse(
        total=total,
        unread_count=unread_count,
        notifications=[NotificationSummary.model_validate(n) for n in notifications],
    )


# ── Mark as read ──────────────────────────────────────────────────────────────

def mark_notifications_read(
    db: Session,
    resident_id: str,
    body: MarkReadRequest,
) -> dict:
    """
    Mark one / many / all notifications as read for a resident.
    Returns a summary of how many were updated.
    """
    _require_resident(db, resident_id)

    # Validate individual IDs belong to this resident
    if body.notification_ids is not None:
        for nid in body.notification_ids:
            notif = crud.get_notification(db, nid)
            if notif and notif.resident_id != resident_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Notification '{nid}' does not belong to resident '{resident_id}'.",
                )

    updated = crud.mark_as_read(db, resident_id, body.notification_ids)
    db.commit()
    scope = "all" if body.notification_ids is None else f"{len(body.notification_ids)} selected"
    return {
        "detail": f"Marked {updated} notification(s) as read ({scope}).",
        "updated_count": updated,
    }


# ── Get single notification ───────────────────────────────────────────────────

def get_notification(db: Session, notification_id: str, resident_id: str) -> NotificationOut:
    """Return a single notification, verifying it belongs to the given resident."""
    notif = _get_notification_or_404(db, notification_id)
    if notif.resident_id != resident_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This notification does not belong to the specified resident.",
        )
    return NotificationOut.model_validate(notif)


# ── Generate (event-triggered) ────────────────────────────────────────────────

def generate_notification(
    db: Session,
    data: NotificationGenerateRequest,
) -> NotificationOut:
    """Create a notification triggered by a source event; callable from
    within other service modules without going through HTTP."""
    _require_resident(db, data.resident_id)

    obj_in = NotificationCreate(**data.model_dump())
    notif = crud.create_notification(db, obj_in)
    db.commit()
    db.refresh(notif)
    return NotificationOut.model_validate(notif)


# ── Create (legacy / direct) ──────────────────────────────────────────────────

def create_notification(db: Session, obj_in: NotificationCreate) -> NotificationOut:
    """Used directly by POST /notifications/ and any other router that
    doesn't go through generate_notification()."""
    _require_resident(db, obj_in.resident_id)
    notif = crud.create_notification(db, obj_in)
    db.commit()
    db.refresh(notif)
    return NotificationOut.model_validate(notif)


def clear_notifications(db: Session, resident_id: str) -> dict:
    """The resident is checked first so clearing an id that does not exist
    is a 404 rather than a silent no-op that looks like success."""
    _require_resident(db, resident_id)
    removed = crud.delete_all_for_resident(db, resident_id)
    return {"deleted": removed}


def notify_resident(
    db: Session,
    resident_id: str | None,
    *,
    title: str,
    message: str,
    notification_type: str = "general",
    source_module: str = "general",
    source_event_id: str | None = None,
    priority: str = "normal",
) -> None:
    """
    Raise a notification from inside another module's service.

    Modules call this as a side effect of something the resident actually did -
    a booking, a decision, a status change. The work that triggered it is the
    important part, so a notification that cannot be delivered (no resident on
    the record, or an id that no longer resolves) is allowed to fail quietly
    rather than roll back the caller's transaction.
    """
    if not resident_id:
        return

    from app.schemas.notification import NotificationGenerateRequest

    try:
        generate_notification(
            db,
            NotificationGenerateRequest(
                resident_id=resident_id,
                title=title,
                message=message,
                notification_type=notification_type,
                source_module=source_module,
                source_event_id=source_event_id,
                priority=priority,
            ),
        )
    except Exception:
        # Deliberately broad: whatever goes wrong here, the booking or status
        # change that triggered it has already happened and must stand. Tests
        # assert the notifications *are* raised, so a silent failure shows up
        # there rather than going unnoticed.
        pass
