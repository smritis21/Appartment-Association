"""Pydantic schemas for the Workforce Management module (BE-26)."""

from datetime import date, datetime, time
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

# ── Allowed ENUM values ───────────────────────────────────────────────────────

BookingStatus = Literal["booked", "completed", "cancelled"]
HouseHelpAttendanceStatus = Literal["present", "absent"]
JobStatus = Literal["requested", "assigned", "in_progress", "completed", "cancelled"]


# ── House help directory ─────────────────────────────────────────────────────

class HouseHelpCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    service_type: str = Field(..., min_length=1, max_length=50, description="e.g. maid, cook, driver, gardener")
    phone: Optional[str] = Field(None, max_length=15)


class HouseHelpOut(BaseModel):
    house_help_id: str
    name: str
    service_type: str
    phone: Optional[str] = None
    is_active: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Bookings ──────────────────────────────────────────────────────────────────

class HouseHelpBookingCreate(BaseModel):
    house_help_id: str
    resident_id: str
    booking_date: date
    start_time: time
    end_time: time
    notes: Optional[str] = Field(None, max_length=500)

    @model_validator(mode="after")
    def _end_after_start(self) -> "HouseHelpBookingCreate":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time.")
        return self


class HouseHelpBookingOut(BaseModel):
    booking_id: str
    house_help_id: str
    resident_id: str
    booking_date: date
    start_time: time
    end_time: time
    status: BookingStatus
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class HouseHelpBookingStatusUpdate(BaseModel):
    status: BookingStatus


# ── Attendance ────────────────────────────────────────────────────────────────

class HouseHelpAttendanceCreate(BaseModel):
    house_help_id: str
    attendance_date: date
    status: HouseHelpAttendanceStatus
    booking_id: Optional[str] = None
    notes: Optional[str] = Field(None, max_length=500)


class HouseHelpAttendanceOut(BaseModel):
    attendance_id: str
    house_help_id: str
    booking_id: Optional[str] = None
    attendance_date: date
    status: HouseHelpAttendanceStatus
    notes: Optional[str] = None
    marked_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Ratings ───────────────────────────────────────────────────────────────────

class HouseHelpRatingCreate(BaseModel):
    booking_id: str = Field(..., description="Must reference a completed booking")
    resident_id: str
    rating: int = Field(..., ge=1, le=5)
    comment: Optional[str] = Field(None, max_length=1000)


class HouseHelpRatingOut(BaseModel):
    rating_id: str
    house_help_id: str
    booking_id: str
    resident_id: str
    rating: int
    comment: Optional[str] = None
    rated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Providers ─────────────────────────────────────────────────────────────────

class ProviderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    service_type: str = Field(..., min_length=1, max_length=50, description="e.g. AC Repair, Pest Control")
    phone: Optional[str] = Field(None, max_length=15)


class ProviderOut(BaseModel):
    provider_id: str
    name: str
    service_type: str
    phone: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Provider jobs ─────────────────────────────────────────────────────────────

class ProviderJobCreate(BaseModel):
    provider_id: str
    title: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = Field(None, max_length=2000)
    requested_by: Optional[str] = Field(None, description="resident_id of the requester, if any")


class ProviderJobStatusUpdate(BaseModel):
    status: JobStatus


class ProviderJobOut(BaseModel):
    job_id: str
    provider_id: str
    title: str
    description: Optional[str] = None
    status: JobStatus
    requested_by: Optional[str] = None
    requested_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
