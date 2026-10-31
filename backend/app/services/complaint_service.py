"""Service layer for the Complaints module (BE-06, BE-07, BE-15, BE-16, BE-20)."""

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import complaints as crud
from app.models.complaint import Complaint, Staff
from app.utils.images import store_complaint_image, validate_complaint_image
from app.schemas.complaint import (
    CategoryCount,
    CategoryListOut,
    ComplaintAssign,
    ComplaintCreate,
    ComplaintFeedbackCreate,
    ComplaintFeedbackOut,
    ComplaintOut,
    ComplaintProgressUpdate,
    ComplaintReportFilter,
    ComplaintReportItem,
    ComplaintReportResponse,
    ComplaintStatsOut,
    ComplaintStatusOut,
    ComplaintStatusCounts,
    ComplaintStatusUpdate,
    StaffWorkloadOut,
    TrendPoint,
)

# ── Status buckets (BE-07, BE-15) ──────────────────────────────────────────────
# The three buckets the dashboard reports on. A complaint only ever has
# assigned_to set once it's past "submitted" (see assign_complaint below), so
# "pending" never appears in workload data - BE-15 only uses the last two.
PENDING_STATUSES = {"submitted"}
ONGOING_STATUSES = {"assigned", "in_progress"}
COMPLETED_STATUSES = {"resolved", "closed"}

# Default and maximum size of the trend window, in months. 6 months fills the
# dashboard chart without making the axis unreadable; the cap stops a caller
# from asking for an unbounded range.
DEFAULT_TREND_MONTHS = 6
MAX_TREND_MONTHS = 24

# ── Feedback window (BE-20 / EN-20) ────────────────────────────────────────────
# How long after a complaint is resolved a resident can still rate it.
# 7 days keeps the rating tied to a fresh memory of the work while still giving
# someone a full week to respond. Measured from the resolution date (see
# _resolution_date below), not from whenever the row last changed - the whole
# endpoint, docs, and error messages read this one constant, so the window can
# be retuned in a single place.
FEEDBACK_WINDOW_DAYS = 7

# ── Status state machine (BE-16 / EN-02) ───────────────────────────────────────
# This table is the single source of truth for every legal status change, shared
# by both the BE-02 /status endpoint and the BE-16 /progress endpoint. Anything
# not listed here is rejected with a clear 400 (see _validate_transition).
#
# Forward flow: submitted -> assigned -> in_progress -> resolved -> closed.
#
# Reopen (edge case): only a *resolved* complaint can reopen, going back to
# in_progress when the resident says the work is not actually done. A *closed*
# complaint is terminal - closing is the final administrative act, so
# "closed -> reopened" is deliberately NOT allowed: the resident files a new
# complaint instead. Keeping closed terminal is what stops a long-settled
# complaint from being silently resurrected months later.
#
# Same-status "transitions" are intentionally not allowed either: each call must
# represent a real state change for the audit trail to mean anything.
ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    "submitted": {"assigned", "in_progress"},
    "assigned": {"in_progress"},
    "in_progress": {"resolved"},
    "resolved": {"closed", "in_progress"},
    "closed": set(),
}


def _get_complaint_or_404(db: Session, complaint_id: str) -> Complaint:
    complaint = crud.get_complaint(db, complaint_id)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint '{complaint_id}' not found.",
        )
    return complaint


def _get_staff_or_404(db: Session, staff_id: str) -> Staff:
    staff = crud.get_staff(db, staff_id)
    if not staff:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Staff member '{staff_id}' not found.",
        )
    return staff


# ── Categories (BE-13 / EN-13) ────────────────────────────────────────────────

def list_categories() -> CategoryListOut:
    """
    The canonical complaint categories a resident may submit - the single list
    that submission validation is enforced against. Clients read this instead
    of hard-coding the values, so a category added server-side appears here
    (and becomes submittable) without any client change.
    """
    # Read the list live from its single home so the endpoint always reflects
    # the current canonical set (and stays in lockstep with submission checks).
    from app.schemas.complaint import COMPLAINT_CATEGORIES

    categories = list(COMPLAINT_CATEGORIES)
    return CategoryListOut(categories=categories, count=len(categories))


