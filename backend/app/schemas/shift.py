"""Pydantic schemas for the Staff Attendance & Shift module (BE-35)."""

from datetime import date, datetime, time
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

# ── Allowed ENUM values ───────────────────────────────────────────────────────

AttendanceStatus = Literal["present", "absent", "half_day", "on_leave"]


# ── Shift allocation ─────────────────────────────────────────────────────────

class ShiftCreate(BaseModel):
    staff_id: str = Field(..., description="UUID of the staff member this shift is allocated to")
    shift_date: date
    start_time: time
    end_time: time
    shift_type: Optional[str] = Field(None, max_length=30, description="e.g. morning, evening, night")
    notes: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="after")
    def _end_after_start(self) -> "ShiftCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class ShiftOut(BaseModel):
    shift_id: str
    staff_id: str
    shift_date: date
    start_time: time
    end_time: time
    shift_type: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Attendance ────────────────────────────────────────────────────────────────

class AttendanceCreate(BaseModel):
    staff_id: str = Field(..., description="UUID of the staff member")
    attendance_date: date
    status: AttendanceStatus
    shift_id: Optional[str] = Field(None, description="Shift this attendance record is against, if any")
    notes: Optional[str] = Field(None, max_length=500)


class AttendanceOut(BaseModel):
    attendance_id: str
    staff_id: str
    attendance_date: date
    status: AttendanceStatus
    shift_id: Optional[str] = None
    notes: Optional[str] = None
    marked_at: datetime

    model_config = ConfigDict(from_attributes=True)
