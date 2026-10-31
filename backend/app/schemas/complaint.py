"""
Pydantic schemas for the Complaints & Staff module (BE-06, BE-15, BE-16).

ComplaintCreate is for internal use - BE-01 owns the public submission
endpoint.
"""

from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# ── Allowed ENUM values ───────────────────────────────────────────────────────

ComplaintStatus = Literal["submitted", "assigned", "in_progress", "resolved", "closed"]

# ── Complaint categories (BE-13 / EN-13) ───────────────────────────────────────
# THE single source of truth for the complaint categories a resident may submit.
# Everything category-related derives from this tuple: the submission validator
# below, the GET /complaints/categories discovery endpoint, and the OpenAPI enum.
# Adding a category here makes it accepted on submission and visible in the
# discovery endpoint in the same step - nothing else needs editing - which is
# exactly what "new categories are handled" requires.
#
# Validation reads this name at call time (not a frozen copy), so a deployment
# that extends the list - or a test that monkeypatches it - takes effect
# immediately without rebuilding a Literal type.
COMPLAINT_CATEGORIES: tuple[str, ...] = (
    "Plumbing",
    "Electrical",
    "Security",
    "Water Supply",
    "Lift Maintenance",
    # A resident whose problem fits none of the above still has to be able to
    # report it. Without this they either abandon the form or pick a category
    # at random, which is worse: the complaint is then routed to the wrong
    # trade and the category reports quietly lie. Kept last so it reads as the
    # fallback it is, both in the dropdown and in the OpenAPI enum.
    "Other",
)

# Kept as an alias so existing imports/annotations still resolve. The runtime
# check that actually rejects unknown categories lives on ComplaintCreate.
ComplaintCategory = str


class CategoryListOut(BaseModel):
    """Response for GET /complaints/categories - the canonical category list."""

    categories: list[str] = Field(
        ..., description="Allowed complaint categories, in display order."
    )
    count: int = Field(..., ge=0, description="Number of categories.")


# ── Staff ─────────────────────────────────────────────────────────────────────

class StaffBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(..., min_length=1, max_length=50)
    phone: Optional[str] = Field(None, max_length=15)


class StaffCreate(StaffBase):
    pass


class StaffOut(StaffBase):
    staff_id: str

    model_config = ConfigDict(from_attributes=True)


# ── Complaint ─────────────────────────────────────────────────────────────────

class ComplaintBase(BaseModel):
    category: str = Field(..., min_length=1, max_length=50)
    description: str = Field(..., min_length=1)
    location: Optional[str] = Field(None, max_length=100)
    image_reference: Optional[str] = Field(None, max_length=500)
    raised_by: Optional[str] = None


class ComplaintImageUpload(BaseModel):
    """
    An inline image attached to a complaint (EN-01).

    `data` is base64-encoded image bytes, optionally as a `data:` URI. The
    declared `content_type` is only a hint - the submission endpoint decides
    the real type from the bytes themselves and enforces the type and size
    limits, rejecting anything that is not an allowed image (see
    app.utils.images). Residents who already have a hosted image use
    `image_reference` on the complaint instead of this field.
    """

    data: str = Field(
        ...,
        min_length=1,
        description="Base64-encoded image bytes, or a base64 `data:` URI.",
    )
    content_type: Optional[str] = Field(
        None,
        max_length=100,
        description="Declared MIME type, e.g. 'image/jpeg'. Verified against the bytes.",
    )
    filename: Optional[str] = Field(
        None,
        max_length=255,
        description="Original filename, for display only. Never used as a storage path.",
    )

    model_config = ConfigDict(extra="forbid")


