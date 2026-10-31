"""FastAPI router for the Maintenance Scheduling module (BE-17)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_roles
from app.schemas.maintenance import (
    MaintenanceScheduleCreate, MaintenanceScheduleOut,
    WorkOrderAssign, WorkOrderCreate, WorkOrderOut, WorkOrderStatusUpdate, WorkOrderStatsOut,
)
from app.services import maintenance_service as service

router = APIRouter(prefix="/maintenance", tags=["Maintenance"])


@router.post(
    "/schedule",
    response_model=MaintenanceScheduleOut,
    status_code=201,
    summary="Schedule planned maintenance",
    description="Stores a planned maintenance event - date, time and the facilities it affects.",
    responses={
        201: {"description": "Maintenance scheduled successfully"},
        422: {"description": "Validation error"},
    },
)
def create_schedule(
    data: MaintenanceScheduleCreate,
    db: Session = Depends(get_db),
):
    return service.create_schedule(db, data)


@router.get(
    "/schedule",
    response_model=list[MaintenanceScheduleOut],
    summary="List scheduled maintenance",
    description="Returns all scheduled maintenance events, soonest first.",
    responses={200: {"description": "Scheduled events returned successfully"}},
)
def list_schedules(db: Session = Depends(get_db)):
    return service.list_schedules(db)


@router.get(
    "/schedule/{schedule_id}",
    response_model=MaintenanceScheduleOut,
    summary="Get a scheduled maintenance event",
    responses={
        200: {"description": "Scheduled event returned successfully"},
        404: {"description": "Scheduled event not found"},
    },
)
def get_schedule(schedule_id: str, db: Session = Depends(get_db)):
    return service.get_schedule(db, schedule_id)


# ── Work Orders (BE-24) ───────────────────────────────────────────────────────────────────

@router.post(
    "/work-orders",
    response_model=WorkOrderOut,
    status_code=201,
    summary="Create work order",
    description="Creates a reactive or preventive work order. Optionally assigns to a staff member immediately.",
    responses={201: {"description": "Work order created"}, 404: {"description": "Staff not found"}},
)
def create_work_order(
    data: WorkOrderCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "president", "secretary")),
):
    return service.create_work_order(db, data, current_user)


@router.get(
    "/work-orders/stats",
    response_model=WorkOrderStatsOut,
    summary="Work order board stats",
    description="Returns total, open, overdue, and completed work order counts.",
)
def get_board_stats(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return service.get_board_stats(db)


@router.get(
    "/work-orders",
    response_model=list[WorkOrderOut],
    summary="List work orders",
    description="Paginated work order list. Filter by status, type, priority, or assignee.",
)
def list_work_orders(
    status:      str | None = Query(None, description="open / assigned / in_progress / completed"),
    type:        str | None = Query(None, description="reactive / preventive"),
    priority:    str | None = Query(None, description="low / medium / high / critical"),
    assigned_to: str | None = Query(None, description="staff_id"),
    skip:        int        = Query(0, ge=0),
    limit:       int        = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return service.list_work_orders(db, status=status, type_=type, priority=priority,
                                    assigned_to=assigned_to, skip=skip, limit=limit)


@router.get(
    "/work-orders/{work_order_id}",
    response_model=WorkOrderOut,
    summary="Get work order",
    responses={404: {"description": "Work order not found"}},
)
def get_work_order(
    work_order_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return service.get_work_order(db, work_order_id)


@router.put(
    "/work-orders/{work_order_id}/assign",
    response_model=WorkOrderOut,
    summary="Assign work order",
    description="Assigns a work order to a staff member. Moves status from open → assigned automatically.",
    responses={404: {"description": "Work order or staff not found"}},
)
def assign_work_order(
    work_order_id: str,
    data: WorkOrderAssign,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin", "president", "secretary")),
):
    return service.assign_work_order(db, work_order_id, data, current_user)


@router.put(
    "/work-orders/{work_order_id}/status",
    response_model=WorkOrderOut,
    summary="Update work order status",
    description=(
        "Advances the work order along the lifecycle: open → assigned → in_progress → completed. "
        "Only forward one-step transitions are allowed. Completing requires an outcome note."
    ),
    responses={
        400: {"description": "Invalid transition or missing outcome"},
        404: {"description": "Work order not found"},
    },
)
def update_work_order_status(
    work_order_id: str,
    data: WorkOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.update_work_order_status(db, work_order_id, data, current_user)


@router.get(
    "/assets/{asset_id}/history",
    response_model=list[WorkOrderOut],
    summary="Asset maintenance history",
    description="Returns completed work orders for a given asset, newest first.",
)
def get_asset_history(
    asset_id: str,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    return service.get_asset_history(db, asset_id)
