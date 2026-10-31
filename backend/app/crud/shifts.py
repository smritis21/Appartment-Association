"""CRUD operations for the Staff Attendance & Shift module (BE-35)."""

from datetime import date

from sqlalchemy.orm import Session

from app.models.shift import StaffAttendance, StaffShift
from app.schemas.shift import AttendanceCreate, ShiftCreate


# ── Shifts ────────────────────────────────────────────────────────────────────

def get_shift(db: Session, shift_id: str) -> StaffShift | None:
    return db.query(StaffShift).filter(StaffShift.shift_id == shift_id).first()


def get_shifts_for_staff_on_date(db: Session, staff_id: str, shift_date: date) -> list[StaffShift]:
    return (
        db.query(StaffShift)
        .filter(StaffShift.staff_id == staff_id, StaffShift.shift_date == shift_date)
        .all()
    )


def create_shift(db: Session, data: ShiftCreate) -> StaffShift:
    shift = StaffShift(**data.model_dump())
    db.add(shift)
    return shift


def list_shifts(
    db: Session,
    staff_id: str | None = None,
    shift_date: date | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[StaffShift]:
    query = db.query(StaffShift)
    if staff_id:
        query = query.filter(StaffShift.staff_id == staff_id)
    if shift_date:
        query = query.filter(StaffShift.shift_date == shift_date)
    return (
        query.order_by(StaffShift.shift_date.desc(), StaffShift.start_time)
        .offset(skip)
        .limit(limit)
        .all()
    )


# ── Attendance ────────────────────────────────────────────────────────────────

def get_attendance(db: Session, attendance_id: str) -> StaffAttendance | None:
    return db.query(StaffAttendance).filter(StaffAttendance.attendance_id == attendance_id).first()


def get_attendance_for_staff_on_date(
    db: Session, staff_id: str, attendance_date: date
) -> StaffAttendance | None:
    return (
        db.query(StaffAttendance)
        .filter(
            StaffAttendance.staff_id == staff_id,
            StaffAttendance.attendance_date == attendance_date,
        )
        .first()
    )


def create_attendance(db: Session, data: AttendanceCreate) -> StaffAttendance:
    attendance = StaffAttendance(**data.model_dump())
    db.add(attendance)
    return attendance


def list_attendance(
    db: Session,
    staff_id: str | None = None,
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[StaffAttendance]:
    query = db.query(StaffAttendance)
    if staff_id:
        query = query.filter(StaffAttendance.staff_id == staff_id)
    if status:
        query = query.filter(StaffAttendance.status == status)
    if date_from:
        query = query.filter(StaffAttendance.attendance_date >= date_from)
    if date_to:
        query = query.filter(StaffAttendance.attendance_date <= date_to)
    return (
        query.order_by(StaffAttendance.attendance_date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
