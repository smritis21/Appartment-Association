"""Pydantic schemas for the Notification Center module (BE-37)."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Allowed ENUM values ───────────────────────────────────────────────────────

NotificationType = Literal[
    "general",
    "complaint_status_change",
    "payment_due",
    "visitor_approval",
    "maintenance_update",
    "announcement",
    "emergency_alert",
    "booking_confirmed",
]

SourceModule = Literal[
    "general",
    "complaints",
    "payments",
    "visitors",
    "maintenance",
    "announcements",
    "alerts",
    "facilities",
    "events",
    "temple",
]

Priority = Literal["low", "normal", "high"]


# ── Notification schemas ──────────────────────────────────────────────────────

class NotificationBase(BaseModel):
    resident_id:       str            = Field(..., description="UUID of the target resident")
    title:             str            = Field(..., min_length=1, max_length=100)
    message:           str            = Field(..., min_length=1, max_length=500)
    notification_type: NotificationType = "general"
    source_module:     SourceModule   = "general"
    source_event_id:   Optional[str]  = Field(None, description="UUID of the triggering object")
    priority:          Priority        = "normal"


class NotificationCreate(NotificationBase):
    """Used internally and via POST to create a notification."""
    pass


class NotificationOut(NotificationBase):
    """Full notification response."""
    notification_id: str
    is_read:         bool
    read_at:         Optional[datetime] = None
    created_at:      datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationSummary(BaseModel):
    """Lightweight item used in paginated list responses."""
    notification_id:   str
    resident_id:       str
    title:             str
    notification_type: str
    source_module:     Optional[str]
    priority:          str
    is_read:           bool
    created_at:        datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    """Paginated list with unread count included in the envelope."""
    total:        int
    unread_count: int
    notifications: list[NotificationSummary]


class MarkReadRequest(BaseModel):
    """Body for PATCH /notifications/mark-read."""
    notification_ids: Optional[list[str]] = Field(
        None,
        description="List of notification IDs to mark as read. "
                    "If omitted, ALL notifications for the resident are marked read.",
    )


class NotificationGenerateRequest(BaseModel):
    """Body for POST /notifications/generate - event-triggered notification creation."""
    resident_id:       str            = Field(..., description="Target resident UUID")
    title:             str            = Field(..., min_length=1, max_length=100)
    message:           str            = Field(..., min_length=1, max_length=500)
    notification_type: NotificationType = "general"
    source_module:     SourceModule   = "general"
    source_event_id:   Optional[str]  = None
    priority:          Priority        = "normal"
