"""Mock notification gateway for BE-19.

Simulates an SMS/push provider without external calls - the same role
mock_gateway.py plays for payments. A recipient with no phone number on
record fails deterministically, since that's the realistic failure mode
and it gives the per-recipient delivery log something to record. Nothing
is ever transmitted and no credentials are held here.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

# The one channel wired up today. The delivery model already stores the
# channel per row, so adding email/in_app later does not need a migration.
DEFAULT_CHANNEL = "sms"


@dataclass
class NotificationResult:
    success:   bool
    reference: str
    message:   str


def send(
    recipient_name: str | None,
    phone: str | None,
    title: str,
    body: str,
    simulate_failure: bool = False,
) -> NotificationResult:
    """Simulate delivering one alert to one recipient.

    Never raises - a single bad recipient must not be able to abort a
    society-wide broadcast, so failures come back as data (success=False)
    for the caller to record.
    """
    if simulate_failure:
        return NotificationResult(
            success=False,
            reference="",
            message="Provider rejected the message: simulated failure.",
        )

    if not phone or not phone.strip():
        return NotificationResult(
            success=False,
            reference="",
            message="No phone number on record for this resident.",
        )

    ts = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y%m%d%H%M%S")
    uid = uuid.uuid4().hex[:8].upper()
    who = recipient_name or "resident"

    return NotificationResult(
        success=True,
        reference=f"MSG-{ts}-{uid}",
        message=f"Alert '{title}' delivered to {who}.",
    )
