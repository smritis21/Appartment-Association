"""
FastAPI router for the Notification Center module (BE-37).

POST /notifications/ is a legacy direct-creation endpoint kept for BE-03
compatibility; new callers should use /notifications/generate instead.
"""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.crud import notifications as crud_notifications
from app.dependencies import get_db
from app.schemas.notification import (
    NotificationCreate,
    NotificationGenerateRequest,
    NotificationListResponse,
    NotificationOut,
    MarkReadRequest,
)
from app.services import notification_service as service

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ── GET /notifications ────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=NotificationListResponse,
    summary="List notifications for a resident",
    description=(
        "Returns a paginated list of a resident's notifications across all modules, "
        "along with the total unread count (unaffected by filters). "
        "Supports filtering by `notification_type`, `source_module`, `is_read`, and `priority`."
    ),
    responses={
        200: {"description": "Paginated notification list with unread count"},
        404: {"description": "Resident not found"},
    },
)
def list_notifications(
    resident_id:       str           = Query(..., description="Target resident UUID"),
    notification_type: Optional[str] = Query(None, description="Filter by type: general | complaint_status_change | payment_due | visitor_approval | maintenance_update | announcement | emergency_alert"),
    source_module:     Optional[str] = Query(None, description="Filter by source module: complaints | payments | visitors | maintenance | announcements | alerts | general"),
    is_read:           Optional[bool]= Query(None, description="Filter by read status: true=read, false=unread"),
    priority:          Optional[str] = Query(None, description="Filter by priority: low | normal | high"),
    skip:              int           = Query(0,  ge=0,        description="Records to skip"),
    limit:             int           = Query(50, ge=1, le=200, description="Max records to return"),
    db:                Session       = Depends(get_db),
):
    return service.list_notifications(
        db=db,
        resident_id=resident_id,
        notification_type=notification_type,
        source_module=source_module,
        is_read=is_read,
        priority=priority,
        skip=skip,
        limit=limit,
    )


# ── GET /notifications/{notification_id} ──────────────────────────────────────

@router.get(
    "/{notification_id}",
    response_model=NotificationOut,
    summary="Get a single notification",
    description="Returns the full detail of one notification, verified against the provided resident_id.",
    responses={
        200: {"description": "Notification detail"},
        403: {"description": "Notification does not belong to this resident"},
        404: {"description": "Notification not found"},
    },
)
def get_notification(
    notification_id: str,
    resident_id:     str     = Query(..., description="Owner resident UUID - used for ownership check"),
    db:              Session = Depends(get_db),
):
    return service.get_notification(db=db, notification_id=notification_id, resident_id=resident_id)


# ── PATCH /notifications/{resident_id}/mark-read ──────────────────────────────

@router.patch(
    "/{resident_id}/mark-read",
    summary="Mark notifications as read",
    description=(
        "Mark one, many, or all notifications as read for a resident.\n\n"
        "- Provide `notification_ids` list to mark specific notifications.\n"
        "- Omit `notification_ids` (or send `null`) to mark **all** unread notifications as read."
    ),
    responses={
        200: {"description": "Notifications marked as read"},
        403: {"description": "Notification does not belong to this resident"},
        404: {"description": "Resident not found"},
    },
)
def mark_notifications_read(
    resident_id: str,
    body:        MarkReadRequest = MarkReadRequest(),
    db:          Session         = Depends(get_db),
):
    return service.mark_notifications_read(db=db, resident_id=resident_id, body=body)


# ── POST /notifications/generate ─────────────────────────────────────────────

@router.post(
    "/generate",
    response_model=NotificationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a notification from a source event",
    description=(
        "Creates a notification that was triggered by a source module event. "
        "Use this endpoint (or call `notification_service.generate_notification()` internally) "
        "whenever a complaint changes status, a payment is due, a visitor request is decided, etc."
    ),
    responses={
        201: {"description": "Notification generated successfully"},
        404: {"description": "Resident not found"},
        422: {"description": "Validation error"},
    },
)
def generate_notification(
    data: NotificationGenerateRequest,
    db:   Session = Depends(get_db),
):
    return service.generate_notification(db=db, data=data)


# ── POST /notifications/ (legacy BE-03 compat) ────────────────────────────────

@router.post(
    "/",
    response_model=NotificationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a notification (legacy)",
    description=(
        "Direct notification creation. Retained for backwards compatibility with BE-03. "
        "Prefer `POST /notifications/generate` for event-triggered notifications."
    ),
    responses={
        201: {"description": "Notification created"},
        404: {"description": "Resident not found"},
        422: {"description": "Validation error"},
    },
)
def create_notification(
    notification: NotificationCreate,
    db:           Session = Depends(get_db),
):
    return service.create_notification(db=db, obj_in=notification)


# ── DELETE /notifications/{resident_id} ──────────────────────────────────────

@router.delete(
    "/{resident_id}",
    summary="Clear all notifications for a resident",
    description=(
        "Removes every notification belonging to the resident and reports how "
        "many were deleted. Backs the notification centre's clear-all action."
    ),
    responses={
        200: {"description": "Notifications cleared"},
        404: {"description": "Resident not found"},
    },
)
def clear_notifications(
    resident_id: str,
    db:          Session = Depends(get_db),
):
    return service.clear_notifications(db=db, resident_id=resident_id)
