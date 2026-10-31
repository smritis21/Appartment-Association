"""Pydantic schemas for the Payment Reminders module (BE-12)."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Enums ─────────────────────────────────────────────────────────────────────

class ReminderType(str, Enum):
    first_notice  = "first_notice"
    second_notice = "second_notice"
    final_notice  = "final_notice"
    custom        = "custom"


class ReminderChannel(str, Enum):
    email  = "email"
    sms    = "sms"
    push   = "push"
    in_app = "in_app"


class ReminderStatus(str, Enum):
    sent      = "sent"
    dismissed = "dismissed"
    failed    = "failed"


# ── Request schemas ───────────────────────────────────────────────────────────

class ReminderCreate(BaseModel):
    bill_id:       str           = Field(..., description="UUID of the bill to remind about")
    resident_id:   str           = Field(..., description="UUID of the resident to remind")
    reminder_type: ReminderType  = Field(..., description="Type of reminder notice")
    channel:       ReminderChannel = Field(
        ReminderChannel.in_app, description="Delivery channel for the reminder"
    )


class ReminderUpdate(BaseModel):
    """Used internally - currently only dismiss is exposed via the router."""
    status: ReminderStatus


# ── Response schemas ──────────────────────────────────────────────────────────

class ReminderOut(BaseModel):
    reminder_id:   str
    bill_id:       str
    resident_id:   str
    reminder_type: ReminderType
    channel:       ReminderChannel
    status:        ReminderStatus
    sent_at:       datetime
    dismissed_at:  Optional[datetime] = None
    created_at:    datetime

    model_config = ConfigDict(from_attributes=True)


class ReminderListResponse(BaseModel):
    total:  int
    items:  list[ReminderOut]


# ── Stats schema ──────────────────────────────────────────────────────────────

class ReminderStats(BaseModel):
    total:     int = Field(..., ge=0, description="Total reminders ever sent")
    sent:      int = Field(..., ge=0, description="Reminders currently in 'sent' state")
    dismissed: int = Field(..., ge=0, description="Reminders dismissed by residents")
    failed:    int = Field(..., ge=0, description="Reminders that failed to deliver")
    by_type:   dict[str, int] = Field(
        default_factory=dict,
        description="Count per reminder_type (first_notice, second_notice, etc.)",
    )
    by_channel: dict[str, int] = Field(
        default_factory=dict,
        description="Count per channel (email, sms, push, in_app)",
    )