# ── Create (BE-01 / BE-13 / EN-01) ───────────────────────────────────────────

def create_complaint(db: Session, data: ComplaintCreate) -> ComplaintOut:
    """
    Create a complaint in the submitted state.

    If the payload carries an inline image (EN-01), it is validated against the
    type and size limits *before* anything is written - a malformed, wrong-type,
    or oversized image is rejected with a clear error (400 / 413 / 415) and no
    row is created. A valid image is stored and its reference is recorded on the
    complaint, taking precedence over any external image_reference in the same
    request so the row points at the image we actually hold.
    """
    stored_reference: str | None = None
    if data.image is not None:
        validated = validate_complaint_image(
            data.image.data, declared_type=data.image.content_type
        )
        stored_reference = store_complaint_image(validated)

    complaint = crud.create_complaint(db, data)
    if stored_reference is not None:
        complaint.image_reference = stored_reference
    db.commit()
    db.refresh(complaint)
    return ComplaintOut.model_validate(complaint)


def _is_reopen(from_status: str, to_status: str) -> bool:
    """A reopen is the one backward move we allow: resolved -> in_progress."""
    return from_status == "resolved" and to_status == "in_progress"


def _validate_transition(complaint: Complaint, new_status: str) -> None:
    """
    Reject any status change that is not in ALLOWED_TRANSITIONS, with a message
    that says *why* and what the caller could do instead.

    Every rejection keeps the phrase "Cannot transition complaint from 'X' to
    'Y'" so callers (and existing tests) can match on it, then appends a reason:
      - the current state is terminal (closed cannot be reopened),
      - the target equals the current state (not a real change), or
      - the target is simply not reachable from here (lists the valid next
        states so the caller knows the right move).
    """
    current = complaint.status
    allowed_next = ALLOWED_TRANSITIONS.get(current, set())
    if new_status in allowed_next:
        return

    prefix = f"Cannot transition complaint from '{current}' to '{new_status}'"

    if new_status == current:
        reason = f"it is already '{current}'."
    elif not allowed_next:
        # The only state with no outgoing transitions is 'closed'.
        reason = (
            f"'{current}' is a terminal state and cannot be reopened. "
            "File a new complaint instead."
        )
    else:
        valid = ", ".join(sorted(allowed_next))
        is_one = len(allowed_next) == 1
        reason = (
            f"the only valid next {'state' if is_one else 'states'} from "
            f"'{current}' {'is' if is_one else 'are'}: {valid}."
        )

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"{prefix}: {reason}",
    )


# Wording for the notification a resident receives when their complaint moves.
_STATUS_MESSAGES = {
    "assigned":    "has been assigned to a staff member.",
    "in_progress": "is now being worked on.",
    "resolved":    "has been resolved.",
    "closed":      "has been closed.",
    "reopened":    "has been reopened.",
}


def _notify_status_change(
    db: Session,
    complaint: Complaint,
    new_status: str,
    previous_status: str,
) -> None:
    """
    Tell the resident their complaint moved on (BE-03).

    Reopening (resolved -> in_progress) is worded as a reopen rather than a
    plain "now being worked on", so the resident sees that their pushback was
    acted on. Every other move uses its own status wording.

    Raising here would undo a status change that is otherwise valid, so a
    notification that cannot be delivered - an unknown or missing resident,
    for instance - is allowed to fail quietly. The complaint history remains
    the record of what happened either way.
    """
    from app.services import notification_service

    event = "reopened" if _is_reopen(previous_status, new_status) else new_status

    notification_service.notify_resident(
        db,
        complaint.raised_by,
        # The card shows the title, so it stays short and readable. complaint_id
        # is a UUID and belongs in source_event_id, not on screen; the message
        # carries the detail that identifies which complaint this is about.
        title=f"Complaint {event.replace('_', ' ')}",
        message=(
            f"Your {complaint.category} complaint at {complaint.location} "
            + _STATUS_MESSAGES.get(event, f"changed to {event}.")
        ),
        notification_type="complaint_status_change",
        source_module="complaints",
        source_event_id=complaint.complaint_id,
    )


