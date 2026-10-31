"""
FastAPI router for the AI/ML analytics layer (BE-41).

There is deliberately no per-module AI endpoint. Modules keep their own raw
analytics; this layer sits on top of them, so a new metric is one registry
entry in analytics_service.py rather than a new route.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.analytics import InsightOut, MetricInfo, RiskOut
from app.services import analytics_service as service

router = APIRouter(prefix="/analytics", tags=["AI Analytics"])


@router.get(
    "/metrics",
    response_model=list[MetricInfo],
    summary="List analysable metrics",
    description=(
        "Returns every metric the insights endpoint understands, with the module "
        "each one is sourced from. Clients should read this rather than hard-coding "
        "metric names, so new metrics appear automatically."
    ),
)
def list_metrics():
    return service.list_metrics()


@router.get(
    "/insights",
    response_model=InsightOut,
    summary="Insights for one metric",
    description=(
        "Runs the shared statistics over a registered metric and returns one uniform "
        "envelope: the monthly series, a moving average, trend direction and percent "
        "change, z-score anomalies, a linear forecast for the next 3 months, and a "
        "plain-English summary.\n\n"
        "Every figure is computed deterministically on the server with no external "
        "service. If an optional AI provider is configured it is used only to reword "
        "the summary sentence - `summary_source` reports which path produced the text."
    ),
    responses={
        200: {"description": "Insight generated"},
        400: {"description": "Unknown metric"},
        422: {"description": "months outside the allowed range"},
    },
)
def get_insights(
    metric: str = Query(..., description="Metric name from GET /analytics/metrics"),
    months: int = Query(
        service.DEFAULT_MONTHS,
        ge=service.MIN_MONTHS,
        le=service.MAX_MONTHS,
        description="How many calendar months of history to analyse",
    ),
    db: Session = Depends(get_db),
):
    return service.build_insight(db, metric, months)


@router.get(
    "/risk/{kind}",
    response_model=RiskOut,
    summary="Ranked risk list",
    description=(
        "Scores and ranks records by weighted risk, highest first, each with a "
        "low/medium/high band and the raw factors the score came from."
    ),
    responses={
        200: {"description": "Risk list generated"},
        400: {"description": "Unknown risk kind"},
    },
)
def get_risk(kind: str, db: Session = Depends(get_db)):
    return service.build_risk(db, kind)


@router.get(
    "/attention",
    summary="What in the data warrants a closer look",
    description=(
        "Scans every metric and returns the few that stand out - an unusual "
        "month, or a large swing over the period - ranked by how much they "
        "stand out, with next period's projection. Metrics that are behaving "
        "normally are left out rather than padded in."
    ),
)
def attention(
    months: int = Query(
        service.DEFAULT_MONTHS,
        ge=service.MIN_MONTHS,
        le=service.MAX_MONTHS,
        description="How many calendar months of history to scan",
    ),
    limit: int = Query(3, ge=1, le=6, description="How many findings to return"),
    db: Session = Depends(get_db),
):
    return service.build_attention(db, months=months, limit=limit)
