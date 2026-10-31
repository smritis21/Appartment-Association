"""Pydantic schemas for the Forum & Lost-and-Found module (BE-29)."""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Maximum image references per post (mirrors models/forum.py)
MAX_IMAGE_REFS = 3
# Maximum body lengths (EN-29)
MAX_POST_BODY_LENGTH = 10000
MAX_COMMENT_BODY_LENGTH = 2000

PostCategory = Literal["general", "events", "classifieds", "safety", "lost_found"]
LostFoundType = Literal["lost", "found"]
LostFoundStatus = Literal["open", "resolved"]


# ── Forum Post ────────────────────────────────────────────────────────────────

class ForumPostCreate(BaseModel):
    title:      str           = Field(..., min_length=1, max_length=200)
    body:       str           = Field(..., min_length=1, max_length=MAX_POST_BODY_LENGTH)
    category:   PostCategory  = Field("general")
    image_refs: List[str]     = Field(
        default_factory=list,
        description=f"Up to {MAX_IMAGE_REFS} image URL strings.",
    )
    author_id:  Optional[str] = Field(None, max_length=100, description="Resident ID or display name")

    @field_validator("image_refs")
    @classmethod
    def _check_image_limit(cls, v: List[str]) -> List[str]:
        if len(v) > MAX_IMAGE_REFS:
            raise ValueError(
                f"A post may have at most {MAX_IMAGE_REFS} image references "
                f"({len(v)} provided)."
            )
        return v


class ForumPostOut(BaseModel):
    post_id:       str
    title:         str
    body:          str
    category:      str
    image_refs:    List[str]
    author_id:     Optional[str] = None
    comment_count: int = Field(0, description="Number of comments on this post.")
    created_at:    datetime
    updated_at:    datetime

    model_config = ConfigDict(from_attributes=True)


class ForumPostListResponse(BaseModel):
    total:  int
    skip:   int
    limit:  int
    posts:  List[ForumPostOut]


# ── Forum Comment ─────────────────────────────────────────────────────────────

class ForumCommentCreate(BaseModel):
    body:      str           = Field(..., min_length=1, max_length=MAX_COMMENT_BODY_LENGTH)
    author_id: Optional[str] = Field(None, max_length=100)


class ForumCommentOut(BaseModel):
    comment_id: str
    post_id:    str
    body:       str
    author_id:  Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ForumCommentListResponse(BaseModel):
    total:    int
    skip:     int
    limit:    int
    comments: List[ForumCommentOut]


# ── Lost & Found Item ─────────────────────────────────────────────────────────

class LostFoundItemCreate(BaseModel):
    item_type:   LostFoundType  = Field(..., description="'lost' or 'found'")
    title:       str            = Field(..., min_length=1, max_length=200)
    description: Optional[str]  = Field(None, max_length=1000)
    image_ref:   Optional[str]  = Field(None, max_length=500, description="Single image URL")
    reported_by: Optional[str]  = Field(None, max_length=100)


class LostFoundStatusUpdate(BaseModel):
    status: LostFoundStatus = Field(..., description="New status: 'open' or 'resolved'")


class LostFoundItemOut(BaseModel):
    item_id:     str
    item_type:   str
    title:       str
    description: Optional[str] = None
    image_ref:   Optional[str] = None
    status:      str
    reported_by: Optional[str] = None
    created_at:  datetime
    updated_at:  datetime

    model_config = ConfigDict(from_attributes=True)


class LostFoundListResponse(BaseModel):
    total: int
    skip:  int
    limit: int
    items: List[LostFoundItemOut]
