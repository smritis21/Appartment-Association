"""Pydantic schemas for the Temple Management module (BE-33)."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# ── Allowed ENUM values ───────────────────────────────────────────────────────

SevaType = Literal["monthly_pooja", "abhishekam", "archana", "sandhana_kaapu"]
BookingStatus = Literal["confirmed", "cancelled"]

DonationPurpose = Literal["general", "annadanam", "festival", "renovation", "other"]
PaymentMode = Literal["cash", "upi", "online_transfer", "cheque"]

EventStatus = Literal["upcoming", "ongoing", "completed", "cancelled"]
SignupType = Literal["rsvp", "volunteer"]


# ── TempleBooking (sevas) ──────────────────────────────────────────────────────

class TempleBookingBase(BaseModel):
    resident_id: str = Field(..., min_length=1)
    seva_type: SevaType
    booking_date: date
    slot: Optional[str] = Field(None, max_length=20)
    amount: Decimal = Field(..., gt=0, description="Seva amount, must be greater than 0")

    @field_validator("seva_type", mode="before")
    @classmethod
    def normalize_seva_type(cls, v: str) -> str:
        if isinstance(v, str):
            return v.lower().replace("-", "_")
        return v

    @field_validator("booking_date")
    @classmethod
    def booking_date_must_be_future(cls, v: date) -> date:
        if v < date.today():
            raise ValueError("booking_date must be today or a future date.")
        return v


class TempleBookingCreate(TempleBookingBase):
    pass


class TempleBookingOut(TempleBookingBase):
    booking_id: str
    status: BookingStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── TempleDonation ─────────────────────────────────────────────────────────────

class TempleDonationBase(BaseModel):
    resident_id: Optional[str] = None
    donor_name: Optional[str] = Field(None, max_length=100)
    purpose: Optional[DonationPurpose] = None
    amount: Decimal = Field(..., gt=0, description="Donation amount, must be greater than 0")
    payment_mode: Optional[PaymentMode] = None
    receipt_no: Optional[str] = Field(None, max_length=50)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def resident_or_donor_name_required(self) -> "TempleDonationBase":
        if not self.resident_id and not self.donor_name:
            raise ValueError("Either resident_id or donor_name must be provided.")
        return self


class TempleDonationCreate(TempleDonationBase):
    pass


class TempleDonationOut(TempleDonationBase):
    donation_id: str
    donated_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── TempleEvent ────────────────────────────────────────────────────────────────

class TempleEventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    event_date: datetime
    venue: Optional[str] = Field(None, max_length=100)
    volunteers_needed: Optional[int] = Field(None, gt=0)


class TempleEventCreate(TempleEventBase):
    status: EventStatus = "upcoming"


class TempleEventOut(TempleEventBase):
    event_id: str
    status: EventStatus
    volunteers_joined: int = Field(0, description="Count of volunteers signed up")
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── TempleEventSignup ──────────────────────────────────────────────────────────

class TempleEventSignupCreate(BaseModel):
    resident_id: str = Field(..., min_length=1)
    type: SignupType = Field(..., description="rsvp or volunteer")


class TempleEventSignupOut(BaseModel):
    signup_id: str
    event_id: str
    resident_id: str
    resident_name: Optional[str] = None
    resident_phone: Optional[str] = None
    flat: Optional[str] = None
    type: SignupType
    signed_up_at: datetime

    model_config = ConfigDict(from_attributes=True)
