"""Service layer for the Payment Reminders module (BE-12)."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import reminders as crud
from app.crud import payments as payment_crud
from app.crud import residents as resident_crud
from app.models.reminder import PaymentReminder
from app.schemas.reminder import (
    ReminderCreate,
    ReminderListResponse,
    ReminderOut,
    ReminderStats,
)

# Bill statuses that warrant a reminder
REMINDABLE_STATUSES = {"pending", "overdue", "partially_paid"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_reminder_or_404(db: Session, reminder_id: str) -> PaymentReminder:
    reminder = crud.get_reminder(db, reminder_id)
    if not reminder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reminder '{reminder_id}' not found.",
        )
    return reminder


# ── Send reminder ─────────────────────────────────────────────────────────────

def send_reminder(db: Session, data: ReminderCreate) -> ReminderOut:
    """
    Send a payment reminder.

    Validations (in order):
      1. Bill must exist.
      2. Resident must exist.
      3. Bill must belong to the given resident.
      4. Bill must be in a remindable state (pending / overdue / partially_paid).
      5. No active (sent) reminder of the same type already exists for this bill.
    """
    bill = payment_crud.get_bill(db, data.bill_id)
    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bill '{data.bill_id}' not found.",
        )

    resident = resident_crud.get_resident(db, data.resident_id)
    if not resident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{data.resident_id}' not found.",
        )

    if bill.resident_id != data.resident_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bill does not belong to the specified resident.",
        )

    if bill.status not in REMINDABLE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Cannot send a reminder for a bill with status '{bill.status}'. "
                f"Only {sorted(REMINDABLE_STATUSES)} bills can be reminded."
            ),
        )

    existing = crud.get_active_reminder_for_bill_and_type(
        db, data.bill_id, data.reminder_type.value
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"An active '{data.reminder_type.value}' reminder already exists "
                f"for bill '{data.bill_id}'. Dismiss it before sending another."
            ),
        )

    reminder = crud.create_reminder(db, data)
    db.commit()
    db.refresh(reminder)
    return ReminderOut.model_validate(reminder)


# ── Dismiss ───────────────────────────────────────────────────────────────────

def dismiss_reminder(db: Session, reminder_id: str) -> ReminderOut:
    reminder = _get_reminder_or_404(db, reminder_id)

    if reminder.status == "dismissed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reminder has already been dismissed.",
        )

    crud.dismiss_reminder(db, reminder)
    db.commit()
    db.refresh(reminder)
    return ReminderOut.model_validate(reminder)


# ── List ──────────────────────────────────────────────────────────────────────

def list_reminders(
    db: Session,
    resident_id: str | None = None,
    bill_id: str | None = None,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> ReminderListResponse:
    if resident_id:
        items = crud.list_by_resident(db, resident_id, skip=skip, limit=limit)
    elif bill_id:
        items = crud.list_by_bill(db, bill_id)
    else:
        items = crud.list_reminders(db, status=status_filter, skip=skip, limit=limit)

    return ReminderListResponse(
        total=len(items),
        items=[ReminderOut.model_validate(r) for r in items],
    )


# ── Get single ────────────────────────────────────────────────────────────────

def get_reminder(db: Session, reminder_id: str) -> ReminderOut:
    reminder = _get_reminder_or_404(db, reminder_id)
    return ReminderOut.model_validate(reminder)


# ── Statistics ────────────────────────────────────────────────────────────────

def get_stats(db: Session) -> ReminderStats:
    status_counts = dict(crud.get_status_counts(db))
    type_counts   = dict(crud.get_type_counts(db))
    channel_counts = dict(crud.get_channel_counts(db))

    return ReminderStats(
        total=sum(status_counts.values()),
        sent=status_counts.get("sent", 0),
        dismissed=status_counts.get("dismissed", 0),
        failed=status_counts.get("failed", 0),
        by_type=type_counts,
        by_channel=channel_counts,
    )
