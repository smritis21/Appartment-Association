"""
FastAPI router for the Payment Reminders module (BE-12).

/stats is declared before /{reminder_id}/... so the parameterised route
cannot swallow the literal path.
"""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.reminder import ReminderCreate, ReminderListResponse, ReminderOut, ReminderStats
from app.services import reminder_service as service

router = APIRouter(prefix="/reminders", tags=["Payment Reminders"])


# ── Stats (declared before /{reminder_id} to avoid path shadowing) ────────────

@router.get(
    "/stats",
    response_model=ReminderStats,
    summary="Reminder statistics",
    description=(
        "Returns aggregate counts of reminders by status, type, and channel. "
        "Always returns 200 - an empty database yields zeroed counts."
    ),
    responses={200: {"description": "Statistics returned successfully"}},
)
def get_stats(db: Session = Depends(get_db)):
    return service.get_stats(db)


# ── Create ────────────────────────────────────────────────────────────────────

@router.post(
    "",
    response_model=ReminderOut,
    status_code=status.HTTP_201_CREATED,
    summary="Send a payment reminder",
    description=(
        "Sends a payment reminder to a resident for a specific bill. "
        "The bill must be in `pending`, `overdue`, or `partially_paid` status. "
        "Duplicate active reminders of the same type for the same bill are rejected (409)."
    ),
    responses={
        201: {"description": "Reminder sent successfully"},
        400: {"description": "Bill not remindable or resident mismatch"},
        404: {"description": "Bill or resident not found"},
        409: {"description": "Duplicate active reminder"},
        422: {"description": "Validation error"},
    },
)
def send_reminder(data: ReminderCreate, db: Session = Depends(get_db)):
    return service.send_reminder(db, data)


# ── List ──────────────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=ReminderListResponse,
    summary="List reminders",
    description=(
        "Returns a paginated list of reminders. "
        "Filter by `resident_id` to get reminders for a specific resident, "
        "by `bill_id` to get reminders for a specific bill, "
        "or by `status` to get sent/dismissed/failed reminders."
    ),
    responses={200: {"description": "Reminders returned successfully"}},
)
def list_reminders(
    resident_id:   str | None = Query(None, description="Filter by resident UUID"),
    bill_id:       str | None = Query(None, description="Filter by bill UUID"),
    status_filter: str | None = Query(
        None, alias="status", description="Filter by status: sent / dismissed / failed"
    ),
    skip:  int = Query(0,  ge=0,         description="Records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Max records to return"),
    db:    Session = Depends(get_db),
):
    return service.list_reminders(
        db,
        resident_id=resident_id,
        bill_id=bill_id,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )


# ── Get single ────────────────────────────────────────────────────────────────

@router.get(
    "/{reminder_id}",
    response_model=ReminderOut,
    summary="Get a reminder",
    description="Returns a single reminder by its UUID.",
    responses={404: {"description": "Reminder not found"}},
)
def get_reminder(reminder_id: str, db: Session = Depends(get_db)):
    return service.get_reminder(db, reminder_id)


# ── Dismiss ───────────────────────────────────────────────────────────────────

@router.put(
    "/{reminder_id}/dismiss",
    response_model=ReminderOut,
    summary="Dismiss a reminder",
    description=(
        "Marks a reminder as dismissed and records the dismissal timestamp. "
        "Returns 400 if the reminder is already dismissed."
    ),
    responses={
        200: {"description": "Reminder dismissed successfully"},
        400: {"description": "Reminder already dismissed"},
        404: {"description": "Reminder not found"},
    },
)
def dismiss_reminder(reminder_id: str, db: Session = Depends(get_db)):
    return service.dismiss_reminder(db, reminder_id)
