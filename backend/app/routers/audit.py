"""
FastAPI router for the Audit Log module (BE-39).

There is no POST /audit - entries are written only by trusted server-side
calls to audit_service.log_action() from within other services' own
transactions. A public write endpoint would let any caller forge audit
history.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db, require_roles
from app.schemas.audit import AuditLogListResponse
from app.services import audit_service as service

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get(
    "",
    response_model=AuditLogListResponse,
    summary="List audit log entries",
    description=(
        "Returns audit entries newest-first, paginated. All filters are "
        "optional and combinable. Admin-only - requires a valid Bearer "
        "token for a user with the admin role."
    ),
    responses={
        200: {"description": "Audit log returned successfully"},
        401: {"description": "Missing or invalid Bearer token"},
        403: {"description": "Authenticated but not an admin"},
        422: {"description": "date_from is later than date_to"},
    },
)
def list_audit_logs(
    module: str | None = Query(None, description="Filter by module, e.g. 'temple'"),
    action: str | None = Query(None, description="Filter by action, e.g. 'seva_booking_created'"),
    actor_id: str | None = Query(None, description="Filter by who performed the action"),
    target_id: str | None = Query(None, description="Filter by the entity acted on"),
    date_from: datetime | None = Query(None, description="Only entries at/after this timestamp"),
    date_to: datetime | None = Query(None, description="Only entries at/before this timestamp"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: object = Depends(require_roles("admin")),
):
    return service.get_audit_logs(
        db, module, action, actor_id, target_id, date_from, date_to, page, page_size
    )
