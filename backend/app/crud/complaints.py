"""
CRUD operations for the Complaints & Staff module (BE-06, BE-07, BE-15, BE-16).

create_complaint()/create_staff() exist for tests and other services - the
public "raise a complaint" / "add staff" endpoints belong to other tickets
(BE-01 and staff onboarding respectively).
"""

from collections.abc import Iterable
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.complaint import (
    Complaint,
    ComplaintFeedback,
    ComplaintProgressLog,
    Staff,
)
from app.schemas.complaint import ComplaintCreate, StaffCreate


def _complaint_query(db: Session):
    """Base query with the assigned staff, audit trail and feedback eagerly loaded."""
    return db.query(Complaint).options(
        joinedload(Complaint.assigned_staff),
        joinedload(Complaint.progress_logs).joinedload(ComplaintProgressLog.employee),
        joinedload(Complaint.feedback),
    )


# ── Complaint ─────────────────────────────────────────────────────────────────

def get_complaint(db: Session, complaint_id: str) -> Complaint | None:
    return _complaint_query(db).filter(Complaint.complaint_id == complaint_id).first()


def _next_reference(db: Session) -> str:
    """
    The next human reference, numbered per calendar year: CMP-2026-0001.

    Counting the year's rows is enough for a society's volume; it is not
    safe against two inserts racing, which would need a dedicated counter.
    """
    year = datetime.now(timezone.utc).year
    prefix = f"CMP-{year}-"
    used = (
        db.query(Complaint.reference)
        .filter(Complaint.reference.like(f"{prefix}%"))
        .count()
    )
    return f"{prefix}{used + 1:04d}"


def create_complaint(db: Session, data: ComplaintCreate) -> Complaint:
    # `image` is the inline upload (EN-01), not a column on the row - the
    # service validates it and sets image_reference. Everything else maps 1:1.
    complaint = Complaint(**data.model_dump(exclude={"image"}))
    complaint.reference = _next_reference(db)
    db.add(complaint)
    return complaint


# ── Staff ─────────────────────────────────────────────────────────────────────

def get_staff(db: Session, staff_id: str) -> Staff | None:
    return db.query(Staff).filter(Staff.staff_id == staff_id).first()


def get_all_staff(db: Session) -> list[Staff]:
    return db.query(Staff).all()


def create_staff(db: Session, data: StaffCreate) -> Staff:
    staff = Staff(**data.model_dump())
    db.add(staff)
    return staff


def get_assignment_status_counts(db: Session) -> list[tuple[str, str, int]]:
    """
    (staff_id, status, count) for every complaint that has been assigned to
    someone - the raw material for BE-15's per-staff workload aggregation.
    """
    return (
        db.query(Complaint.assigned_to, Complaint.status, func.count(Complaint.complaint_id))
        .filter(Complaint.assigned_to.isnot(None))
        .group_by(Complaint.assigned_to, Complaint.status)
        .all()
    )


# ── ComplaintProgressLog (BE-16) ───────────────────────────────────────────────

def create_progress_log(
    db: Session,
    complaint_id: str,
    employee_id: str | None,
    status: str,
    notes: str | None,
) -> ComplaintProgressLog:
    log = ComplaintProgressLog(
        complaint_id=complaint_id,
        employee_id=employee_id,
        status=status,
        notes=notes,
    )
    db.add(log)
    return log


def get_latest_progress_log(
    db: Session,
    complaint_id: str,
    status: str | None = None,
) -> ComplaintProgressLog | None:
    """Return the newest status-history row, optionally for one status."""
    query = db.query(ComplaintProgressLog).filter(
        ComplaintProgressLog.complaint_id == complaint_id
    )
    if status is not None:
        query = query.filter(ComplaintProgressLog.status == status)
    return query.order_by(ComplaintProgressLog.updated_at.desc()).first()


def get_complaints_by_resident(db: Session, resident_id: str) -> list[Complaint]:
    """Full complaint history for one resident, newest complaint first."""
    return (
        _complaint_query(db)
        .filter(Complaint.raised_by == resident_id)
        .order_by(Complaint.created_at.desc(), Complaint.complaint_id.desc())
        .all()
    )


