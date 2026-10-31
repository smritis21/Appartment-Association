"""
FastAPI router for the Staff module (BE-15, BE-35).

Business logic for workload lives in complaint_service.py (derived entirely
from Complaint.assigned_to/status); shift and attendance logic lives in
shift_service.py. This file is just the URL/HTTP surface for /staff.
"""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.complaint import StaffWorkloadOut
from app.schemas.shift import AttendanceCreate, AttendanceOut, ShiftCreate, ShiftOut
from app.services import complaint_service
from app.services import shift_service

router = APIRouter(prefix="/staff", tags=["Staff"])


@router.get(
    "/workload",
    response_model=list[StaffWorkloadOut],
    summary="Staff workload",
    description=(
        "Returns assigned (currently open) and completed complaint counts "
        "for every staff member, derived from complaint assignments. "
        "Staff members with no assignments yet are included with zero counts."
    ),
    responses={200: {"description": "Workload returned successfully"}},
)
def get_staff_workload(db: Session = Depends(get_db)):
    return complaint_service.get_staff_workload(db)


@router.post(
    "/shifts",
    response_model=ShiftOut,
    status_code=201,
    summary="Allocate a shift",
    description=(
        "Allocates a shift to a staff member on a given date. Rejects a shift "
        "that overlaps another shift already allocated to the same staff "
        "member on the same day."
    ),
    responses={
        201: {"description": "Shift allocated"},
        404: {"description": "Staff member not found"},
        409: {"description": "Shift overlaps an existing shift for this staff member"},
        422: {"description": "Validation error - end_time not after start_time"},
    },
)
def allocate_shift(data: ShiftCreate, db: Session = Depends(get_db)):
    return shift_service.allocate_shift(db, data)


@router.get(
    "/shifts",
    response_model=list[ShiftOut],
    summary="List shifts",
    description="Returns allocated shifts, newest date first. Optionally filter by staff member and/or date.",
)
def list_shifts(
    staff_id: str | None = Query(None, description="Only return shifts for this staff member"),
    shift_date: date | None = Query(None, description="Only return shifts on this date"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return shift_service.list_shifts(db, staff_id=staff_id, shift_date=shift_date, skip=skip, limit=limit)


@router.post(
    "/attendance",
    response_model=AttendanceOut,
    status_code=201,
    summary="Record daily attendance",
    description=(
        "Records a staff member's attendance for a single day. Exactly one "
        "attendance record is allowed per staff member per date - a second "
        "call for the same day returns 409."
    ),
    responses={
        201: {"description": "Attendance recorded"},
        400: {"description": "shift_id does not belong to this staff member"},
        404: {"description": "Staff member or shift not found"},
        409: {"description": "Attendance already recorded for this staff member on this date"},
        422: {"description": "Validation error - status not one of the allowed values"},
    },
)
def mark_attendance(data: AttendanceCreate, db: Session = Depends(get_db)):
    return shift_service.mark_attendance(db, data)


@router.get(
    "/attendance",
    response_model=list[AttendanceOut],
    summary="List attendance records",
    description=(
        "Returns attendance records, newest date first. Optionally filter by "
        "staff member, status, and/or a date range."
    ),
)
def list_attendance(
    staff_id: str | None = Query(None, description="Only return records for this staff member"),
    status: str | None = Query(None, description="present / absent / half_day / on_leave"),
    date_from: date | None = Query(None, description="Only records on/after this date"),
    date_to: date | None = Query(None, description="Only records on/before this date"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return shift_service.list_attendance(
        db, staff_id=staff_id, status_filter=status, date_from=date_from, date_to=date_to, skip=skip, limit=limit
    )
