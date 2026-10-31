from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AnnouncementBase(BaseModel):
    title: str = Field(..., min_length=1, description="The title of the announcement.")
    body: str = Field(..., min_length=1, description="The body/content of the announcement.")
    author: Optional[str] = Field(None, description="The author of the announcement.")
    visibility: str = Field("public", description="Visibility level, e.g., 'public', 'residents_only'")
    category: Optional[str] = Field(None, description="Category of the announcement")
    pinned: bool = Field(False, description="Pinned notices sort to the top of the dashboard.")
    status: Literal["published", "draft"] = Field(
        "published",
        description="'published' or 'draft'. Drafts stay out of the resident list.",
    )
    scheduled_for: Optional[datetime] = Field(None, description="When the notice should become visible. Null publishes immediately.")

    @field_validator("title", "body")
    @classmethod
    def _reject_blank(cls, value: str) -> str:
        """
        A title of "   " is as unusable as a missing one, so whitespace-only
        text is rejected rather than stored and rendered as an empty card.
        """
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped


class AnnouncementCreate(AnnouncementBase):
    pass


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = Field(None, description="The title of the announcement.")
    body: Optional[str] = Field(None, description="The body/content of the announcement.")
    author: Optional[str] = Field(None, description="The author of the announcement.")
    visibility: Optional[str] = Field(None, description="Visibility level.")
    category: Optional[str] = Field(None, description="Category of the announcement")
    pinned: Optional[bool] = Field(None, description="Pinned notices sort to the top of the dashboard.")
    status: Optional[Literal["published", "draft"]] = Field(None, description="'published' or 'draft'.")
    scheduled_for: Optional[datetime] = Field(None, description="When the notice should become visible.")


class AnnouncementResponse(AnnouncementBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
