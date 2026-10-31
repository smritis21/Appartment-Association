"""Pydantic schemas for the Residents module (BE-18)."""

from datetime import date, time
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ── Allowed ENUM values ───────────────────────────────────────────────────────

OwnershipType   = Literal["owned", "rented"]
OccupancyStatus = Literal["occupied", "vacant"]
ResidentStatus  = Literal["active", "inactive", "moved_out"]


def _phone_digits_only(v: Optional[str]) -> Optional[str]:
    if v is not None and not v.replace("+", "").replace("-", "").isdigit():
        raise ValueError("phone must contain only digits, +, or -")
    return v


# ── FamilyMember ──────────────────────────────────────────────────────────────

class FamilyMemberBase(BaseModel):
    name:     str         = Field(..., min_length=1, max_length=100)
    relation: Optional[str] = Field(None, max_length=50)
    phone:    Optional[str] = Field(None, max_length=15)

    @field_validator("phone")
    @classmethod
    def phone_digits_only(cls, v: Optional[str]) -> Optional[str]:
        return _phone_digits_only(v)


class FamilyMemberCreate(FamilyMemberBase):
    pass


class FamilyMemberOut(FamilyMemberBase):
    member_id:   str
    resident_id: str

    model_config = ConfigDict(from_attributes=True)


# ── EmergencyContact ──────────────────────────────────────────────────────────

class EmergencyContactBase(BaseModel):
    name:         str         = Field(..., min_length=1, max_length=100)
    relationship: Optional[str] = Field(None, max_length=50)
    phone:        str         = Field(..., min_length=7, max_length=15)

    @field_validator("phone")
    @classmethod
    def phone_digits_only(cls, v: str) -> str:
        return _phone_digits_only(v)


class EmergencyContactCreate(EmergencyContactBase):
    pass


class EmergencyContactOut(EmergencyContactBase):
    contact_id:  str
    resident_id: str

    model_config = ConfigDict(from_attributes=True)


# ── Flat ──────────────────────────────────────────────────────────────────────

class FlatBase(BaseModel):
    block:            str            = Field(..., min_length=1, max_length=10)
    floor:            Optional[str]  = Field(None, max_length=10)
    flat_number:      str            = Field(..., min_length=1, max_length=10)
    ownership_type:   Optional[OwnershipType]   = None
    occupancy_status: Optional[OccupancyStatus] = "vacant"


class FlatCreate(FlatBase):
    pass


class FlatOut(FlatBase):
    flat_id: str

    model_config = ConfigDict(from_attributes=True)


# ── Resident ──────────────────────────────────────────────────────────────────

class ResidentBase(BaseModel):
    name:          str                    = Field(..., min_length=1, max_length=100)
    phone:         Optional[str]          = Field(None, max_length=15)
    occupation:    Optional[str]          = Field(None, max_length=100)
    move_in_date:  Optional[date]         = None
    move_out_date: Optional[date]         = None
    status:        ResidentStatus         = "active"

    @field_validator("phone")
    @classmethod
    def phone_digits_only(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.replace("+", "").replace("-", "").isdigit():
            raise ValueError("phone must contain only digits, +, or -")
        return v


class ResidentCreate(ResidentBase):
    flat_id:            str = Field(..., description="UUID of the flat this resident lives in")
    family_members:     list[FamilyMemberCreate]     = []
    emergency_contacts: list[EmergencyContactCreate] = []


class ResidentUpdate(BaseModel):
    """All fields optional - supports partial updates."""
    name:          Optional[str]           = Field(None, min_length=1, max_length=100)
    phone:         Optional[str]           = Field(None, max_length=15)
    occupation:    Optional[str]           = Field(None, max_length=100)
    move_in_date:  Optional[date]          = None
    move_out_date: Optional[date]          = None
    status:        Optional[ResidentStatus] = None
    flat_id:       Optional[str]           = None

    # Optional move-out slot booking (EN-22) - reserves the shared moving
    # resource (elevator/dock) for the resident's block. Only booked when
    # all three are provided; omitting them skips slot booking entirely.
    move_slot_date:  Optional[date] = None
    move_slot_start: Optional[time] = None
    move_slot_end:   Optional[time] = None

    @field_validator("phone")
    @classmethod
    def phone_digits_only(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.replace("+", "").replace("-", "").isdigit():
            raise ValueError("phone must contain only digits, +, or -")
        return v

    @model_validator(mode="after")
    def _slot_fields_consistent(self) -> "ResidentUpdate":
        provided = [self.move_slot_date, self.move_slot_start, self.move_slot_end]
        if any(provided) and not all(provided):
            raise ValueError(
                "move_slot_date, move_slot_start and move_slot_end must all be "
                "provided together, or all omitted."
            )
        if self.move_slot_start is not None and self.move_slot_end is not None:
            if self.move_slot_end <= self.move_slot_start:
                raise ValueError("move_slot_end must be after move_slot_start.")
        return self


class ResidentOut(ResidentBase):
    resident_id:        str
    flat_id:            str
    flat:               Optional[FlatOut]              = None
    family_members:     list[FamilyMemberOut]          = []
    emergency_contacts: list[EmergencyContactOut]      = []

    model_config = ConfigDict(from_attributes=True)


class ResidentSummary(BaseModel):
    """Lightweight response used in list/search endpoints."""
    resident_id: str
    name:        str
    phone:       Optional[str]
    status:      ResidentStatus
    flat_id:     str
    flat:        Optional[FlatOut] = None

    model_config = ConfigDict(from_attributes=True)
