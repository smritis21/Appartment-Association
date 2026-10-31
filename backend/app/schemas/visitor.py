"""
Pydantic schemas for the Visitors module (BE-05).

VisitorCreate is for internal use - BE-04 owns the public "raise a visitor
request" endpoint.
"""

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer

# ── Allowed ENUM values ───────────────────────────────────────────────────────

VisitorStatus = Literal["pending", "approved", "rejected", "left_at_gate", "expired"]

# What a resident is allowed to send to the decision endpoint. Deliberately a
# narrower set than VisitorStatus - "pending" and "expired" are system states,
# not decisions a resident can make.
VisitorDecision = Literal["approved", "rejected", "left_at_gate"]


# ── Visitor ───────────────────────────────────────────────────────────────────

class VisitorBase(BaseModel):
    visitor_name: str = Field(..., min_length=1, max_length=100)
    purpose: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=15)
    flat_number: Optional[str] = Field(None, max_length=10)
    gate: Optional[str] = Field(None, max_length=50)
    vehicle: Optional[str] = Field(None, max_length=100)
    resident_id: Optional[str] = None


class VisitorCreate(VisitorBase):
    pass_code: Optional[str] = Field(None, max_length=20)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None


class VisitorOut(VisitorBase):
    visitor_id: str
    status: VisitorStatus
    pass_code: Optional[str] = None

    # Resolved server-side from the linked Resident (and, for flat_number,
    # the Resident's Flat as a fallback when the caller didn't supply one) -
    # see visitor_service._to_visitor_out(). Never trust a client-supplied
    # flat_number/resident_name to already be correct.
    resident_name: Optional[str] = None
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None

    decision: Optional[VisitorDecision] = None
    decided_by: Optional[str] = None
    decided_at: Optional[datetime] = None
    decision_notes: Optional[str] = None

    collected_by: Optional[str] = None
    pickup_location: Optional[str] = None

    requested_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    # SQLAlchemy's plain DateTime column doesn't persist tzinfo, so these
    # columns come back from the DB as naive datetimes that still hold the
    # correct UTC clock value. Stamp them as UTC before JSON serialization
    # so the wire format always carries an explicit offset - a bare
    # zone-less timestamp gets read as local time by JS's `new Date(...)`.
    @field_serializer(
        "valid_from",
        "valid_until",
        "entry_time",
        "exit_time",
        "requested_at",
        "decided_at",
        "created_at",
        "updated_at",
        when_used="json",
    )
    def _serialize_as_utc(self, value: Optional[datetime]) -> Optional[str]:
        if value is None:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.isoformat()


# ── Decision (BE-05) ──────────────────────────────────────────────────────────

class VisitorDecisionRequest(BaseModel):
    """Request body for POST /visitors/{visitor_id}/decision."""

    decision: VisitorDecision = Field(
        ...,
        description=(
            "The resident's decision. 'left_at_gate' is only valid for "
            "delivery requests."
        ),
    )
    decided_by: Optional[str] = Field(
        None,
        description="resident_id of the resident recording the decision",
    )
    notes: Optional[str] = Field(
        None,
        max_length=500,
        description="Optional note attached to the decision",
    )


# ── Pass issue / verify (BE-25) ─────────────────────────────────────────────────

class VisitorPassCreate(VisitorBase):
    """
    Request body for POST /visitors/passes.

    Unlike POST /visitors (BE-05, a guard logging a walk-in that still needs a
    resident's decision), a pass is pre-authorised by the resident who issues
    it - resident_id is required and the record is created already approved.
    """

    resident_id: str = Field(..., description="resident_id of the resident issuing the pass")
    valid_from: Optional[datetime] = Field(
        None, description="Defaults to the issue time if omitted"
    )
    valid_until: datetime = Field(..., description="Pass expires after this timestamp")


class VisitorPassVerifyRequest(BaseModel):
    """Request body for POST /visitors/passes/verify."""

    pass_code: str = Field(..., min_length=1, max_length=20)
    gate: Optional[str] = Field(None, max_length=50, description="Gate the pass was presented at")