def _record_status_change(
    db: Session,
    complaint: Complaint,
    new_status: str,
    notes: str | None,
    employee_id: str | None,
):
    """Update status and add a history entry."""
    _validate_transition(complaint, new_status)
    previous_status = complaint.status
    complaint.status = new_status
    log = crud.create_progress_log(
        db,
        complaint_id=complaint.complaint_id,
        employee_id=employee_id,
        status=new_status,
        notes=notes,
    )
    _notify_status_change(db, complaint, new_status, previous_status)
    return log


def _current_status_timestamp(db: Session, complaint: Complaint) -> datetime:
    latest_log = crud.get_latest_progress_log(
        db, complaint.complaint_id, status=complaint.status
    )
    if latest_log is not None:
        return latest_log.updated_at
    if complaint.status == "assigned" and complaint.assigned_at is not None:
        return complaint.assigned_at
    return complaint.updated_at or complaint.created_at


def get_complaint_status(db: Session, complaint_id: str) -> ComplaintStatusOut:
    complaint = _get_complaint_or_404(db, complaint_id)
    return ComplaintStatusOut(
        complaint_id=complaint.complaint_id,
        status=complaint.status,
        timestamp=_current_status_timestamp(db, complaint),
    )


def update_complaint_status(
    db: Session,
    complaint_id: str,
    data: ComplaintStatusUpdate,
) -> ComplaintStatusOut:
    """Update status without employee attribution."""
    complaint = _get_complaint_or_404(db, complaint_id)
    log = _record_status_change(
        db,
        complaint=complaint,
        new_status=data.status,
        notes=data.notes,
        employee_id=None,
    )
    db.commit()
    db.refresh(log)
    return ComplaintStatusOut(
        complaint_id=complaint.complaint_id,
        status=complaint.status,
        timestamp=log.updated_at,
    )


# ── Assign ────────────────────────────────────────────────────────────────────

def _staff_is_active(staff: Staff) -> bool:
    """Staff.is_active is stored as the string "true"/"false" (SQLite-friendly)."""
    return str(staff.is_active).strip().lower() == "true"


def assign_complaint(
    db: Session, complaint_id: str, data: ComplaintAssign
) -> ComplaintOut:
    """
    Assign - or reassign - a complaint to a staff member (BE-06 / EN-06).

    Sets assigned_to and assigned_at (UTC). If the complaint is still in its
    initial "submitted" state, moves it forward to "assigned" - a complaint
    that is already in_progress/resolved/closed keeps its current status so
    reassigning doesn't regress the workflow (BE-16 owns status transitions
    beyond this point).

    Every assignment and reassignment is written to the immutable audit log
    (BE-39) in the same transaction as the change itself, so the President can
    always see who a complaint was handed to, who moved it, and when - the
    reassignment case records the staff member it was taken from.

    Errors:
      404 - the complaint or the staff member does not exist.
      400 - the staff member exists but is inactive, so cannot take new work.
    """
    complaint = _get_complaint_or_404(db, complaint_id)
    staff = _get_staff_or_404(db, data.staff_id)

    if not _staff_is_active(staff):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Staff member '{staff.name}' ({staff.staff_id}) is inactive "
                "and cannot be assigned complaints."
            ),
        )

    previous_assignee = complaint.assigned_to
    is_reassignment = previous_assignee is not None and previous_assignee != staff.staff_id

    complaint.assigned_to = staff.staff_id
    complaint.assigned_at = datetime.now(timezone.utc)
    if complaint.status == "submitted":
        complaint.status = "assigned"

    _audit_assignment(db, complaint, staff, previous_assignee, is_reassignment, data.assigned_by)

    db.commit()
    db.refresh(complaint)
    return ComplaintOut.model_validate(complaint)


