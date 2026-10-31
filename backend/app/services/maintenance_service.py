"""Service layer for the Maintenance Scheduling module (BE-17)."""

from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import maintenance as crud
from app.models.complaint import Staff
from app.schemas.complaint import StaffOut
from app.schemas.maintenance import (
    MaintenanceScheduleCreate, MaintenanceScheduleOut,
    WorkOrderCreate, WorkOrderAssign, WorkOrderStatusUpdate, WorkOrderOut, WorkOrderStatsOut,
    _WO_FLOW,
)
from app.services import audit_service


def create_schedule(db: Session, data: MaintenanceScheduleCreate) -> MaintenanceScheduleOut:
    schedule = crud.create_schedule(db, data)
    db.commit()
    db.refresh(schedule)
    return MaintenanceScheduleOut.model_validate(schedule)


def list_schedules(db: Session) -> list[MaintenanceScheduleOut]:
    schedules = crud.get_schedules(db)
    return [MaintenanceScheduleOut.model_validate(s) for s in schedules]


def get_schedule(db: Session, schedule_id: str) -> MaintenanceScheduleOut:
    schedule = crud.get_schedule(db, schedule_id)
    if not schedule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Maintenance schedule '{schedule_id}' not found.",
        )
    return MaintenanceScheduleOut.model_validate(schedule)


# ── WorkOrder service (BE-24) ─────────────────────────────────────────────────────────

def _to_out(wo) -> WorkOrderOut:
    out = WorkOrderOut.model_validate(wo)
    today = date.today()
    out.is_overdue = (
        wo.status != "completed"
        and wo.due_date is not None
        and wo.due_date < today
    )
    return out


def _get_wo_or_404(db: Session, work_order_id: str):
    wo = crud.get_work_order(db, work_order_id)
    if not wo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Work order '{work_order_id}' not found.",
        )
    return wo


def _get_staff_or_404(db: Session, staff_id: str) -> Staff:
    staff = db.query(Staff).filter(Staff.staff_id == staff_id).first()
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staff member '{staff_id}' not found.",
        )
    return staff


def create_work_order(db: Session, data: WorkOrderCreate, current_user) -> WorkOrderOut:
    if data.assigned_to:
        _get_staff_or_404(db, data.assigned_to)
    wo = crud.create_work_order(db, data, created_by=current_user.user_id)
    db.flush()
    audit_service.log_action(
        db,
        actor_id=current_user.user_id,
        actor_role=current_user.role,
        module="maintenance",
        action="work_order_created",
        target_type="work_order",
        target_id=wo.work_order_id,
        description=f"Work order created: {wo.title}",
    )
    db.commit()
    db.refresh(wo)
    return _to_out(wo)


def list_work_orders(
    db: Session,
    status: str | None = None,
    type_: str | None = None,
    priority: str | None = None,
    assigned_to: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[WorkOrderOut]:
    wos = crud.list_work_orders(db, status=status, type_=type_, priority=priority,
                                assigned_to=assigned_to, skip=skip, limit=limit)
    return [_to_out(wo) for wo in wos]


def get_work_order(db: Session, work_order_id: str) -> WorkOrderOut:
    wo = _get_wo_or_404(db, work_order_id)
    return _to_out(wo)


def assign_work_order(db: Session, work_order_id: str, data: WorkOrderAssign, current_user) -> WorkOrderOut:
    wo = _get_wo_or_404(db, work_order_id)
    _get_staff_or_404(db, data.staff_id)
    crud.update_work_order(db, wo, assigned_to=data.staff_id,
                           status="assigned" if wo.status == "open" else wo.status)
    audit_service.log_action(
        db,
        actor_id=current_user.user_id,
        actor_role=current_user.role,
        module="maintenance",
        action="work_order_assigned",
        target_type="work_order",
        target_id=wo.work_order_id,
        description=f"Assigned to staff {data.staff_id}",
    )
    db.commit()
    db.refresh(wo)
    return _to_out(wo)


def update_work_order_status(
    db: Session, work_order_id: str, data: WorkOrderStatusUpdate, current_user
) -> WorkOrderOut:
    wo = _get_wo_or_404(db, work_order_id)

    current_idx = _WO_FLOW.index(wo.status)
    new_idx     = _WO_FLOW.index(data.status)
    if new_idx != current_idx + 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Invalid transition: '{wo.status}' → '{data.status}'. "
                f"Expected next status: '{_WO_FLOW[current_idx + 1] if current_idx + 1 < len(_WO_FLOW) else 'none (already completed)'}'"
            ),
        )

    if data.status == "completed" and not data.outcome:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An outcome note is required when completing a work order.",
        )

    updates = {"status": data.status}
    if data.outcome:
        updates["outcome"] = data.outcome
    if data.status == "completed":
        updates["completed_at"] = datetime.now(timezone.utc).replace(tzinfo=None)

    crud.update_work_order(db, wo, **updates)
    audit_service.log_action(
        db,
        actor_id=current_user.user_id,
        actor_role=current_user.role,
        module="maintenance",
        action=f"work_order_{data.status}",
        target_type="work_order",
        target_id=wo.work_order_id,
        description=f"Status updated to '{data.status}'",
    )
    db.commit()
    db.refresh(wo)
    return _to_out(wo)


def get_asset_history(db: Session, asset_id: str) -> list[WorkOrderOut]:
    wos = crud.get_work_orders_by_asset(db, asset_id)
    return [_to_out(wo) for wo in wos]


def get_board_stats(db: Session) -> WorkOrderStatsOut:
    stats = crud.get_board_stats(db, today=date.today())
    return WorkOrderStatsOut(
        total=stats["total"],
        open=stats["open"],
        overdue=stats["overdue"],
        completed=stats["completed"],
    )
