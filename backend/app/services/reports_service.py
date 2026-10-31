"""Service layer for the Reports & Analytics module (BE-36).

No table backs this module - docs/database/database-schema.md §2 notes
that Reports & Analytics derives data from existing tables. Every
function here composes aggregate queries added to other modules' crud
files (crud.payments, crud.residents, crud.visitors, crud.maintenance,
crud.temple, crud.community) into the response shapes in
schemas/reports.py, the same no-table pattern GET /staff/workload
(BE-15) uses via complaint_service.get_staff_workload().

Date ranges default to DEFAULT_RANGE_DAYS and cap at MAX_RANGE_DAYS - an
unbounded aggregate query over a growing table is a foot-gun. Complaints
and staff aren't covered here since GET /complaints/stats (BE-07), GET
/complaints/reports (BE-14) and GET /staff/workload (BE-15) already own
that domain.
"""

from datetime import date, datetime, time, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import community as community_crud
from app.crud import maintenance as maintenance_crud
from app.crud import payments as payments_crud
from app.crud import residents as residents_crud
from app.crud import temple as temple_crud
from app.crud import visitors as visitors_crud
from app.schemas.reports import (
    CommunityReportOut,
    LabelCount,
    MaintenanceReportOut,
    PaymentsReportOut,
    ReportSummaryOut,
    ResidentsReportOut,
    TempleReportOut,
    VisitorsReportOut,
)

DEFAULT_RANGE_DAYS = 30
MAX_RANGE_DAYS = 366


# ── Helpers ───────────────────────────────────────────────────────────────────

def _validate_and_default_range(
    date_from: date | None, date_to: date | None
) -> tuple[date, date]:
    """
    422 if the range is inverted; otherwise defaults/caps it. See module
    docstring for why an unbounded range isn't allowed.
    """
    if date_from and date_to and date_from > date_to:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="date_from must not be later than date_to.",
        )
    effective_to = date_to or date.today()
    effective_from = date_from or (effective_to - timedelta(days=DEFAULT_RANGE_DAYS))
    if (effective_to - effective_from).days > MAX_RANGE_DAYS:
        effective_from = effective_to - timedelta(days=MAX_RANGE_DAYS)
    return effective_from, effective_to


def _day_bounds(date_from: date, date_to: date) -> tuple[datetime, datetime]:
    """
    Expand a date range into inclusive datetime bounds for filtering
    DateTime columns (Payment.paid_on, Visitor.requested_at, etc.) - without
    this, an upper bound of a bare date's implicit midnight would exclude
    almost the entire final day.
    """
    return datetime.combine(date_from, time.min), datetime.combine(date_to, time.max)


def _label_counts(rows) -> list[LabelCount]:
    return [
        LabelCount(label=label if label is not None else "unspecified", count=count)
        for label, count in rows
    ]


def _participation_rate(engaged_resident_ids: list[str], active_residents: int) -> float:
    if active_residents == 0:
        return 0.0
    return round(len({r for r in engaged_resident_ids if r}) / active_residents, 4)


# ── Summary ────────────────────────────────────────────────────────────────────

def get_summary(
    db: Session, date_from: date | None, date_to: date | None
) -> ReportSummaryOut:
    effective_from, effective_to = _validate_and_default_range(date_from, date_to)
    dt_from, dt_to = _day_bounds(effective_from, effective_to)

    active_residents = residents_crud.get_active_count(db)
    outstanding_count, outstanding_amount = payments_crud.get_current_outstanding_summary(db)
    collected_count, collected_amount = payments_crud.get_collected_summary(db, dt_from, dt_to)
    visitors_count = visitors_crud.get_total_count(db, dt_from, dt_to)
    booking_report = temple_crud.get_booking_report(db, effective_from, effective_to)
    donation_report = temple_crud.get_donation_report(db, dt_from, dt_to)
    signup_report = community_crud.get_signup_report(db, dt_from, dt_to)

    return ReportSummaryOut(
        date_from=effective_from,
        date_to=effective_to,
        active_residents=active_residents,
        outstanding_bills_count=outstanding_count,
        outstanding_bills_amount=outstanding_amount,
        payments_collected_count=collected_count,
        payments_collected_amount=collected_amount,
        visitors_count=visitors_count,
        temple_bookings_count=booking_report["total"],
        temple_donations_amount=donation_report["total"],
        community_signups_count=signup_report["total"],
    )


# ── Payments ───────────────────────────────────────────────────────────────────

def get_payments_report(
    db: Session, date_from: date | None, date_to: date | None
) -> PaymentsReportOut:
    effective_from, effective_to = _validate_and_default_range(date_from, date_to)
    dt_from, dt_to = _day_bounds(effective_from, effective_to)

    billing = payments_crud.get_billing_totals(db, effective_from, effective_to)
    _, collected = payments_crud.get_collected_summary(db, dt_from, dt_to)

    bill_count = billing["bill_count"]
    average_bill_amount = (billing["total_billed"] / bill_count) if bill_count else 0

    return PaymentsReportOut(
        date_from=effective_from,
        date_to=effective_to,
        total_billed=billing["total_billed"],
        total_collected=collected,
        total_outstanding=billing["total_outstanding"],
        average_bill_amount=average_bill_amount,
        bill_count=bill_count,
        by_status=_label_counts(billing["by_status"]),
    )


