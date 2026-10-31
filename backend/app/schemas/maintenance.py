"""
Pydantic schemas for the Maintenance Scheduling module (BE-17).
"""

import json
from datetime import date, datetime, time
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MaintenanceScheduleCreate(BaseModel):
    """Request body for POST /maintenance/schedule."""

    title: str = Field(..., min_length=1, max_length=150)
    scheduled_date: date
    scheduled_time: time
    affected_facilities: list[str] = Field(
        ..., min_length=1, description="At least one facility, e.g. ['Gym', 'Pool']"
    )
    notes: Optional[str] = Field(None, max_length=500)
    scheduled_by: Optional[str] = Field(
        None, description="Identifier of who scheduled this (e.g. the Manager's id) - not validated yet"
    )


class MaintenanceScheduleOut(BaseModel):
    schedule_id: str
    title: str
    scheduled_date: date
    scheduled_time: time
    affected_facilities: list[str]
    notes: Optional[str] = None
    scheduled_by: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @field_validator("affected_facilities", mode="before")
    @classmethod
    def _parse_facilities(cls, v):
        """The ORM stores this as a JSON-encoded string; decode it transparently here."""
        if isinstance(v, str):
            return json.loads(v)
        return v


# ── WorkOrder schemas (BE-24) ─────────────────────────────────────────────────────────

WorkOrderType     = Literal["reactive", "preventive"]
WorkOrderPriority = Literal["low", "medium", "high", "critical"]
WorkOrderStatus   = Literal["open", "assigned", "in_progress", "completed"]

# Valid forward-only transitions
_WO_FLOW = ["open", "assigned", "in_progress", "completed"]


class WorkOrderCreate(BaseModel):
    title:       str              = Field(..., min_length=1, max_length=150)
    description: Optional[str]   = Field(None, max_length=2000)
    asset_id:    Optional[str]   = Field(None, max_length=50)
    type:        WorkOrderType   = "reactive"
    priority:    WorkOrderPriority = "medium"
    due_date:    Optional[date]  = None
    assigned_to: Optional[str]   = Field(None, description="staff_id to assign immediately")
    outcome:     Optional[str]   = Field(None, max_length=1000)


class WorkOrderAssign(BaseModel):
    staff_id: str = Field(..., description="UUID of the staff member to assign this work order to")


class WorkOrderStatusUpdate(BaseModel):
    status:  WorkOrderStatus
    outcome: Optional[str] = Field(None, max_length=1000,
                                   description="Required when status is 'completed'")


from app.schemas.complaint import StaffOut as _StaffOut  # noqa: E402 - local import avoids circular


class WorkOrderOut(BaseModel):
    work_order_id: str
    title:         str
    description:   Optional[str]       = None
    asset_id:      Optional[str]       = None
    type:          WorkOrderType
    priority:      WorkOrderPriority
    status:        WorkOrderStatus
    assigned_to:   Optional[str]       = None
    assigned_staff: Optional[_StaffOut] = None
    due_date:      Optional[date]      = None
    completed_at:  Optional[datetime]  = None
    outcome:       Optional[str]       = None
    created_by:    Optional[str]       = None
    created_at:    datetime
    updated_at:    datetime
    is_overdue:    bool                = False

    model_config = ConfigDict(from_attributes=True)


class WorkOrderStatsOut(BaseModel):
    total:     int
    open:      int
    overdue:   int
    completed: int