def _audit_assignment(
    db: Session,
    complaint: Complaint,
    staff: Staff,
    previous_assignee: str | None,
    is_reassignment: bool,
    assigned_by: str | None,
) -> None:
    """Record an assignment/reassignment on the immutable audit log (BE-39)."""
    from app.services import audit_service

    if is_reassignment:
        action = "complaint_reassigned"
        prior = crud.get_staff(db, previous_assignee)
        prior_label = f"{prior.name} ({previous_assignee})" if prior else previous_assignee
        description = (
            f"Complaint {complaint.reference or complaint.complaint_id} reassigned "
            f"from {prior_label} to {staff.name} ({staff.staff_id})."
        )
    else:
        action = "complaint_assigned"
        description = (
            f"Complaint {complaint.reference or complaint.complaint_id} assigned "
            f"to {staff.name} ({staff.staff_id})."
        )

    audit_service.log_action(
        db,
        actor_id=assigned_by,
        actor_role="association_president",
        module="complaints",
        action=action,
        target_type="complaint",
        target_id=complaint.complaint_id,
        description=description,
    )


# ── Progress update / audit trail ──────────────────────────────────────────────

def update_progress(
    db: Session, complaint_id: str, data: ComplaintProgressUpdate
) -> ComplaintOut:
    """
    Move a complaint to a new status and append an audit-trail entry recording
    who made the change and when (EN-16). The employee and timestamp are always
    written, so the trail is a complete record of who did what.

    Errors:
      404 - the complaint or the employee does not exist.
      403 - the employee exists but is inactive, so is not authorised to record
            progress. A deactivated account must not be able to write history.
      400 - the requested status change is not a legal transition
            (see ALLOWED_TRANSITIONS; same-status "changes" are rejected too).

    A rejected update writes nothing: the status is unchanged and no audit row
    is left behind, so the trail never contains a change that did not happen.
    """
    complaint = _get_complaint_or_404(db, complaint_id)
    employee = _get_staff_or_404(db, data.employee_id)

    if not _staff_is_active(employee):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Staff member '{employee.name}' ({employee.staff_id}) is inactive "
                "and is not authorised to record progress updates."
            ),
        )

    _record_status_change(
        db,
        complaint=complaint,
        new_status=data.status,
        notes=data.notes,
        employee_id=employee.staff_id,
    )

    db.commit()
    db.refresh(complaint)
    return ComplaintOut.model_validate(complaint)


# ── Staff workload (BE-15) ───────────────────────────────────────────────────────

def get_staff_workload(db: Session) -> list[StaffWorkloadOut]:
    """
    Per-staff-member workload derived entirely from complaint assignments:
    how many complaints they currently have open (assigned/in_progress) vs
    how many they've completed (resolved/closed). Every staff member is
    included, even ones with zero assignments - a manager should see the
    whole team's load, not just the busy ones. Sorted by name.
    """
    all_staff = crud.get_all_staff(db)
    rows = crud.get_assignment_status_counts(db)

    ongoing: dict[str, int] = {}
    completed: dict[str, int] = {}
    for staff_id, complaint_status, count in rows:
        if complaint_status in ONGOING_STATUSES:
            ongoing[staff_id] = ongoing.get(staff_id, 0) + count
        elif complaint_status in COMPLETED_STATUSES:
            completed[staff_id] = completed.get(staff_id, 0) + count

    workload = [
        StaffWorkloadOut(
            staff_id=s.staff_id,
            name=s.name,
            role=s.role,
            assigned_count=ongoing.get(s.staff_id, 0),
            completed_count=completed.get(s.staff_id, 0),
        )
        for s in all_staff
    ]
    workload.sort(key=lambda w: w.name)
    return workload


# ── Dashboard stats (BE-07) ────────────────────────────────────────────────────

