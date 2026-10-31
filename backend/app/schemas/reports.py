"""
Pydantic schemas for the Reports & Analytics module (BE-36).

There is no ORM model behind any of these - every schema here is a
read-only response shape assembled by app/services/reports_service.py from
other modules' data. The optional date_from/date_to window defaults to the
trailing 30 days when omitted, so an unbounded "since forever" aggregate
query doesn't run against a growing table.
"""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel, Field


class LabelCount(BaseModel):
    """A generic (label, count) pair - reused for every group-by breakdown."""

    label: str
    count: int


# ── Summary ────────────────────────────────────────────────────────────────────

class ReportSummaryOut(BaseModel):
    date_from: date
    date_to: date
    active_residents: int
    outstanding_bills_count: int
    outstanding_bills_amount: Decimal
    payments_collected_count: int
    payments_collected_amount: Decimal
    visitors_count: int
    temple_bookings_count: int
    temple_donations_amount: Decimal
    community_signups_count: int


# ── Payments ───────────────────────────────────────────────────────────────────

class PaymentsReportOut(BaseModel):
    date_from: date
    date_to: date
    total_billed: Decimal
    total_collected: Decimal
    total_outstanding: Decimal
    average_bill_amount: Decimal = Field(..., description="total_billed / number of bills in range")
    bill_count: int
    by_status: list[LabelCount]


# ── Residents ──────────────────────────────────────────────────────────────────

class ResidentsReportOut(BaseModel):
    date_from: date
    date_to: date
    total_residents: int
    by_status: list[LabelCount]
    occupancy_rate: float = Field(..., description="occupied flats / total flats, 0 when there are no flats")
    by_block: list[LabelCount]
    new_move_ins: int = Field(..., description="Residents whose move_in_date falls in the range")


# ── Visitors ───────────────────────────────────────────────────────────────────

class VisitorsReportOut(BaseModel):
    date_from: date
    date_to: date
    total_visitors: int
    by_status: list[LabelCount]
    by_purpose: list[LabelCount]
    average_per_day: float


# ── Maintenance ────────────────────────────────────────────────────────────────

class MaintenanceReportOut(BaseModel):
    date_from: date
    date_to: date
    total_scheduled: int
    upcoming_count: int = Field(..., description="scheduled_date >= today")
    past_count: int = Field(..., description="scheduled_date < today")


# ── Temple (BE-33 data) ─────────────────────────────────────────────────────────

class TempleReportOut(BaseModel):
    date_from: date
    date_to: date
    bookings_total: int
    bookings_by_seva_type: list[LabelCount]
    donations_count: int
    donations_total: Decimal
    donations_average: Decimal
    event_signups_count: int
    volunteer_signups_count: int
    participation_rate: float = Field(
        ..., description="distinct residents who booked/donated/signed up ÷ active residents"
    )


# ── Community (BE-34 data) ──────────────────────────────────────────────────────

class CommunityReportOut(BaseModel):
    date_from: date
    date_to: date
    activities_count: int
    signups_count: int
    average_signups_per_activity: float
    participation_rate: float = Field(
        ..., description="distinct residents who signed up ÷ active residents"
    )
    by_corner: list[LabelCount]