class ComplaintCreate(BaseModel):
    """Complaint submission payload."""

    # Validated against COMPLAINT_CATEGORIES at submission time. Declared as a
    # plain string with the allowed values injected into the schema so the enum
    # still shows in Swagger, while the runtime check (below) owns rejection and
    # its message - that keeps unknown/empty categories rejected the same way no
    # matter how the list grows.
    category: str = Field(
        ...,
        description="Complaint category. Must be one of the values from GET /complaints/categories.",
        json_schema_extra={"enum": list(COMPLAINT_CATEGORIES)},
    )
    description: str = Field(..., min_length=1, max_length=2000)
    location: str = Field(..., min_length=1, max_length=100)
    image_reference: Optional[str] = Field(None, max_length=500)
    # An inline photo. Mutually complementary with image_reference: a caller
    # supplies at most one. When present it is validated and stored, and its
    # stored reference becomes the complaint's image_reference.
    image: Optional[ComplaintImageUpload] = None
    # Optional until resident identity is supplied by authentication.
    raised_by: Optional[str] = Field(None, max_length=100)

    model_config = ConfigDict(extra="forbid")

    @field_validator("category")
    @classmethod
    def _category_must_be_known(cls, value: str) -> str:
        # Trim first so " Plumbing " and "" are judged on their real content,
        # then check membership. The list is read live from the module global,
        # so an added category is accepted without touching this validator.
        cleaned = value.strip() if isinstance(value, str) else value
        if cleaned not in COMPLAINT_CATEGORIES:
            allowed = ", ".join(COMPLAINT_CATEGORIES)
            raise ValueError(
                f"category must be one of: {allowed}. Got {value!r}."
            )
        return cleaned

    @field_validator("description", "location")
    @classmethod
    def _required_text_must_not_be_blank(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("must not be blank")
        return stripped

    @field_validator("image_reference", "raised_by")
    @classmethod
    def _optional_text_is_trimmed(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ComplaintOut(ComplaintBase):
    complaint_id: str
    # The reference residents actually quote; older rows created before it
    # existed have none, so it stays optional.
    reference: Optional[str] = None
    status: ComplaintStatus
    assigned_to: Optional[str] = None
    assigned_at: Optional[datetime] = None
    assigned_staff: Optional[StaffOut] = None
    progress_logs: list["ComplaintProgressLogOut"] = []
    feedback: Optional["ComplaintFeedbackOut"] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Assignment (BE-06) ────────────────────────────────────────────────────────

class ComplaintAssign(BaseModel):
    """Request body for PUT /complaints/{id}/assign."""

    staff_id: str = Field(..., description="UUID of the staff member to assign this complaint to")
    # Who performed the assignment (the Association President), recorded as the
    # actor on the audit entry. Optional until auth supplies the caller's
    # identity from the token - same convention as raised_by / decided_by.
    assigned_by: Optional[str] = Field(
        None,
        max_length=100,
        description="ID of the user making the assignment, recorded in the audit log.",
    )


# ── Progress update / audit trail (BE-16) ─────────────────────────────────────

class ComplaintProgressUpdate(BaseModel):
    """Request body for PUT /complaints/{id}/progress."""

    status: ComplaintStatus = Field(..., description="New status to move the complaint to")
    employee_id: str = Field(..., description="UUID of the staff member recording this update")
    notes: Optional[str] = Field(None, max_length=500, description="Optional note about the work done")


class ComplaintStatusUpdate(BaseModel):
    """Complaint status update payload."""

    status: ComplaintStatus = Field(..., description="New complaint stage")
    notes: Optional[str] = Field(None, max_length=500)

    model_config = ConfigDict(extra="forbid")

    @field_validator("notes")
    @classmethod
    def _blank_notes_are_none(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ComplaintStatusOut(BaseModel):
    """Current complaint status and timestamp."""

    complaint_id: str
    status: ComplaintStatus
    timestamp: datetime


class ComplaintProgressLogOut(BaseModel):
    log_id: str
    complaint_id: str
    employee_id: Optional[str] = None
    employee: Optional[StaffOut] = None
    status: ComplaintStatus
    notes: Optional[str] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Feedback (BE-20) ──────────────────────────────────────────────────────────

class ComplaintFeedbackCreate(BaseModel):
    """
    Request body for POST /complaints/{id}/feedback.

    A rating is required; the comment is optional, because forcing someone to
    write prose to leave a star rating just suppresses the response rate.
    """

    rating: int = Field(
        ...,
        ge=1,
        le=5,
        description="Star rating from 1 (poor) to 5 (excellent)",
    )
    comment: Optional[str] = Field(
        None,
        max_length=1000,
        description="Optional free-text comment about how the complaint was handled",
    )
    submitted_by: Optional[str] = Field(
        None,
        description="resident_id of the person leaving the feedback",
    )

    @field_validator("comment")
    @classmethod
    def _blank_comment_is_none(cls, value: Optional[str]) -> Optional[str]:
        """
        Treat a whitespace-only comment as no comment at all, so the stored
        value is either meaningful text or NULL - never "   ", which would
        render as an empty speech bubble in the UI.
        """
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class ComplaintFeedbackOut(BaseModel):
    feedback_id: str
    complaint_id: str
    rating: int
    comment: Optional[str] = None
    submitted_by: Optional[str] = None
    submitted_at: datetime

    model_config = ConfigDict(from_attributes=True)


ComplaintOut.model_rebuild()


# ── Staff workload (BE-15) ─────────────────────────────────────────────────────

class StaffWorkloadOut(BaseModel):
    """
    Response item for GET /staff/workload.

    assigned_count  = complaints currently assigned to this staff member and
                       still open (assigned / in_progress)
    completed_count = complaints this staff member has resolved or closed
    Both are derived from Complaint.assigned_to + Complaint.status.
    """

    staff_id: str
    name: str
    role: str
    assigned_count: int
    completed_count: int

    model_config = ConfigDict(from_attributes=True)


# ── Dashboard stats (BE-07) ───────────────────────────────────────────────────

class ComplaintStatusCounts(BaseModel):
    """Raw per-status counts, before they are grouped into dashboard buckets."""

    submitted: int = 0
    assigned: int = 0
    in_progress: int = 0
    resolved: int = 0
    closed: int = 0


class CategoryCount(BaseModel):
    """One slice of the category breakdown chart."""

    category: str = Field(..., description="Complaint category, e.g. 'plumbing'")
    count: int = Field(..., ge=0)


class TrendPoint(BaseModel):
    """
    One month on the dashboard trend chart.

    raised   = complaints created in this month
    resolved = complaints that reached resolved/closed in this month
    Every month in the requested window is present, including empty ones,
    so the chart keeps a continuous x-axis instead of skipping gaps.
    """

    period: str = Field(..., description="Month in YYYY-MM form, e.g. '2026-07'")
    label: str = Field(..., description="Human-readable month label, e.g. 'Jul 2026'")
    raised: int = Field(..., ge=0)
    resolved: int = Field(..., ge=0)
    avg_resolution_hours: Optional[float] = Field(
        None,
        ge=0,
        description=(
            "Average hours from creation to resolution for complaints resolved "
            "in this month. Null when no complaint was resolved this month."
        ),
    )


class ComplaintStatsOut(BaseModel):
    """
    Response for GET /complaints/stats - the Association President's
    dashboard payload.

    Bucket mapping (see complaint_service for the source of truth):
      pending   = submitted
      ongoing   = assigned + in_progress
      completed = resolved + closed
    """

    pending: int = Field(..., ge=0, description="Complaints not yet assigned")
    ongoing: int = Field(..., ge=0, description="Complaints assigned or in progress")
    completed: int = Field(..., ge=0, description="Complaints resolved or closed")
    total: int = Field(..., ge=0, description="All complaints on record")

    by_status: ComplaintStatusCounts
    by_category: list[CategoryCount] = []
    trend: list[TrendPoint] = []

    avg_resolution_hours: Optional[float] = Field(
        None,
        ge=0,
        description=(
            "Average hours from creation to resolution across every resolved or "
            "closed complaint on record (all-time, like the headline counts). "
            "Null when nothing has been resolved yet."
        ),
    )
    resolved_sample_size: int = Field(
        0,
        ge=0,
        description="How many resolved/closed complaints the average is based on.",
    )

    trend_months: int = Field(..., description="Number of months covered by `trend`")
    generated_at: datetime = Field(..., description="UTC timestamp this snapshot was computed")


# ── Complaint report (BE-14) ───────────────────────────────────────────────────

class ComplaintReportFilter(BaseModel):
    """Query filters for GET /complaints/reports."""

    status:      Optional[ComplaintStatus] = None
    category:    Optional[str]             = Field(None, max_length=50)
    assigned_to: Optional[str]             = None
    raised_by:   Optional[str]             = None
    date_from:   Optional[date]            = None
    date_to:     Optional[date]            = None
    page:        int                       = Field(1, ge=1)
    page_size:   int                       = Field(20, ge=1, le=100)

    @model_validator(mode="after")
    def date_range_valid(self) -> "ComplaintReportFilter":
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must not be later than date_to.")
        return self


class ComplaintReportItem(BaseModel):
    """One row in the report - a flattened complaint with staff name resolved."""

    complaint_id:  str
    category:      str
    description:   str
    location:      Optional[str]      = None
    raised_by:     Optional[str]      = None
    status:        ComplaintStatus
    assigned_to:   Optional[str]      = None
    assigned_name: Optional[str]      = None
    assigned_at:   Optional[datetime] = None
    created_at:    datetime
    updated_at:    datetime

    model_config = ConfigDict(from_attributes=True)


class ComplaintReportResponse(BaseModel):
    """Response envelope for GET /complaints/reports."""

    total:       int                      = Field(..., ge=0, description="Total matching complaints (before pagination)")
    page:        int                      = Field(..., ge=1)
    page_size:   int                      = Field(..., ge=1)
    pages:       int                      = Field(..., ge=0, description="Total number of pages")
    items:       list[ComplaintReportItem] = []
    by_status:   ComplaintStatusCounts
    by_category: list[CategoryCount]      = []
    generated_at: datetime
