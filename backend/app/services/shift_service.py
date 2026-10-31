"""Service layer for the Staff Attendance & Shift module (BE-35)."""

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import complaints as staff_crud
from app.crud import shifts as crud
from app.schemas.shift import AttendanceCreate, AttendanceOut, ShiftCreate, ShiftOut


def _get_staff_or_404(db: Session, staff_id: str):
    staff = staff_crud.get_staff(db, staff_id)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staff member '{staff_id}' not found.",
        )
    return staff


def _overlaps(a_start, a_end, b_start, b_end) -> bool:
    """Two half-open time ranges overlap iff each starts before the other ends."""
    return a_start < b_end and b_start < a_end


# ── Shift allocation ─────────────────────────────────────────────────────────

def allocate_shift(db: Session, data: ShiftCreate) -> ShiftOut:
    """
    Allocate a shift to a staff member (BE-35).

    Errors:
      404 - staff member does not exist
      409 - this shift overlaps an existing shift already allocated to the
            same staff member on the same day
      422 - end_time is not after start_time (Pydantic)
    """
    _get_staff_or_404(db, data.staff_id)

    existing = crud.get_shifts_for_staff_on_date(db, data.staff_id, data.shift_date)
    for other in existing:
        if _overlaps(data.start_time, data.end_time, other.start_time, other.end_time):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Shift {data.start_time}-{data.end_time} on {data.shift_date} conflicts "
                    f"with an existing shift {other.start_time}-{other.end_time} "
                    f"for staff member '{data.staff_id}'."
                ),
            )

    shift = crud.create_shift(db, data)
    db.commit()
    db.refresh(shift)
    return ShiftOut.model_validate(shift)


def list_shifts(
    db: Session,
    staff_id: str | None = None,
    shift_date: date | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[ShiftOut]:
    rows = crud.list_shifts(db, staff_id=staff_id, shift_date=shift_date, skip=skip, limit=limit)
    return [ShiftOut.model_validate(row) for row in rows]


# ── Attendance ────────────────────────────────────────────────────────────────

def mark_attendance(db: Session, data: AttendanceCreate) -> AttendanceOut:
    """
    Record a staff member's attendance for a single day (BE-35).

    Errors:
      404 - staff member does not exist, or shift_id does not exist
      400 - shift_id belongs to a different staff member
      409 - attendance has already been marked for this staff member on
            this date
      422 - status is not one of the allowed values (Pydantic)
    """
    _get_staff_or_404(db, data.staff_id)

    if data.shift_id:
        shift = crud.get_shift(db, data.shift_id)
        if not shift:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Shift '{data.shift_id}' not found.",
            )
        if shift.staff_id != data.staff_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Shift '{data.shift_id}' does not belong to staff member '{data.staff_id}'.",
            )

    if crud.get_attendance_for_staff_on_date(db, data.staff_id, data.attendance_date):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Attendance for staff member '{data.staff_id}' on "
                f"{data.attendance_date} has already been recorded."
            ),
        )

    attendance = crud.create_attendance(db, data)
    db.commit()
    db.refresh(attendance)
    return AttendanceOut.model_validate(attendance)


def list_attendance(
    db: Session,
    staff_id: str | None = None,
    status_filter: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[AttendanceOut]:
    rows = crud.list_attendance(
        db,
        staff_id=staff_id,
        status=status_filter,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )
    return [AttendanceOut.model_validate(row) for row in rows]
