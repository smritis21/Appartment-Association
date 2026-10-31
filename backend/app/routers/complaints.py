"""FastAPI router for the Complaints module (BE-06, BE-07, BE-16, BE-20)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.complaint import (
    CategoryListOut,
    ComplaintAssign,
    ComplaintCreate,
    ComplaintFeedbackCreate,
    ComplaintFeedbackOut,
    ComplaintOut,
    ComplaintProgressUpdate,
    ComplaintReportFilter,
    ComplaintReportResponse,
    ComplaintStatsOut,
    ComplaintStatusOut,
    ComplaintStatusUpdate,
)
from app.services import complaint_service as service

router = APIRouter(prefix="/complaints", tags=["Complaints"])


@router.post(
    "",
    response_model=ComplaintOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit a complaint",
    description=(
        "Persists a resident complaint with a generated UUID and initial "
        "`submitted` status. Category must be one of the fixed BE-13 values. "
        "A photo is optional: supply `image_reference` for an already-hosted "
        "image, or `image` for an inline base64 upload. An inline image is "
        "validated before storage (EN-01) - its real type is sniffed from the "
        "bytes (a forged content_type is rejected), only JPEG/PNG/WebP are "
        "accepted, and it must be no larger than 5 MB."
    ),
    responses={
        201: {"description": "Complaint submitted successfully"},
        400: {"description": "Invalid complaint payload, category, or malformed image data"},
        413: {"description": "Attached image exceeds the 5 MB size limit"},
        415: {"description": "Attached image is not an allowed type (jpeg, png, webp)"},
    },
)
def create_complaint(data: ComplaintCreate, db: Session = Depends(get_db)):
    return service.create_complaint(db, data)


# /stats and /reports are declared before the /{complaint_id}/... routes -
# FastAPI matches in declaration order, so literal paths must come first.

@router.get(
    "/stats",
    response_model=ComplaintStatsOut,
    summary="Complaint dashboard statistics",
    description=(
        "Aggregated complaint statistics for the Association President's "
        "dashboard.\n\n"
        "**Headline counts** group the workflow statuses into three buckets:\n"
        "- `pending` - submitted\n"
        "- `ongoing` - assigned + in_progress\n"
        "- `completed` - resolved + closed\n\n"
        "**Trend data** returns one point per calendar month for the last "
        "`months` months (inclusive of the current month), each with the "
        "number of complaints raised and resolved. Months with no activity "
        "are included with zero counts so charts keep a continuous x-axis.\n\n"
        "A category breakdown (busiest category first) is included for the "
        "distribution chart. Always returns 200 - an empty database yields "
        "zeroed counts, not a 404."
    ),
    responses={
        200: {"description": "Statistics returned successfully"},
        422: {"description": "Validation error (e.g. months outside 1–24)"},
    },
)
def get_complaint_stats(
    months: int = Query(
        service.DEFAULT_TREND_MONTHS,
        ge=1,
        le=service.MAX_TREND_MONTHS,
        description="How many calendar months of trend data to return (1–24).",
    ),
    db: Session = Depends(get_db),
):
    return service.get_complaint_stats(db, trend_months=months)


@router.get(
    "/reports",
    response_model=ComplaintReportResponse,
    summary="Filtered complaint report",
    description=(
        "Returns a paginated, filtered list of complaints for management reporting.\n\n"
        "All filters are optional and combinable. Results are ordered by "
        "`created_at` descending (newest first).\n\n"
        "The response includes:\n"
        "- `items` - the current page of complaints with staff name resolved\n"
        "- `total` / `pages` - pagination metadata\n"
        "- `by_status` / `by_category` - summary counts scoped to the same filters"
    ),
    responses={
        200: {"description": "Report returned successfully"},
        422: {"description": "Validation error (e.g. date_from after date_to)"},
    },
)
def get_complaint_report(
    status:      str | None = Query(None, description="Filter by status: submitted / assigned / in_progress / resolved / closed"),
    category:    str | None = Query(None, description="Filter by category, e.g. 'plumbing'"),
    assigned_to: str | None = Query(None, description="Filter by assigned staff UUID"),
    raised_by:   str | None = Query(None, description="Filter by resident UUID who raised the complaint"),
    date_from:   str | None = Query(None, description="Filter complaints created on or after this date (YYYY-MM-DD)"),
    date_to:     str | None = Query(None, description="Filter complaints created on or before this date (YYYY-MM-DD)"),
    page:        int        = Query(1,  ge=1,         description="Page number (1-based)"),
    page_size:   int        = Query(20, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
):
    from datetime import date as date_type
    from fastapi import HTTPException as _HTTPException
    from pydantic import ValidationError as _ValidationError

    def _parse_date(val: str | None, field: str):
        if val is None:
            return None
        try:
            return date_type.fromisoformat(val)
        except ValueError:
            raise _HTTPException(
                status_code=422,
                detail=f"Invalid date format for '{field}': expected YYYY-MM-DD, got '{val}'.",
            )

    try:
        filters = ComplaintReportFilter(
            status=status,
            category=category,
            assigned_to=assigned_to,
            raised_by=raised_by,
            date_from=_parse_date(date_from, "date_from"),
            date_to=_parse_date(date_to, "date_to"),
            page=page,
            page_size=page_size,
        )
    except _ValidationError as exc:
        raise _HTTPException(status_code=422, detail=str(exc.errors()[0]["msg"]))
    return service.get_complaint_report(db, filters)


# Literal path - declared before the /{complaint_id}/... routes so it is not
# swallowed by the parameterised matcher (see the note above /stats).
@router.get(
    "/categories",
    response_model=CategoryListOut,
    summary="List complaint categories",
    description=(
        "Returns the canonical list of complaint categories a resident may "
        "submit. This is the single source of truth submission validation is "
        "enforced against - clients should read it here rather than hard-coding "
        "the values, so a category added server-side is picked up automatically."
    ),
    responses={200: {"description": "Category list returned successfully"}},
)
def list_categories():
    return service.list_categories()


@router.get(
    "/{complaint_id}/status",
    response_model=ComplaintStatusOut,
    summary="Get complaint status",
    description="Returns the complaint's current stage and the stage timestamp.",
    responses={
        200: {"description": "Current complaint status"},
        404: {"description": "Complaint not found"},
    },
)
def get_complaint_status(complaint_id: str, db: Session = Depends(get_db)):
    return service.get_complaint_status(db, complaint_id)


@router.put(
    "/{complaint_id}/status",
    response_model=ComplaintStatusOut,
    summary="Update complaint status",
    description=(
        "Moves a complaint through the shared complaint workflow and records "
        "a timestamped status-history entry. This generic BE-02 operation does "
        "not require an employee; BE-16's `/progress` endpoint still does.\n\n"
        "Status flow: `submitted -> assigned -> in_progress -> resolved -> "
        "closed`. A `resolved` complaint can reopen to `in_progress`; `closed` "
        "is terminal and cannot be reopened. Illegal moves (skipping stages, "
        "going backward, repeating the current status, or leaving a terminal "
        "state) return 400 with a message naming the valid next states."
    ),
    responses={
        200: {"description": "Complaint status updated"},
        400: {"description": "Unknown status, or an illegal stage transition"},
        404: {"description": "Complaint not found"},
    },
)
def update_complaint_status(
    complaint_id: str,
    data: ComplaintStatusUpdate,
    db: Session = Depends(get_db),
):
    return service.update_complaint_status(db, complaint_id, data)


@router.put(
    "/{complaint_id}/assign",
    response_model=ComplaintOut,
    summary="Assign or reassign a complaint to a staff member",
    description=(
        "Sets the assigned staff member and an assignment timestamp on the complaint. "
        "If the complaint is still `submitted`, its status moves to `assigned`. "
        "The same endpoint reassigns an already-assigned complaint. Every assignment "
        "and reassignment is written to the immutable audit log (BE-39) in the same "
        "transaction, recording the prior assignee on a reassignment; pass "
        "`assigned_by` to record who made the change. The staff member must exist "
        "and be active."
    ),
    responses={
        200: {"description": "Complaint assigned successfully"},
        400: {"description": "The staff member exists but is inactive and cannot take new work"},
        404: {"description": "Complaint or staff member not found"},
        422: {"description": "Validation error"},
    },
)
def assign_complaint(
    complaint_id: str,
    data: ComplaintAssign,
    db: Session = Depends(get_db),
):
    return service.assign_complaint(db, complaint_id, data)


@router.put(
    "/{complaint_id}/progress",
    response_model=ComplaintOut,
    summary="Update complaint progress",
    description=(
        "Moves a complaint to a new status and appends an audit-trail entry "
        "recording the employee who made the change and when - every accepted "
        "update is written to the trail. Only forward workflow transitions (and "
        "reopening a *resolved* complaint back to `in_progress`) are allowed. "
        "`closed` is terminal - a closed complaint cannot be reopened; a new "
        "complaint must be filed instead. Any other move returns 400 with a "
        "message naming the valid next states. The employee must exist and be "
        "active: an inactive staff account is not authorised to record progress "
        "and is rejected with 403. A rejected update writes nothing to the trail."
    ),
    responses={
        200: {"description": "Progress recorded successfully"},
        400: {"description": "Invalid status transition"},
        403: {"description": "Employee is inactive and not authorised to record progress"},
        404: {"description": "Complaint or employee not found"},
        422: {"description": "Validation error"},
    },
)
def update_progress(
    complaint_id: str,
    data: ComplaintProgressUpdate,
    db: Session = Depends(get_db),
):
    return service.update_progress(db, complaint_id, data)


@router.post(
    "/{complaint_id}/feedback",
    response_model=ComplaintFeedbackOut,
    status_code=status.HTTP_201_CREATED,
    summary="Rate a resolved complaint",
    description=(
        "Stores a resident's star rating (1–5) and optional comment for a "
        "complaint.\n\n"
        "**Feedback is only accepted for resolved or closed complaints, and "
        "only within the feedback window** - "
        f"{service.FEEDBACK_WINDOW_DAYS} days from the date the complaint was "
        "resolved. The window is measured from the audit-trail entry that "
        "moved the complaint into resolved/closed (BE-16), not from the "
        "record's last-modified time, so an unrelated edit cannot extend or "
        "reset it.\n\n"
        "**Feedback is one-shot.** A complaint can be rated once; a second "
        "submission returns 409. This is enforced by a UNIQUE constraint on "
        "the database as well as the service check, so concurrent submissions "
        "cannot both succeed.\n\n"
        "A comment is optional - requiring prose to leave a star rating only "
        "suppresses the response rate. Whitespace-only comments are stored as "
        "null rather than blank text."
    ),
    responses={
        201: {"description": "Feedback stored successfully"},
        400: {"description": "Complaint is not resolved or closed yet"},
        404: {"description": "Complaint not found"},
        409: {"description": "This complaint has already been rated"},
        410: {"description": "The feedback window has closed"},
        422: {"description": "Validation error (rating outside 1–5)"},
    },
)
def submit_feedback(
    complaint_id: str,
    data: ComplaintFeedbackCreate,
    db: Session = Depends(get_db),
):
    return service.submit_feedback(db, complaint_id, data)


@router.get(
    "/{complaint_id}/feedback",
    response_model=ComplaintFeedbackOut,
    summary="Get the feedback left on a complaint",
    description=(
        "Returns the rating and comment stored for this complaint. Responds "
        "with 404 when the complaint exists but has not been rated - the "
        "detail message distinguishes the two cases."
    ),
    responses={
        200: {"description": "Feedback returned successfully"},
        404: {"description": "Complaint not found, or it has no feedback yet"},
    },
)
def get_feedback(complaint_id: str, db: Session = Depends(get_db)):
    return service.get_feedback(db, complaint_id)
