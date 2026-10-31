"""Pydantic schemas for the Onboarding & Approval module (BE-22)."""

from datetime import datetime, time
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


# ── Allowed ENUM values ───────────────────────────────────────────────────────

ApplicantType       = Literal["owner", "tenant"]
ApplicationStatus   = Literal["pending", "approved", "rejected"]
DocumentType        = Literal[
    "id_proof", "address_proof", "ownership_deed", "rental_agreement", "other"
]


# ── UploadedDocument ──────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    document_id:       str
    application_id:    str
    document_type:     DocumentType
    file_reference:    str
    original_filename: Optional[str] = None
    uploaded_at:       datetime

    model_config = ConfigDict(from_attributes=True)


# ── OnboardingApplication ─────────────────────────────────────────────────────

class OnboardingRegister(BaseModel):
    """Request body for POST /onboarding/register."""

    applicant_name: str          = Field(..., min_length=1, max_length=100)
    email:          EmailStr
    phone:          Optional[str] = Field(None, max_length=15)
    applicant_type: ApplicantType
    block:          str          = Field(..., min_length=1, max_length=10)
    floor:          Optional[str] = Field(None, max_length=10)
    flat_number:    str          = Field(..., min_length=1, max_length=10)
    move_in_date:   Optional[str] = Field(None, description="ISO date string YYYY-MM-DD")
    occupation:     Optional[str] = Field(None, max_length=100)
    # Only meaningful for tenant applications - the name of the flat's owner
    # (manually entered, or auto-filled client-side from the owner-lookup
    # endpoint below). Optional so owner applications can omit it.
    owner_name:     Optional[str] = Field(None, max_length=100)
    # Optional link to a pre-existing User account (BE-21)
    user_id:        Optional[str] = None

    @field_validator("phone")
    @classmethod
    def _phone_digits(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.replace("+", "").replace("-", "").isdigit():
            raise ValueError("phone must contain only digits, +, or -")
        return v


class DocumentUpload(BaseModel):
    """Request body for POST /onboarding/upload-document."""

    application_id:    str
    document_type:     DocumentType
    file_reference:    str  = Field(..., min_length=1, max_length=500)
    original_filename: Optional[str] = Field(None, max_length=255)

    @field_validator("document_type", mode="before")
    @classmethod
    def normalize_type(cls, v: str) -> str:
        alias_map = {
            "aadhaar": "id_proof",
            "pan": "address_proof",
            "sale_deed": "ownership_deed",
            "photo": "other",
        }
        val = str(v).lower().strip()
        return alias_map.get(val, val)



class ApproveApplication(BaseModel):
    """Request body for PUT /onboarding/{id}/approve."""

    # flat_id is optional - if omitted the service will find-or-create the flat
    # from the block/floor/flat_number stored on the application.
    flat_id: Optional[str] = None

    # Optional move-in slot booking (EN-22) - reserves the shared moving
    # resource (elevator/dock) for the application's block. Only booked when
    # both are provided; omitting them skips slot booking entirely.
    move_slot_date:  Optional[str]  = Field(None, description="ISO date string YYYY-MM-DD")
    move_slot_start: Optional[time] = None
    move_slot_end:   Optional[time] = None

    @model_validator(mode="after")
    def _slot_fields_consistent(self) -> "ApproveApplication":
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


class RejectApplication(BaseModel):
    """Request body for PUT /onboarding/{id}/reject."""

    rejection_reason: str = Field(..., min_length=1, max_length=500)


class ApplicationOut(BaseModel):
    application_id:   str
    user_id:          Optional[str]  = None
    applicant_name:   str
    email:            str
    phone:            Optional[str]  = None
    applicant_type:   ApplicantType
    block:            str
    floor:            Optional[str]  = None
    flat_number:      str
    flat_id:          Optional[str]  = None
    move_in_date:     Optional[str]  = None
    occupation:       Optional[str]  = None
    owner_name:       Optional[str]  = None
    status:           ApplicationStatus
    rejection_reason: Optional[str]  = None
    reviewed_by:      Optional[str]  = None
    reviewed_at:      Optional[datetime] = None
    resident_id:      Optional[str]  = None
    created_at:       datetime
    updated_at:       datetime
    documents:        list[DocumentOut] = []

    model_config = ConfigDict(from_attributes=True)


class ApplicationSummary(BaseModel):
    """Response used in the pending queue."""

    application_id: str
    applicant_name: str
    email:          str
    phone:          Optional[str] = None
    applicant_type: ApplicantType
    block:          str
    floor:          Optional[str] = None
    flat_number:    str
    occupation:     Optional[str] = None
    owner_name:     Optional[str] = None
    status:         ApplicationStatus
    created_at:     datetime
    documents:      list[DocumentOut] = []

    model_config = ConfigDict(from_attributes=True)


class OwnerLookupOut(BaseModel):
    """Response for GET /onboarding/owner-lookup - used by the tenant
    registration form to auto-fill the "Owner Name" field by finding the
    approved owner application already on file for a given block/flat."""

    found:      bool
    owner_name: Optional[str] = None
