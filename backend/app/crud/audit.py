"""
CRUD operations for the Audit Log module (BE-39).

Only a create and a filtered read are exposed here - no update or delete,
since audit entries must stay immutable once written (see app/models/audit.py).
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.schemas.audit import AuditLogCreate


def create_audit_log(db: Session, data: AuditLogCreate) -> AuditLog:
    log = AuditLog(**data.model_dump())
    db.add(log)
    return log


def list_audit_logs(
    db: Session,
    module: str | None = None,
    action: str | None = None,
    actor_id: str | None = None,
    target_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[AuditLog], int]:
    """Returns (rows for the requested page, total matching rows)."""
    query = db.query(AuditLog)
    if module:
        query = query.filter(AuditLog.module == module)
    if action:
        query = query.filter(AuditLog.action == action)
    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)
    if target_id:
        query = query.filter(AuditLog.target_id == target_id)
    if date_from:
        query = query.filter(AuditLog.timestamp >= date_from)
    if date_to:
        query = query.filter(AuditLog.timestamp <= date_to)

    total = query.count()
    rows = (
        query.order_by(AuditLog.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    return rows, total