def get_complaints_by_resident_page(
    db: Session, resident_id: str, skip: int = 0, limit: int = 20
) -> tuple[int, list[Complaint]]:
    """
    One page of a resident's complaint history plus the total count (BE-10 /
    EN-10). Ordering matches get_complaints_by_resident exactly - newest first,
    with complaint_id as a deterministic tiebreak so two complaints created in
    the same instant never swap places between pages.

    The total is counted on a lightweight id-only query (no eager loads), so
    pagination metadata does not pull every row it is counting.
    """
    total = (
        db.query(Complaint.complaint_id)
        .filter(Complaint.raised_by == resident_id)
        .count()
    )
    items = (
        _complaint_query(db)
        .filter(Complaint.raised_by == resident_id)
        .order_by(Complaint.created_at.desc(), Complaint.complaint_id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return total, items


# ── Filtered query (BE-14) ───────────────────────────────────────────────────

def get_complaints_filtered(
    db: Session,
    status: str | None = None,
    category: str | None = None,
    assigned_to: str | None = None,
    raised_by: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[int, list[Complaint]]:
    """
    Returns (total_count, page_of_complaints) matching the given filters.
    total_count is the count before pagination so callers can compute page totals.
    Reuses _complaint_query() so assigned_staff is eagerly loaded.
    """
    q = _complaint_query(db)
    if status:
        q = q.filter(Complaint.status == status)
    if category:
        q = q.filter(Complaint.category == category)
    if assigned_to:
        q = q.filter(Complaint.assigned_to == assigned_to)
    if raised_by:
        q = q.filter(Complaint.raised_by == raised_by)
    if date_from:
        q = q.filter(Complaint.created_at >= date_from)
    if date_to:
        q = q.filter(Complaint.created_at <= date_to)

    total = db.scalar(select(func.count()).select_from(
        db.query(Complaint.complaint_id)
        .filter(*[
            Complaint.status == status if status else True,
            Complaint.category == category if category else True,
            Complaint.assigned_to == assigned_to if assigned_to else True,
            Complaint.raised_by == raised_by if raised_by else True,
            Complaint.created_at >= date_from if date_from else True,
            Complaint.created_at <= date_to if date_to else True,
        ])
        .subquery()
    ))
    items = q.order_by(Complaint.created_at.desc()).offset(skip).limit(limit).all()
    return total, items


# ── Dashboard stats (BE-07) ────────────────────────────────────────────────────
# These return raw aggregates only. Bucketing (pending/ongoing/completed) and
# month grouping happen in the service layer - grouping by month in SQL would
# need dialect-specific date functions (strftime on SQLite, to_char on
# PostgreSQL), and complaint volume for a single society is small enough that
# pulling timestamps and bucketing them in Python costs nothing.


def get_status_counts(db: Session) -> list[tuple[str, int]]:
    """(status, count) across every complaint on record."""
    return (
        db.query(Complaint.status, func.count(Complaint.complaint_id))
        .group_by(Complaint.status)
        .all()
    )


def get_category_counts(db: Session) -> list[tuple[str, int]]:
    """(category, count) across every complaint, busiest category first."""
    return (
        db.query(Complaint.category, func.count(Complaint.complaint_id).label("count"))
        .group_by(Complaint.category)
        .order_by(func.count(Complaint.complaint_id).desc(), Complaint.category)
        .all()
    )


def get_created_timestamps(db: Session, since: datetime) -> list[datetime]:
    """created_at for every complaint raised on or after `since`."""
    return [
        row[0]
        for row in db.query(Complaint.created_at)
        .filter(Complaint.created_at >= since)
        .all()
    ]


def get_resolution_timestamps(
    db: Session, completed_statuses: Iterable[str]
) -> list[tuple[datetime, datetime | None, datetime]]:
    """
    (created_at, audit_resolved_at, updated_at) for every complaint currently
    sitting in a completed status.

    `audit_resolved_at` is the earliest progress-log entry that moved the
    complaint into a completed status - the accurate resolution date. It is
    None for complaints that reached a completed status without going through
    the progress endpoint (seed/import data), and the caller falls back to
    `updated_at` for those.

    `created_at` is included so the caller can measure resolution time
    (resolved_at − created_at) without a second query. Statuses are passed in
    by the service so this stays free of business rules.
    """
    completed = list(completed_statuses)

    first_completed_log = (
        db.query(
            ComplaintProgressLog.complaint_id.label("complaint_id"),
            func.min(ComplaintProgressLog.updated_at).label("resolved_at"),
        )
        .filter(ComplaintProgressLog.status.in_(completed))
        .group_by(ComplaintProgressLog.complaint_id)
        .subquery()
    )

    return (
        db.query(
            Complaint.created_at,
            first_completed_log.c.resolved_at,
            Complaint.updated_at,
        )
        .outerjoin(
            first_completed_log,
            first_completed_log.c.complaint_id == Complaint.complaint_id,
        )
        .filter(Complaint.status.in_(completed))
        .all()
    )


def get_resolution_timestamp(
    db: Session, complaint_id: str, completed_statuses: Iterable[str]
) -> datetime | None:
    """
    When one complaint was first moved into a completed status.

    Same rule as get_resolution_timestamps() above, for a single complaint -
    the earliest progress-log entry that moved it to resolved/closed. Returns
    None when no such entry exists, and the caller decides what to fall back
    to. BE-20 anchors its feedback window on this, so the window opens when
    the work was actually finished rather than whenever the row last changed.
    """
    row = (
        db.query(func.min(ComplaintProgressLog.updated_at))
        .filter(
            ComplaintProgressLog.complaint_id == complaint_id,
            ComplaintProgressLog.status.in_(list(completed_statuses)),
        )
        .first()
    )
    return row[0] if row else None


# ── ComplaintFeedback (BE-20) ──────────────────────────────────────────────────

def get_feedback(db: Session, complaint_id: str) -> ComplaintFeedback | None:
    return (
        db.query(ComplaintFeedback)
        .filter(ComplaintFeedback.complaint_id == complaint_id)
        .first()
    )


def create_feedback(
    db: Session,
    complaint_id: str,
    rating: int,
    comment: str | None,
    submitted_by: str | None,
) -> ComplaintFeedback:
    feedback = ComplaintFeedback(
        complaint_id=complaint_id,
        rating=rating,
        comment=comment,
        submitted_by=submitted_by,
    )
    db.add(feedback)
    return feedback
