"""Service layer for the Audit Log module (BE-39)."""

import math
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import audit as crud
from app.schemas.audit import AuditLogCreate, AuditLogListResponse, AuditLogOut
from app.models.audit import AuditLog


def log_action(
    db: Session,
    *,
    actor_id: str | None,
    actor_role: str | None,
    module: str,
    action: str,
    target_type: str | None = None,
    target_id: str | None = None,
    description: str | None = None,
) -> AuditLog:
    """Record an audit entry. Does not commit - callers invoke this
    mid-transaction so the audit row lands in the same commit as the
    action it describes and can never drift out of sync."""
    data = AuditLogCreate(
        actor_id=actor_id,
        actor_role=actor_role,
        module=module,
        action=action,
        target_type=target_type,
        target_id=target_id,
        description=description,
    )
    return crud.create_audit_log(db, data)


def get_audit_logs(
    db: Session,
    module: str | None = None,
    action: str | None = None,
    actor_id: str | None = None,
    target_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    page_size: int = 20,
) -> AuditLogListResponse:
    """
    Errors:
      422 - date_from is later than date_to
    """
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from must not be later than date_to.",
        )

    rows, total = crud.list_audit_logs(
        db, module, action, actor_id, target_id, date_from, date_to, page, page_size
    )
    pages = math.ceil(total / page_size) if total else 0
    return AuditLogListResponse(
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
        items=[AuditLogOut.model_validate(row) for row in rows],
    )
