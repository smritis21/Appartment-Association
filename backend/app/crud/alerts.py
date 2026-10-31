"""CRUD operations for the Alerts module (BE-19)."""

from sqlalchemy.orm import Session, joinedload

from app.models.alert import Alert, AlertDelivery
from app.models.resident import Flat, Resident


def _alert_query(db: Session):
    """Base query with the per-recipient delivery log eagerly loaded."""
    return db.query(Alert).options(joinedload(Alert.deliveries))


# ── Recipients ────────────────────────────────────────────────────────────────

def get_broadcast_recipients(
    db: Session, active_status: str, target_block: str | None = None
) -> list[tuple[Resident, str | None]]:
    """
    (resident, flat_number) for everyone who should receive a broadcast.

    Joins Flat so the delivery log can snapshot the flat number without a
    second query per recipient - a broadcast to a few hundred residents would
    otherwise be a few hundred extra round trips.

    `active_status` is passed in by the service rather than hardcoded here, so
    the rule about who counts as reachable stays in one place.
    """
    query = (
        db.query(Resident, Flat.flat_number)
        .join(Flat, Resident.flat_id == Flat.flat_id)
        .filter(Resident.status == active_status)
    )
    if target_block is not None:
        query = query.filter(Flat.block == target_block)

    return query.order_by(Resident.name).all()


def block_exists(db: Session, block: str) -> bool:
    """True when at least one flat sits in this block."""
    return db.query(Flat.flat_id).filter(Flat.block == block).first() is not None


# ── Alert ─────────────────────────────────────────────────────────────────────

def create_alert(
    db: Session,
    title: str,
    message: str,
    severity: str,
    target_block: str | None,
    raised_by: str | None,
) -> Alert:
    alert = Alert(
        title=title,
        message=message,
        severity=severity,
        target_block=target_block,
        raised_by=raised_by,
    )
    db.add(alert)
    # Flush (not commit) so alert_id is populated for the delivery rows while
    # the whole broadcast stays inside one transaction - a failure part-way
    # through the fan-out must not leave an alert with a half-written log.
    db.flush()
    return alert


def get_alert(db: Session, alert_id: str) -> Alert | None:
    return _alert_query(db).filter(Alert.alert_id == alert_id).first()


def list_alerts(db: Session, limit: int, severity: str | None = None) -> list[Alert]:
    """Alerts newest-first, without their delivery rows (see AlertSummaryOut)."""
    query = db.query(Alert)
    if severity is not None:
        query = query.filter(Alert.severity == severity)
    return query.order_by(Alert.created_at.desc()).limit(limit).all()


# ── AlertDelivery ─────────────────────────────────────────────────────────────

def create_delivery(
    db: Session,
    alert_id: str,
    resident_id: str,
    recipient_name: str | None,
    recipient_phone: str | None,
    flat_number: str | None,
    channel: str,
    status: str,
    failure_reason: str | None,
    delivered_at,
) -> AlertDelivery:
    delivery = AlertDelivery(
        alert_id=alert_id,
        resident_id=resident_id,
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        flat_number=flat_number,
        channel=channel,
        status=status,
        failure_reason=failure_reason,
        delivered_at=delivered_at,
    )
    db.add(delivery)
    return delivery


def get_deliveries(db: Session, alert_id: str, status: str | None = None) -> list[AlertDelivery]:
    """The delivery log for one alert, optionally filtered to a single status."""
    query = db.query(AlertDelivery).filter(AlertDelivery.alert_id == alert_id)
    if status is not None:
        query = query.filter(AlertDelivery.status == status)
    return query.order_by(AlertDelivery.recipient_name).all()