_MONTH_LABELS = (
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)


def _month_key(moment: datetime) -> str:
    """'2026-07' - the bucket key a timestamp falls into."""
    return f"{moment.year:04d}-{moment.month:02d}"


def _month_label(year: int, month: int) -> str:
    """'Jul 2026' - the chart axis label for a month."""
    return f"{_MONTH_LABELS[month - 1]} {year}"


def _month_window(end: datetime, months: int) -> list[tuple[int, int]]:
    """
    The (year, month) pairs for the `months`-long window ending with the month
    of `end`, oldest first. Built by walking backwards a month at a time so it
    stays correct across year boundaries without any date arithmetic library.
    """
    window: list[tuple[int, int]] = []
    year, month = end.year, end.month
    for _ in range(months):
        window.append((year, month))
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    window.reverse()
    return window


def _window_start(window: list[tuple[int, int]]) -> datetime:
    """Midnight on the first day of the oldest month in the window (naive UTC)."""
    year, month = window[0]
    return datetime(year, month, 1)


def average_resolution_hours(
    pairs: list[tuple[datetime, datetime]],
) -> float | None:
    """
    Average hours from creation to resolution over (created_at, resolved_at)
    pairs - the dependable-reports metric, kept pure so it can be unit-tested
    without a database.

    Rules that keep the number honest on messy data:
      - No resolved complaints -> None (report "no data", never 0 or a divide
        by zero).
      - A pair with a missing timestamp is skipped, not counted as 0.
      - A resolved_at earlier than created_at is a data anomaly (clock skew,
        a back-dated import); it is clamped to 0 hours rather than subtracting
        from the average.
    Result is rounded to 2 decimal places.
    """
    durations: list[float] = []
    for created_at, resolved_at in pairs:
        if created_at is None or resolved_at is None:
            continue
        hours = (resolved_at - created_at).total_seconds() / 3600
        durations.append(max(hours, 0.0))

    if not durations:
        return None
    return round(sum(durations) / len(durations), 2)


def get_complaint_stats(
    db: Session, trend_months: int = DEFAULT_TREND_MONTHS
) -> ComplaintStatsOut:
    """
    Dashboard snapshot for the Association President: headline counts plus
    the trend series the charts are drawn from.

    Buckets:
      pending   = submitted
      ongoing   = assigned + in_progress
      completed = resolved + closed

    The trend covers the last `trend_months` calendar months (inclusive of the
    current one) and reports two series per month: complaints raised (by
    created_at) and complaints resolved (by the audit-trail entry that moved
    them into resolved/closed, falling back to updated_at for complaints that
    never went through the progress endpoint). Months with no activity are
    still emitted with zeros so the chart keeps a continuous x-axis.
    """
    trend_months = max(1, min(trend_months, MAX_TREND_MONTHS))

    # ── Headline counts ────────────────────────────────────────────────────
    status_counts = dict(crud.get_status_counts(db))
    by_status = ComplaintStatusCounts(
        submitted=status_counts.get("submitted", 0),
        assigned=status_counts.get("assigned", 0),
        in_progress=status_counts.get("in_progress", 0),
        resolved=status_counts.get("resolved", 0),
        closed=status_counts.get("closed", 0),
    )

    def bucket(statuses: set[str]) -> int:
        return sum(status_counts.get(s, 0) for s in statuses)

    pending = bucket(PENDING_STATUSES)
    ongoing = bucket(ONGOING_STATUSES)
    completed = bucket(COMPLETED_STATUSES)

    # ── Category breakdown ─────────────────────────────────────────────────
    by_category = [
        CategoryCount(category=category, count=count)
        for category, count in crud.get_category_counts(db)
    ]

    # ── Trend series ───────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    window = _month_window(now, trend_months)
    since = _window_start(window)

    raised: dict[str, int] = {}
    for created_at in crud.get_created_timestamps(db, since):
        key = _month_key(created_at)
        raised[key] = raised.get(key, 0) + 1

    # Every completed complaint with the timestamps needed to both count it in
    # its resolution month and measure how long it took. Fetched once and reused
    # for the per-month counts, the per-month averages, and the all-time average.
    completed_rows = crud.get_resolution_timestamps(db, COMPLETED_STATUSES)
    all_pairs: list[tuple[datetime, datetime]] = []          # (created, resolved), all-time
    resolved: dict[str, int] = {}                             # per-month resolved count
    month_pairs: dict[str, list[tuple[datetime, datetime]]] = {}  # per-month (created, resolved)
    for created_at, audit_resolved_at, updated_at in completed_rows:
        resolved_at = audit_resolved_at or updated_at
        if resolved_at is None:
            continue
        all_pairs.append((created_at, resolved_at))
        if resolved_at < since:
            continue
        key = _month_key(resolved_at)
        resolved[key] = resolved.get(key, 0) + 1
        month_pairs.setdefault(key, []).append((created_at, resolved_at))

    trend = [
        TrendPoint(
            period=f"{year:04d}-{month:02d}",
            label=_month_label(year, month),
            raised=raised.get(f"{year:04d}-{month:02d}", 0),
            resolved=resolved.get(f"{year:04d}-{month:02d}", 0),
            avg_resolution_hours=average_resolution_hours(
                month_pairs.get(f"{year:04d}-{month:02d}", [])
            ),
        )
        for year, month in window
    ]

    return ComplaintStatsOut(
        pending=pending,
        ongoing=ongoing,
        completed=completed,
        total=sum(status_counts.values()),
        by_status=by_status,
        by_category=by_category,
        trend=trend,
        avg_resolution_hours=average_resolution_hours(all_pairs),
        resolved_sample_size=len(all_pairs),
        trend_months=trend_months,
        generated_at=now,
    )


