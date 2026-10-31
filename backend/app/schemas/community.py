"""
Pydantic schemas for the Community Corners module (BE-34).

CommunityActivityCreate has no router endpoint (see app/crud/community.py)
but is still used by tests and demo-data seeding.
"""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# ── Allowed ENUM values ───────────────────────────────────────────────────────

Corner = Literal["kids", "senior", "recreational", "social"]
ActivityStatus = Literal["upcoming", "completed", "cancelled"]


# ── CommunityActivity ─────────────────────────────────────────────────────────

class CommunityActivityBase(BaseModel):
    corner: Corner
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    activity_date: Optional[date] = None
    capacity: Optional[int] = Field(None, gt=0, description="NULL means unlimited signups")


class CommunityActivityCreate(CommunityActivityBase):
    status: ActivityStatus = "upcoming"


class CommunityActivityOut(CommunityActivityBase):
    activity_id: str
    status: ActivityStatus
    signup_count: int = Field(0, description="Number of residents currently signed up")
    spots_remaining: Optional[int] = Field(
        None, description="capacity - signup_count; null when capacity is unlimited"
    )
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── ActivitySignup ────────────────────────────────────────────────────────────

class ActivitySignupCreate(BaseModel):
    resident_id: str = Field(..., min_length=1)
    notes: Optional[str] = Field(None, max_length=200)


class ActivitySignupOut(BaseModel):
    signup_id: str
    activity_id: str
    resident_id: str
    notes: Optional[str] = None
    signed_up_at: datetime

    model_config = ConfigDict(from_attributes=True)
