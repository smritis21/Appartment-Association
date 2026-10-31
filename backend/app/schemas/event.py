"""
Pydantic schemas for the Community Hub Events module (BE-31).

Gallery entries are validated at the schema boundary: each must be a
plausible image reference (an http(s) URL or a root-relative path), capped
at MAX_GALLERY_IMAGES.
"""

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Maximum gallery image references per event (mirrors models/event.py).
MAX_GALLERY_IMAGES = 10


# ── Allowed ENUM values ───────────────────────────────────────────────────────

EventStatus = Literal["upcoming", "ongoing", "completed", "cancelled"]
RegistrationType = Literal["rsvp", "volunteer"]


def _validate_image_reference(v: str) -> str:
    """Rejects blank strings - a blank reference is a bug, not "no image" (leave the entry out for that)."""
    v = v.strip()
    if not v:
        raise ValueError("gallery references cannot be blank; omit the entry instead")
    if not (v.startswith("http://") or v.startswith("https://") or v.startswith("/")):
        raise ValueError(
            "gallery references must be an http(s) URL or a root-relative path "
            "(starting with '/')"
        )
    return v


# ── Event ─────────────────────────────────────────────────────────────────────

class EventBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    event_date: datetime
    venue: Optional[str] = Field(None, max_length=100)
    capacity: Optional[int] = Field(
        None, gt=0, description="Attendee (RSVP) seats; NULL means unlimited RSVPs"
    )
    gallery: List[str] = Field(
        default_factory=list,
        description=(
            f"Image-reference strings (http(s) URL or root-relative path); "
            f"maximum {MAX_GALLERY_IMAGES} entries."
        ),
    )

    @field_validator("gallery")
    @classmethod
    def _validate_gallery(cls, v: List[str]) -> List[str]:
        if len(v) > MAX_GALLERY_IMAGES:
            raise ValueError(
                f"An event may have at most {MAX_GALLERY_IMAGES} gallery images "
                f"({len(v)} provided)."
            )
        return [_validate_image_reference(item) for item in v]


class EventCreate(EventBase):
    created_by: Optional[str] = Field(None, max_length=100)
    status: EventStatus = "upcoming"
    # Request-only flag, not an Event column - event_service.create_event()
    # consumes it to also create a matching Announcement (category "Event")
    # in the same transaction, so residents who never open Community Hub
    # still see the event. crud.events.create_event() excludes it before
    # building the Event row.
    notify_as_announcement: bool = Field(
        False,
        description=(
            "When true, also publishes a matching Announcement (category "
            "'Event') alongside the event."
        ),
    )


class EventOut(EventBase):
    event_id: str
    created_by: Optional[str] = None
    status: EventStatus
    rsvp_count: int = Field(0, description="Number of residents who have RSVP'd")
    volunteer_count: int = Field(0, description="Number of residents volunteering")
    spots_remaining: Optional[int] = Field(
        None, description="capacity - rsvp_count; null when capacity is unlimited"
    )
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── EventRegistration ─────────────────────────────────────────────────────────

class EventRegistrationCreate(BaseModel):
    resident_id: str = Field(..., min_length=1)
    type: RegistrationType = Field(..., description="rsvp / volunteer")


class EventRegistrationOut(BaseModel):
    registration_id: str
    event_id: str
    resident_id: str
    type: RegistrationType
    registered_at: datetime

    model_config = ConfigDict(from_attributes=True)