# ── Complaint report (BE-14) ────────────────────────────────────────────────────

def get_complaint_report(
    db: Session, filters: ComplaintReportFilter
) -> ComplaintReportResponse:
    """
    Filtered, paginated complaint report for management.

    Converts date_from / date_to (date objects) to datetime at midnight so
    the comparison against the DateTime column works on both SQLite and
    PostgreSQL without dialect-specific casting.
    """
    date_from_dt = (
        datetime(filters.date_from.year, filters.date_from.month, filters.date_from.day)
        if filters.date_from else None
    )
    date_to_dt = (
        datetime(filters.date_to.year, filters.date_to.month, filters.date_to.day, 23, 59, 59)
        if filters.date_to else None
    )

    skip = (filters.page - 1) * filters.page_size
    total, complaints = crud.get_complaints_filtered(
        db,
        status=filters.status,
        category=filters.category,
        assigned_to=filters.assigned_to,
        raised_by=filters.raised_by,
        date_from=date_from_dt,
        date_to=date_to_dt,
        skip=skip,
        limit=filters.page_size,
    )

    pages = max(1, -(-total // filters.page_size))  # ceiling division

    items = [
        ComplaintReportItem(
            complaint_id=c.complaint_id,
            category=c.category,
            description=c.description,
            location=c.location,
            raised_by=c.raised_by,
            status=c.status,
            assigned_to=c.assigned_to,
            assigned_name=c.assigned_staff.name if c.assigned_staff else None,
            assigned_at=c.assigned_at,
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in complaints
    ]

    # Summary counts scoped to the same filters (re-query without pagination)
    _, all_matching = crud.get_complaints_filtered(
        db,
        status=filters.status,
        category=filters.category,
        assigned_to=filters.assigned_to,
        raised_by=filters.raised_by,
        date_from=date_from_dt,
        date_to=date_to_dt,
        skip=0,
        limit=total or 1,
    )
    status_tally: dict[str, int] = {}
    category_tally: dict[str, int] = {}
    for c in all_matching:
        status_tally[c.status] = status_tally.get(c.status, 0) + 1
        category_tally[c.category] = category_tally.get(c.category, 0) + 1

    by_status = ComplaintStatusCounts(
        submitted=status_tally.get("submitted", 0),
        assigned=status_tally.get("assigned", 0),
        in_progress=status_tally.get("in_progress", 0),
        resolved=status_tally.get("resolved", 0),
        closed=status_tally.get("closed", 0),
    )
    by_category = [
        CategoryCount(category=cat, count=cnt)
        for cat, cnt in sorted(category_tally.items(), key=lambda x: -x[1])
    ]

    return ComplaintReportResponse(
        total=total,
        page=filters.page,
        page_size=filters.page_size,
        pages=pages,
        items=items,
        by_status=by_status,
        by_category=by_category,
        generated_at=datetime.now(timezone.utc),
    )


# ── Feedback (BE-20) ───────────────────────────────────────────────────────────

def _resolution_date(db: Session, complaint: Complaint) -> datetime:
    """
    When this complaint's work was finished - the anchor for the feedback window.

    Prefers the earliest BE-16 audit entry that moved the complaint into
    resolved/closed, which is the same rule BE-07's resolved trend uses.
    Falls back to updated_at for complaints that reached a completed status
    without going through the progress endpoint (seed/import data).

    updated_at is only a fallback, never the primary source: it moves on *any*
    write, so an unrelated edit would silently extend or reset a resident's
    window.
    """
    resolved_at = crud.get_resolution_timestamp(
        db, complaint.complaint_id, COMPLETED_STATUSES
    )
    return resolved_at or complaint.updated_at


def submit_feedback(
    db: Session, complaint_id: str, data: ComplaintFeedbackCreate
) -> ComplaintFeedbackOut:
    """
    Record a resident's rating of how their complaint was handled.

    Rejected with:
      400 - the complaint is not resolved or closed yet. There is nothing to
            rate while the work is still in progress.
      409 - the complaint has already been rated. Feedback is one-shot: it is
            a record of an opinion at a point in time, and the UNIQUE
            constraint on complaint_id backs this at the database level so two
            concurrent submissions cannot both win.
      410 - the feedback window has closed (FEEDBACK_WINDOW_DAYS after the
            resolution date). 410 Gone rather than 400, because the request
            was valid and simply arrived too late - the distinction lets the
            UI say "this closed on the 14th" instead of "bad request".
    """
    complaint = _get_complaint_or_404(db, complaint_id)

    if complaint.status not in COMPLETED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Complaint '{complaint_id}' is '{complaint.status}'. Feedback "
                "can only be left on resolved or closed complaints."
            ),
        )

    if crud.get_feedback(db, complaint_id) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Feedback has already been submitted for complaint '{complaint_id}'.",
        )

    resolved_at = _resolution_date(db, complaint)
    deadline = resolved_at + timedelta(days=FEEDBACK_WINDOW_DAYS)
    # Naive UTC, matching what the DateTime columns store - comparing an
    # aware "now" against a naive column value would raise.
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    if now > deadline:
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=(
                f"The feedback window for complaint '{complaint_id}' closed on "
                f"{deadline.date().isoformat()} "
                f"({FEEDBACK_WINDOW_DAYS} days after it was resolved)."
            ),
        )

    feedback = crud.create_feedback(
        db,
        complaint_id=complaint_id,
        rating=data.rating,
        comment=data.comment,
        submitted_by=data.submitted_by,
    )

    db.commit()
    db.refresh(feedback)
    return ComplaintFeedbackOut.model_validate(feedback)


def get_feedback(db: Session, complaint_id: str) -> ComplaintFeedbackOut:
    """The feedback left on a complaint, or 404 if it hasn't been rated."""
    _get_complaint_or_404(db, complaint_id)

    feedback = crud.get_feedback(db, complaint_id)
    if feedback is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No feedback has been submitted for complaint '{complaint_id}'.",
        )
    return ComplaintFeedbackOut.model_validate(feedback)
