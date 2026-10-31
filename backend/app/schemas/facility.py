"""
Pydantic schemas for the Community Facilities booking module (BE-32).

slot must be one of the fixed hourly bands in TIME_SLOTS, and booking_date
cannot be in the past (today is allowed - the per-slot "already elapsed"
check lives in the availability grid, not here). TIME_SLOTS mirrors the
frontend facilities mock so both ends agree on the band labels; `start`/
`end` are 24h decimals used only by the availability grid.
"""

from datetime import timezone, date as date_type
from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Fixed hourly slot bands (shared contract with the frontend) ───────────────

TIME_SLOTS: list[dict] = [
    {"time": "06:00 - 07:00", "start": 6, "end": 7},
    {"time": "07:00 - 08:00", "start": 7, "end": 8},
    {"time": "08:00 - 09:00", "start": 8, "end": 9},
    {"time": "17:00 - 18:00", "start": 17, "end": 18},
    {"time": "18:00 - 19:00", "start": 18, "end": 19},
    {"time": "19:00 - 20:00", "start": 19, "end": 20},
]

# Set of valid slot labels, derived once for O(1) validation.
VALID_SLOTS: set[str] = {s["time"] for s in TIME_SLOTS}


# ── Allowed ENUM values ───────────────────────────────────────────────────────

FacilityStatus = Literal["active", "inactive"]
BookingStatus = Literal["confirmed", "cancelled"]
# Slot availability states, mirroring the frontend SLOT_STATE enum.
SlotState = Literal["available", "booked", "past"]


# ── Facility ──────────────────────────────────────────────────────────────────

class FacilityBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    location: Optional[str] = Field(None, max_length=100)
    capacity: int = Field(
        1, gt=0, description="Confirmed bookings a single slot accepts in parallel"
    )
    description: Optional[str] = None


class FacilityCreate(FacilityBase):
    status: FacilityStatus = "active"


class FacilityOut(FacilityBase):
    facility_id: str
    status: FacilityStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── FacilityBooking ───────────────────────────────────────────────────────────

class FacilityBookingCreate(BaseModel):
    resident_id: str = Field(..., min_length=1)
    booking_date: date_type
    slot: str = Field(..., description="One of the fixed TIME_SLOTS bands")

    @field_validator("booking_date")
    @classmethod
    def _booking_date_not_past(cls, v: date_type) -> date_type:
        # Today is allowed (you may still book a later band today); the per-slot
        # "already elapsed" decision is made by the availability grid.
        if v < datetime.now(timezone.utc).replace(tzinfo=None).date():
            raise ValueError("booking_date cannot be in the past")
        return v

    @field_validator("slot")
    @classmethod
    def _slot_must_be_known(cls, v: str) -> str:
        v = v.strip()
        if v not in VALID_SLOTS:
            raise ValueError(
                f"slot must be one of: {', '.join(sorted(VALID_SLOTS))}"
            )
        return v


class FacilityBookingOut(BaseModel):
    booking_id: str
    facility_id: str
    resident_id: str
    booking_date: date_type
    slot: str
    status: BookingStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Availability ──────────────────────────────────────────────────────────────

class SlotAvailability(BaseModel):
    slot: str = Field(..., description="Hourly band label, e.g. '06:00 - 07:00'")
    state: SlotState = Field(..., description="available / booked / past")
    booked: int = Field(..., description="Confirmed bookings currently held for this slot")
    spots_remaining: int = Field(..., description="capacity - booked (never negative)")


class FacilityAvailabilityOut(BaseModel):
    facility_id: str
    booking_date: date_type
    capacity: int
    slots: List[SlotAvailability]
