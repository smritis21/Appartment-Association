"""
Pydantic schemas for the AI/ML analytics layer (BE-41).

One response shape for every module. Before this layer each module
described its own numbers differently - reports.py had LabelCount,
complaints.py had ComplaintStatusCounts/CategoryCount, staff workload had
bare fields - so a client wanting "the trend for X" had to learn a new
shape per module. InsightOut is that single shape: any registered metric,
from any module, comes back looking the same.
"""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

TrendDirection = Literal["up", "down", "flat"]
AnomalyKind = Literal["spike", "dip"]
SummarySource = Literal["template", "llm"]


class MetricInfo(BaseModel):
    """One entry in the metric registry - what can be asked for."""

    metric: str = Field(..., description="Identifier to pass to /analytics/insights")
    label: str = Field(..., description="Human-readable name")
    module: str = Field(..., description="Backlog module this metric is sourced from")
    unit: str = Field(..., description="What the values count, e.g. 'complaints', 'INR'")
    description: str


class SeriesPoint(BaseModel):
    period: str = Field(..., description="Month in YYYY-MM form")
    label: str = Field(..., description="Human-readable month label, e.g. 'Aug 2026'")
    value: float


class TrendOut(BaseModel):
    direction: TrendDirection
    change_pct: float = Field(..., description="Percent change, second half vs first half")
    slope: float = Field(..., description="Least-squares slope per period")


class AnomalyOut(BaseModel):
    period: str
    label: str
    value: float
    z_score: float
    kind: AnomalyKind


class ForecastPoint(BaseModel):
    period: str
    label: str
    value: float


class InsightOut(BaseModel):
    """The uniform insight envelope returned for every metric."""

    metric: str
    label: str
    module: str
    unit: str

    months: int = Field(..., description="Number of historical months covered by `series`")
    series: list[SeriesPoint] = []
    smoothed: list[float] = Field([], description="Moving average over `series`, same length")

    trend: TrendOut
    anomalies: list[AnomalyOut] = []
    forecast: list[ForecastPoint] = []

    summary: str = Field(..., description="Plain-English headline")
    summary_source: SummarySource = Field(
        ..., description="'template' when computed offline, 'llm' when reworded by a model"
    )

    generated_at: datetime


class RiskItemOut(BaseModel):
    """One ranked entry in a risk list."""

    id: str
    label: str
    score: float = Field(..., ge=0, le=100, description="0-100, higher means higher risk")
    band: Literal["low", "medium", "high"]
    factors: dict = Field({}, description="The raw inputs the score was computed from")


class RiskOut(BaseModel):
    kind: str
    label: str
    module: str
    items: list[RiskItemOut] = []
    summary: str
    summary_source: SummarySource
    generated_at: datetime
