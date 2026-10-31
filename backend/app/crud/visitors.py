"""
CRUD operations for the Visitors module (BE-05).

create_visitor() exists for tests and other services - the public "raise a
visitor request" endpoint belongs to BE-04.
"""

from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.resident import Resident
from app.models.visitor import Visitor
from app.schemas.visitor import VisitorCreate

# Every read path eager-loads resident (+ their flat) so the service layer
# can resolve resident_name / flat_number without an N+1 query per visitor.
_WITH_RESIDENT = (joinedload(Visitor.resident).joinedload(Resident.flat),)


def get_visitor(db: Session, visitor_id: str) -> Visitor | None:
    return (
        db.query(Visitor)
        .options(*_WITH_RESIDENT)
        .filter(Visitor.visitor_id == visitor_id)
        .first()
    )


def get_visitors_by_resident(db: Session, resident_id: str) -> list[Visitor]:
    return (
        db.query(Visitor)
        .options(*_WITH_RESIDENT)
        .filter(Visitor.resident_id == resident_id)
        .order_by(Visitor.requested_at.desc())
        .all()
    )


def get_visitor_by_pass_code(db: Session, pass_code: str) -> Visitor | None:
    return (
        db.query(Visitor)
        .options(*_WITH_RESIDENT)
        .filter(Visitor.pass_code == pass_code)
        .first()
    )


def list_visitors(
    db: Session,
    resident_id: str | None = None,
    status: str | None = None,
    purpose: str | None = None,
    gate: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Visitor]:
    """Filterable visitor history (BE-25). All filters are optional and AND-ed."""
    query = db.query(Visitor).options(*_WITH_RESIDENT)
    if resident_id:
        query = query.filter(Visitor.resident_id == resident_id)
    if status:
        query = query.filter(Visitor.status == status)
    if purpose:
        query = query.filter(Visitor.purpose == purpose)
    if gate:
        query = query.filter(Visitor.gate == gate)
    if date_from:
        query = query.filter(Visitor.requested_at >= date_from)
    if date_to:
        query = query.filter(Visitor.requested_at <= date_to)
    return (
        query.order_by(Visitor.requested_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_visitor(db: Session, data: VisitorCreate) -> Visitor:
    visitor = Visitor(**data.model_dump())
    db.add(visitor)
    return visitor


def record_decision(
    db: Session,
    visitor: Visitor,
    decision: str,
    decided_by: str | None,
    notes: str | None,
    decided_at: datetime,
    collected_by: str | None = None,
    pickup_location: str | None = None,
) -> Visitor:
    """
    Stamp the decision onto the visitor row.

    Both `status` and `decision` are written: status drives the UI filters and
    later lifecycle changes, decision is the permanent record of what the
    resident chose.
    """
    visitor.status = decision
    visitor.decision = decision
    visitor.decided_by = decided_by
    visitor.decided_at = decided_at
    visitor.decision_notes = notes

    if collected_by is not None:
        visitor.collected_by = collected_by
    if pickup_location is not None:
        visitor.pickup_location = pickup_location

    db.add(visitor)
    return visitor


# ── Report aggregates (BE-36) ───────────────────────────────────────────────────

def _in_range(db: Session, date_from: datetime, date_to: datetime):
    return db.query(Visitor).filter(
        Visitor.requested_at >= date_from, Visitor.requested_at <= date_to
    )


def get_total_count(db: Session, date_from: datetime, date_to: datetime) -> int:
    return _in_range(db, date_from, date_to).with_entities(func.count(Visitor.visitor_id)).scalar()


def get_status_counts(db: Session, date_from: datetime, date_to: datetime) -> list[tuple[str, int]]:
    return (
        _in_range(db, date_from, date_to)
        .with_entities(Visitor.status, func.count(Visitor.visitor_id))
        .group_by(Visitor.status)
        .all()
    )


def get_purpose_counts(db: Session, date_from: datetime, date_to: datetime) -> list[tuple[str, int]]:
    return (
        _in_range(db, date_from, date_to)
        .with_entities(Visitor.purpose, func.count(Visitor.visitor_id))
        .group_by(Visitor.purpose)
        .all()
    )