# ── Residents ──────────────────────────────────────────────────────────────────

def get_residents_report(
    db: Session, date_from: date | None, date_to: date | None
) -> ResidentsReportOut:
    """
    Status counts, occupancy and the block breakdown are point-in-time -
    residency status isn't something a historical date range scopes.
    date_from/date_to only affect new_move_ins (Resident.move_in_date is the
    only date-like column this table has to filter on).
    """
    effective_from, effective_to = _validate_and_default_range(date_from, date_to)

    status_counts = residents_crud.get_status_counts(db)
    total_residents = sum(count for _, count in status_counts)
    occupied, total_flats = residents_crud.get_occupancy_counts(db)
    occupancy_rate = round(occupied / total_flats, 4) if total_flats else 0.0
    block_counts = residents_crud.get_block_counts(db)
    new_move_ins = residents_crud.get_new_move_ins_count(db, effective_from, effective_to)

    return ResidentsReportOut(
        date_from=effective_from,
        date_to=effective_to,
        total_residents=total_residents,
        by_status=_label_counts(status_counts),
        occupancy_rate=occupancy_rate,
        by_block=_label_counts(block_counts),
        new_move_ins=new_move_ins,
    )


# ── Visitors ───────────────────────────────────────────────────────────────────

def get_visitors_report(
    db: Session, date_from: date | None, date_to: date | None
) -> VisitorsReportOut:
    effective_from, effective_to = _validate_and_default_range(date_from, date_to)
    dt_from, dt_to = _day_bounds(effective_from, effective_to)

    total = visitors_crud.get_total_count(db, dt_from, dt_to)
    by_status = visitors_crud.get_status_counts(db, dt_from, dt_to)
    by_purpose = visitors_crud.get_purpose_counts(db, dt_from, dt_to)
    days = (effective_to - effective_from).days + 1
    average_per_day = round(total / days, 2) if days else 0.0

    return VisitorsReportOut(
        date_from=effective_from,
        date_to=effective_to,
        total_visitors=total,
        by_status=_label_counts(by_status),
        by_purpose=_label_counts(by_purpose),
        average_per_day=average_per_day,
    )


# ── Maintenance ────────────────────────────────────────────────────────────────

def get_maintenance_report(
    db: Session, date_from: date | None, date_to: date | None
) -> MaintenanceReportOut:
    effective_from, effective_to = _validate_and_default_range(date_from, date_to)

    counts = maintenance_crud.get_schedule_counts(db, effective_from, effective_to, date.today())

    return MaintenanceReportOut(
        date_from=effective_from,
        date_to=effective_to,
        total_scheduled=counts["total"],
        upcoming_count=counts["upcoming"],
        past_count=counts["past"],
    )


# ── Temple (BE-33 data) ─────────────────────────────────────────────────────────

def get_temple_report(
    db: Session, date_from: date | None, date_to: date | None
) -> TempleReportOut:
    effective_from, effective_to = _validate_and_default_range(date_from, date_to)
    dt_from, dt_to = _day_bounds(effective_from, effective_to)

    active_residents = residents_crud.get_active_count(db)
    bookings = temple_crud.get_booking_report(db, effective_from, effective_to)
    donations = temple_crud.get_donation_report(db, dt_from, dt_to)
    signups = temple_crud.get_event_signup_report(db, dt_from, dt_to)

    donations_count = donations["count"]
    donations_average = (donations["total"] / donations_count) if donations_count else 0

    engaged = [*bookings["residents"], *donations["residents"], *signups["residents"]]

    return TempleReportOut(
        date_from=effective_from,
        date_to=effective_to,
        bookings_total=bookings["total"],
        bookings_by_seva_type=_label_counts(bookings["by_seva_type"]),
        donations_count=donations_count,
        donations_total=donations["total"],
        donations_average=donations_average,
        event_signups_count=signups["total"],
        volunteer_signups_count=signups["volunteer_count"],
        participation_rate=_participation_rate(engaged, active_residents),
    )


# ── Community (BE-34 data) ──────────────────────────────────────────────────────

def get_community_report(
    db: Session, date_from: date | None, date_to: date | None
) -> CommunityReportOut:
    effective_from, effective_to = _validate_and_default_range(date_from, date_to)
    dt_from, dt_to = _day_bounds(effective_from, effective_to)

    active_residents = residents_crud.get_active_count(db)
    activities = community_crud.get_activity_report(db, effective_from, effective_to)
    signups = community_crud.get_signup_report(db, dt_from, dt_to)

    activities_count = activities["total"]
    signups_count = signups["total"]
    average_signups_per_activity = (
        round(signups_count / activities_count, 2) if activities_count else 0.0
    )

    return CommunityReportOut(
        date_from=effective_from,
        date_to=effective_to,
        activities_count=activities_count,
        signups_count=signups_count,
        average_signups_per_activity=average_signups_per_activity,
        participation_rate=_participation_rate(signups["residents"], active_residents),
        by_corner=_label_counts(activities["by_corner"]),
    )
