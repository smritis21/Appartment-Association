"""Service layer for the Alerts module (BE-19)."""

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import alerts as crud
from app.schemas.alert import (
    AlertDeliveryOut,
    AlertOut,
    AlertSummaryOut,
    EmergencyAlertCreate,
)
from app.services import mock_notifier, notification_service

# ── Recipient rules ───────────────────────────────────────────────────────────
# Only residents currently living here get emergency alerts. "inactive" and
# "moved_out" residents are deliberately excluded - broadcasting a fire alarm
# to someone who left the society six months ago is noise, not safety.
ACTIVE_RESIDENT_STATUS = "active"

# ── Delivery statuses ─────────────────────────────────────────────────────────
DELIVERY_SENT = "sent"
DELIVERY_FAILED = "failed"

# Severity for this endpoint. The alerts table can hold urgent/info too, but
# /alerts/emergency only ever raises emergencies - the severity is a property
# of the endpoint, not something the caller gets to choose, so a mis-set field
# can't downgrade a fire alarm to a notice.
EMERGENCY_SEVERITY = "emergency"

# Default page size for the alert list.
DEFAULT_ALERT_LIMIT = 50


def _get_alert_or_404(db: Session, alert_id: str):
    alert = crud.get_alert(db, alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert '{alert_id}' not found.",
        )
    return alert


# ── Broadcast ─────────────────────────────────────────────────────────────────

def broadcast_emergency(db: Session, data: EmergencyAlertCreate) -> AlertOut:
    """
    Broadcast an emergency alert and log a delivery outcome - sent or
    failed - for every recipient, as one transaction.

    A recipient the notifier can't reach (no phone on record) is recorded
    as a failed delivery, not an error: the President still needs the
    other 250 residents to get the fire alarm, and needs to see exactly
    who missed it. That's why the notifier returns failures as data
    instead of raising.

    Rejected with 400 if target_block names a block that doesn't exist
    (almost always a typo - silently broadcasting to nobody is a
    dangerous way to fail), or if the target resolves to zero recipients.
    """
    target_block = data.target_block

    if target_block is not None and not crud.block_exists(db, target_block):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Block '{target_block}' does not exist.",
        )

    recipients = crud.get_broadcast_recipients(
        db, active_status=ACTIVE_RESIDENT_STATUS, target_block=target_block
    )
    if not recipients:
        scope = f"block '{target_block}'" if target_block else "the society"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No active residents found in {scope} - nothing to broadcast to.",
        )

    alert = crud.create_alert(
        db,
        title=data.title,
        message=data.message,
        severity=EMERGENCY_SEVERITY,
        target_block=target_block,
        raised_by=data.raised_by,
    )

    sent_count = 0
    failed_count = 0

    for resident, flat_number in recipients:
        result = mock_notifier.send(
            recipient_name=resident.name,
            phone=resident.phone,
            title=data.title,
            body=data.message,
        )
        delivered = result.success
        if delivered:
            sent_count += 1
        else:
            failed_count += 1

        crud.create_delivery(
            db,
            alert_id=alert.alert_id,
            resident_id=resident.resident_id,
            recipient_name=resident.name,
            recipient_phone=resident.phone,
            flat_number=flat_number,
            channel=mock_notifier.DEFAULT_CHANNEL,
            status=DELIVERY_SENT if delivered else DELIVERY_FAILED,
            failure_reason=None if delivered else result.message,
            delivered_at=datetime.now(timezone.utc) if delivered else None,
        )

        # The delivery row records what was sent over SMS. Residents also read
        # the portal, so the alert is raised in-app as well - an emergency the
        # recipient can only see by checking their phone is half-broadcast.
        notification_service.notify_resident(
            db,
            resident.resident_id,
            title=data.title,
            message=data.message,
            notification_type="emergency_alert",
            source_module="alerts",
            source_event_id=alert.alert_id,
            priority="high",
        )

    alert.recipient_count = len(recipients)
    alert.sent_count = sent_count
    alert.failed_count = failed_count

    db.commit()
    db.refresh(alert)
    return AlertOut.model_validate(alert)


# ── Reads ─────────────────────────────────────────────────────────────────────

def get_alert(db: Session, alert_id: str) -> AlertOut:
    """One alert with its full per-recipient delivery log."""
    return AlertOut.model_validate(_get_alert_or_404(db, alert_id))


def list_alerts(db: Session, limit: int = DEFAULT_ALERT_LIMIT) -> list[AlertSummaryOut]:
    """Emergency alerts newest-first, without the delivery rows."""
    return [
        AlertSummaryOut.model_validate(a)
        for a in crud.list_alerts(db, limit=limit, severity=EMERGENCY_SEVERITY)
    ]


def get_deliveries(
    db: Session, alert_id: str, delivery_status: str | None = None
) -> list[AlertDeliveryOut]:
    """
    The delivery log for one alert, optionally filtered by status.

    `?status=failed` is the query that matters operationally: after a
    broadcast, the President wants the list of residents who did *not* get it
    so someone can knock on those doors.
    """
    _get_alert_or_404(db, alert_id)
    return [
        AlertDeliveryOut.model_validate(d)
        for d in crud.get_deliveries(db, alert_id, status=delivery_status)
    ]
