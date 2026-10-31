"""
FastAPI router for the Reports & Analytics module (BE-36).

All endpoints accept optional date_from/date_to, defaulting to the trailing
30 days when omitted. Complaints and staff already have their own analytics
endpoints and are deliberately not duplicated here.
"""

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.reports import (
    CommunityReportOut,
    MaintenanceReportOut,
    PaymentsReportOut,
    ReportSummaryOut,
    ResidentsReportOut,
    TempleReportOut,
    VisitorsReportOut,
)
from app.services import reports_service as service

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get(
    "/summary",
    response_model=ReportSummaryOut,
    summary="Cross-module headline metrics",
    responses={422: {"description": "date_from is later than date_to"}},
)
def get_summary(
    date_from: date | None = Query(None, description="Start of the range (default: 30 days before date_to)"),
    date_to: date | None = Query(None, description="End of the range (default: today)"),
    db: Session = Depends(get_db),
):
    return service.get_summary(db, date_from, date_to)


@router.get(
    "/payments",
    response_model=PaymentsReportOut,
    summary="Billing and collections aggregates",
    responses={422: {"description": "date_from is later than date_to"}},
)
def get_payments_report(
    date_from: date | None = Query(None, description="Start of the range (default: 30 days before date_to)"),
    date_to: date | None = Query(None, description="End of the range (default: today)"),
    db: Session = Depends(get_db),
):
    return service.get_payments_report(db, date_from, date_to)


@router.get(
    "/residents",
    response_model=ResidentsReportOut,
    summary="Occupancy and residency status aggregates",
    description=(
        "Status counts, occupancy rate and the by-block breakdown are "
        "point-in-time. date_from/date_to only scope new_move_ins."
    ),
    responses={422: {"description": "date_from is later than date_to"}},
)
def get_residents_report(
    date_from: date | None = Query(None, description="Start of the range (default: 30 days before date_to)"),
    date_to: date | None = Query(None, description="End of the range (default: today)"),
    db: Session = Depends(get_db),
):
    return service.get_residents_report(db, date_from, date_to)


@router.get(
    "/visitors",
    response_model=VisitorsReportOut,
    summary="Gate traffic aggregates",
    responses={422: {"description": "date_from is later than date_to"}},
)
def get_visitors_report(
    date_from: date | None = Query(None, description="Start of the range (default: 30 days before date_to)"),
    date_to: date | None = Query(None, description="End of the range (default: today)"),
    db: Session = Depends(get_db),
):
    return service.get_visitors_report(db, date_from, date_to)


@router.get(
    "/maintenance",
    response_model=MaintenanceReportOut,
    summary="Scheduled maintenance aggregates",
    responses={422: {"description": "date_from is later than date_to"}},
)
def get_maintenance_report(
    date_from: date | None = Query(None, description="Start of the range (default: 30 days before date_to)"),
    date_to: date | None = Query(None, description="End of the range (default: today)"),
    db: Session = Depends(get_db),
):
    return service.get_maintenance_report(db, date_from, date_to)


@router.get(
    "/temple",
    response_model=TempleReportOut,
    summary="Temple seva/donation/event aggregates",
    responses={422: {"description": "date_from is later than date_to"}},
)
def get_temple_report(
    date_from: date | None = Query(None, description="Start of the range (default: 30 days before date_to)"),
    date_to: date | None = Query(None, description="End of the range (default: today)"),
    db: Session = Depends(get_db),
):
    return service.get_temple_report(db, date_from, date_to)


@router.get(
    "/community",
    response_model=CommunityReportOut,
    summary="Community corner activity/signup aggregates",
    responses={422: {"description": "date_from is later than date_to"}},
)
def get_community_report(
    date_from: date | None = Query(None, description="Start of the range (default: 30 days before date_to)"),
    date_to: date | None = Query(None, description="End of the range (default: today)"),
    db: Session = Depends(get_db),
):
    return service.get_community_report(db, date_from, date_to)
