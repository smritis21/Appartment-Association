"""Pydantic schemas for the Alerts module (BE-19)."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ── Allowed ENUM values ───────────────────────────────────────────────────────

AlertSeverity = Literal["emergency", "urgent", "info"]
DeliveryStatus = Literal["pending", "sent", "failed"]
DeliveryChannel = Literal["sms", "email", "in_app"]


# ── Broadcast request ─────────────────────────────────────────────────────────

class EmergencyAlertCreate(BaseModel):
    """
    Request body for POST /alerts/emergency.

    `message` has a 10-character floor to match the FE-19 compose form and,
    more importantly, because a two-word emergency broadcast to every resident
    in the society is far more likely to be a misfire than a real alert.
    """

    title: str = Field(
        ...,
        min_length=1,
        max_length=120,
        description="Short headline, e.g. 'Fire Drill - Evacuate Now'",
    )
    message: str = Field(
        ...,
        min_length=10,
        max_length=2000,
        description="Full alert text, including instructions for residents",
    )
    target_block: Optional[str] = Field(
        None,
        max_length=10,
        description=(
            "Restrict the broadcast to one block/tower (e.g. 'A'). "
            "Omit or send null to reach every active resident."
        ),
    )
    raised_by: Optional[str] = Field(
        None,
        description="resident_id of the President raising the alert",
    )

    @field_validator("title", "message")
    @classmethod
    def _not_only_whitespace(cls, value: str) -> str:
        """
        min_length alone would accept "           " as a valid message. Strip
        first, then re-check, so whitespace padding cannot smuggle an empty
        broadcast past validation.
        """
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be empty or whitespace only")
        return stripped

    @field_validator("target_block")
    @classmethod
    def _normalise_block(cls, value: Optional[str]) -> Optional[str]:
        """Blocks are stored uppercase ('A', 'B'); accept 'a' from the UI."""
        if value is None:
            return None
        stripped = value.strip().upper()
        return stripped or None


# ── Delivery log ──────────────────────────────────────────────────────────────

class AlertDeliveryOut(BaseModel):
    """One recipient's delivery record - the per-recipient status the AC requires."""

    delivery_id: str
    resident_id: str
    recipient_name: Optional[str] = None
    recipient_phone: Optional[str] = None
    flat_number: Optional[str] = None
    channel: DeliveryChannel
    status: DeliveryStatus
    failure_reason: Optional[str] = None
    delivered_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ── Alert responses ───────────────────────────────────────────────────────────

class AlertSummaryOut(BaseModel):
    """
    An alert without its delivery rows - what the alert list returns.

    A broadcast to 256 residents carries 256 delivery rows; sending all of
    them on every list request would make the screen unusable, so the counts
    live here and the full log is fetched per alert on demand.
    """

    alert_id: str
    title: str
    message: str
    severity: AlertSeverity
    target_block: Optional[str] = None
    raised_by: Optional[str] = None
    recipient_count: int
    sent_count: int
    failed_count: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AlertOut(AlertSummaryOut):
    """An alert with its full per-recipient delivery log."""

    deliveries: list[AlertDeliveryOut] = []

    model_config = ConfigDict(from_attributes=True)
