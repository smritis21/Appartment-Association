"""
Pydantic schemas for the Settings & Configuration module (BE-40).
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# ── Allowed ENUM values ───────────────────────────────────────────────────────

Language = Literal["en", "hi", "ta"]
Theme = Literal["light", "dark"]


# ── User preferences ──────────────────────────────────────────────────────────

class PreferenceUpdate(BaseModel):
    """
    Request body for PUT /settings/preferences.

    All fields optional - only the fields supplied are changed, so a client
    can update just the theme without resending notification settings.
    """

    notification_email: Optional[bool] = None
    notification_sms: Optional[bool] = None
    language: Optional[Language] = None
    theme: Optional[Theme] = None


class PreferenceOut(BaseModel):
    user_id: str
    notification_email: bool
    notification_sms: bool
    language: Language
    theme: Theme
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Apartment configuration (admin-only writes) ──────────────────────────────

class ConfigUpdate(BaseModel):
    """Request body for PUT /settings/config/{key}."""

    value: str = Field(..., min_length=1, max_length=500)


class ConfigOut(BaseModel):
    key: str
    value: str
    updated_by: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
