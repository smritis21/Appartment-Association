"""CRUD operations for the Maintenance Scheduling module (BE-17)."""

import json
from datetime import date, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.maintenance import MaintenanceSchedule, WorkOrder
from app.schemas.maintenance import MaintenanceScheduleCreate, WorkOrderCreate


def create_schedule(db: Session, data: MaintenanceScheduleCreate) -> MaintenanceSchedule:
    schedule = MaintenanceSchedule(
        title=data.title,
        scheduled_date=data.scheduled_date,
        scheduled_time=data.scheduled_time,
        affected_facilities=json.dumps(data.affected_facilities),
        notes=data.notes,
        scheduled_by=data.scheduled_by,
    )
    db.add(schedule)
    return schedule


def get_schedule(db: Session, schedule_id: str) -> MaintenanceSchedule | None:
    return (
        db.query(MaintenanceSchedule)
        .filter(MaintenanceSchedule.schedule_id == schedule_id)
        .first()
    )


def get_schedules(db: Session) -> list[MaintenanceSchedule]:
    """All scheduled maintenance events, soonest first."""
    return (
        db.query(MaintenanceSchedule)
        .order_by(MaintenanceSchedule.scheduled_date, MaintenanceSchedule.scheduled_time)
        .all()
    )


# ── Report aggregates (BE-36) ───────────────────────────────────────────────────

def get_schedule_counts(db: Session, date_from: date, date_to: date, today: date) -> dict:
    """
    total/upcoming/past counts, scoped to scheduled_date in [date_from, date_to].
    There's no status column on this table (see model docstring) - "upcoming"
    vs "past" is derived from scheduled_date relative to `today`.
    """
    in_range = db.query(MaintenanceSchedule).filter(
        MaintenanceSchedule.scheduled_date >= date_from,
        MaintenanceSchedule.scheduled_date <= date_to,
    )
    total = in_range.with_entities(func.count(MaintenanceSchedule.schedule_id)).scalar()
    upcoming = (
        in_range.filter(MaintenanceSchedule.scheduled_date >= today)
        .with_entities(func.count(MaintenanceSchedule.schedule_id))
        .scalar()
    )
    past = (
        in_range.filter(MaintenanceSchedule.scheduled_date < today)
        .with_entities(func.count(MaintenanceSchedule.schedule_id))
        .scalar()
    )
    return {"total": total, "upcoming": upcoming, "past": past}


# ── WorkOrder CRUD (BE-24) ─────────────────────────────────────────────────────────

def _wo_query(db: Session):
    return db.query(WorkOrder).options(joinedload(WorkOrder.assigned_staff))


def create_work_order(db: Session, data: WorkOrderCreate, created_by: str | None = None) -> WorkOrder:
    initial_status = "assigned" if data.assigned_to else "open"
    wo = WorkOrder(
        title=data.title,
        description=data.description,
        asset_id=data.asset_id,
        type=data.type,
        priority=data.priority,
        status=initial_status,
        assigned_to=data.assigned_to,
        due_date=data.due_date,
        outcome=data.outcome,
        created_by=created_by,
    )
    db.add(wo)
    return wo


def get_work_order(db: Session, work_order_id: str) -> WorkOrder | None:
    return _wo_query(db).filter(WorkOrder.work_order_id == work_order_id).first()


def list_work_orders(
    db: Session,
    status: str | None = None,
    type_: str | None = None,
    priority: str | None = None,
    assigned_to: str | None = None,
    skip: int = 0,
    limit: int = 50,
) -> list[WorkOrder]:
    q = _wo_query(db)
    if status:
        q = q.filter(WorkOrder.status == status)
    if type_:
        q = q.filter(WorkOrder.type == type_)
    if priority:
        q = q.filter(WorkOrder.priority == priority)
    if assigned_to:
        q = q.filter(WorkOrder.assigned_to == assigned_to)
    return q.order_by(WorkOrder.created_at.desc()).offset(skip).limit(limit).all()


def update_work_order(db: Session, wo: WorkOrder, **fields) -> WorkOrder:
    for k, v in fields.items():
        setattr(wo, k, v)
    return wo


def get_work_orders_by_asset(db: Session, asset_id: str) -> list[WorkOrder]:
    """Completed work orders for an asset, newest first."""
    return (
        _wo_query(db)
        .filter(WorkOrder.asset_id == asset_id, WorkOrder.status == "completed")
        .order_by(WorkOrder.completed_at.desc())
        .all()
    )


def get_board_stats(db: Session, today: date) -> dict:
    total     = db.query(func.count(WorkOrder.work_order_id)).scalar()
    open_     = db.query(func.count(WorkOrder.work_order_id)).filter(WorkOrder.status == "open").scalar()
    completed = db.query(func.count(WorkOrder.work_order_id)).filter(WorkOrder.status == "completed").scalar()
    overdue   = (
        db.query(func.count(WorkOrder.work_order_id))
        .filter(
            WorkOrder.status != "completed",
            WorkOrder.due_date != None,  # noqa: E711
            WorkOrder.due_date < today,
        )
        .scalar()
    )
    return {"total": total, "open": open_, "overdue": overdue, "completed": completed}
