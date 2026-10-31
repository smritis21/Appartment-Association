"""Pydantic schemas for the Communication module (BE-27)."""

from datetime import date, datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

# Maximum attachment paths per circular (mirrors models/communication.py)
MAX_ATTACHMENTS = 5

CircularCategory = Literal["general", "meeting", "notice", "urgent"]


# ── Circular ──────────────────────────────────────────────────────────────────

class CircularBase(BaseModel):
    title:        str              = Field(..., min_length=1, max_length=200)
    body:         str              = Field(..., min_length=1)
    category:     CircularCategory = Field("general")
    meeting_date: Optional[date]   = Field(
        None,
        description=(
            "Date of the meeting (ISO-8601). Required when category='meeting'. "
            "Must be today or in the future."
        ),
    )
    attachments:  List[str]        = Field(
        default_factory=list,
        description=f"File-path strings; maximum {MAX_ATTACHMENTS} entries.",
    )
    created_by:   Optional[str]    = Field(None, max_length=100)


class CircularCreate(CircularBase):
    @model_validator(mode="after")
    def _check_attachment_limit(self) -> "CircularCreate":
        if len(self.attachments) > MAX_ATTACHMENTS:
            raise ValueError(
                f"A circular may have at most {MAX_ATTACHMENTS} attachments "
                f"({len(self.attachments)} provided)."
            )
        return self


class CircularOut(CircularBase):
    circular_id: str
    created_at:  datetime
    updated_at:  datetime

    model_config = ConfigDict(from_attributes=True)


# ── Poll ──────────────────────────────────────────────────────────────────────

class PollBase(BaseModel):
    question:   str           = Field(..., min_length=1, max_length=500)
    options:    List[str]     = Field(
        ...,
        min_length=2,
        description="At least two option strings.",
    )
    open_at:    datetime      = Field(..., description="UTC datetime when voting opens.")
    close_at:   datetime      = Field(..., description="UTC datetime when voting closes.")
    created_by: Optional[str] = Field(None, max_length=100)

    @model_validator(mode="after")
    def _check_window(self) -> "PollBase":
        if self.close_at <= self.open_at:
            raise ValueError("close_at must be strictly after open_at.")
        if len(self.options) < 2:
            raise ValueError("A poll must have at least 2 options.")
        return self


class PollCreate(PollBase):
    pass


class PollOut(BaseModel):
    """Poll details including a live vote tally."""
    poll_id:      str
    question:     str
    options:      List[str]
    open_at:      datetime
    close_at:     datetime
    created_by:   Optional[str] = None
    created_at:   datetime
    # Derived: option → vote count
    tally:        Dict[str, int] = Field(
        default_factory=dict,
        description="Map of option string → number of votes cast so far.",
    )
    total_votes:  int = Field(0, description="Total number of responses recorded.")
    is_open:      bool = Field(
        False, description="True when now is within the open/close window."
    )

    model_config = ConfigDict(from_attributes=True)


class PollResultsOut(BaseModel):
    """Full results for a closed or open poll."""
    poll_id:     str
    question:    str
    options:     List[str]
    open_at:     datetime
    close_at:    datetime
    tally:       Dict[str, int]
    total_votes: int
    winner:      Optional[str] = Field(
        None,
        description="Option with the most votes; null when no votes have been cast.",
    )

    model_config = ConfigDict(from_attributes=True)


# ── PollResponse ──────────────────────────────────────────────────────────────

class PollResponseCreate(BaseModel):
    resident_id:   str = Field(..., min_length=1)
    chosen_option: str = Field(..., min_length=1, max_length=200)


class PollResponseOut(BaseModel):
    response_id:   str
    poll_id:       str
    resident_id:   str
    chosen_option: str
    responded_at:  datetime

    model_config = ConfigDict(from_attributes=True)
