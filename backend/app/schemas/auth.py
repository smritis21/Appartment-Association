"""
Pydantic schemas for the Authentication & Accounts module (BE-21).

hashed_password and reset_token are never included in any Out schema -
they're simply absent from every response model, so they can't leak
through model_validate().
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

# ── Allowed ENUM values ───────────────────────────────────────────────────────

UserRole = Literal[
    "owner", "tenant", "president", "secretary", "admin", "maintenance", "security"
]
AccountStatus = Literal["pending", "active", "suspended"]


# ── Register ──────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    """Request body for POST /auth/register."""

    email:     EmailStr = Field(..., description="Must be a valid email address")
    password:  str      = Field(..., min_length=8, description="Minimum 8 characters")
    full_name: str      = Field(..., min_length=1, max_length=100)
    role:      UserRole = Field("owner", description="Requested role")

    @field_validator("password")
    @classmethod
    def _password_not_whitespace(cls, v: str) -> str:
        if v.strip() == "":
            raise ValueError("password must not be blank")
        return v


# ── Login ─────────────────────────────────────────────────────────────────────

class UserLogin(BaseModel):
    """Request body for POST /auth/login."""

    email:    EmailStr = Field(...)
    password: str      = Field(...)


# ── Token response ────────────────────────────────────────────────────────────

class TokenOut(BaseModel):
    """Returned by POST /auth/login on success."""

    access_token: str
    token_type:   str = "bearer"
    user_id:      str
    role:         UserRole
    account_status: AccountStatus


# ── Profile ───────────────────────────────────────────────────────────────────

class UserProfileOut(BaseModel):
    """Returned by GET /auth/profile and PUT /auth/profile."""

    user_id:        str
    email:          str
    full_name:      str
    role:           UserRole
    account_status: AccountStatus
    resident_id:    Optional[str] = None
    created_at:     datetime
    updated_at:     datetime

    model_config = ConfigDict(from_attributes=True)


class UserProfileUpdate(BaseModel):
    """Request body for PUT /auth/profile. All fields optional."""

    full_name: Optional[str] = Field(None, min_length=1, max_length=100)
    # Email changes are intentionally excluded - changing email requires
    # re-verification. See EmailChangeRequest / EmailChangeConfirm below
    # and POST /auth/email/change + POST /auth/email/confirm (EN-21).


# ── Password operations ───────────────────────────────────────────────────────

class ChangePassword(BaseModel):
    """Request body for POST /auth/change-password."""

    current_password: str = Field(..., min_length=1)
    new_password:     str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def _new_not_whitespace(cls, v: str) -> str:
        if v.strip() == "":
            raise ValueError("new_password must not be blank")
        return v


class ForgotPassword(BaseModel):
    """Request body for POST /auth/forgot-password."""

    email: EmailStr


class ResetPassword(BaseModel):
    """Request body for POST /auth/reset-password."""

    token:        str = Field(..., description="Reset token received via forgot-password")
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def _new_not_whitespace(cls, v: str) -> str:
        if v.strip() == "":
            raise ValueError("new_password must not be blank")
        return v


# ── Sensitive-field changes (EN-21) ───────────────────────────────────────────
# Mirrors the forgot-password / reset-password token pattern: no email
# infrastructure is available for the prototype, so the confirmation token
# is stored on the user row and the confirm endpoint accepts it directly.

class EmailChangeRequest(BaseModel):
    """Request body for POST /auth/email/change."""

    new_email: EmailStr


class EmailChangeConfirm(BaseModel):
    """Request body for POST /auth/email/confirm."""

    token: str


class RoleChangeRequest(BaseModel):
    """Request body for PUT /auth/users/{user_id}/role."""

    role: UserRole


class AccountStatusChangeRequest(BaseModel):
    """Request body for PUT /auth/users/{user_id}/status."""

    status: AccountStatus


# ── Generic message response ──────────────────────────────────────────────────

class MessageOut(BaseModel):
    """Simple acknowledgement response used by forgot-password and change-password."""

    detail: str
