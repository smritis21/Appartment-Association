"""Service layer for the AI/ML analytics layer (BE-41).

Nearly every module already produces analytics, and each grew its own
shape: reports.py returns LabelCount lists, complaints.py returns
ComplaintStatusCounts/CategoryCount, staff workload returns bare counts.
Adding trend/anomaly/forecast maths to each of them separately would
mean writing the same statistics six times and letting six copies drift
apart.

So this layer sits on top of the analytics that already exist instead.
METRIC_PROVIDERS maps a metric name to a function that builds its
monthly series by calling that module's existing service function
rather than a new query, so if a module changes how it counts
something, this layer changes with it automatically. build_insight()
then runs the shared aiml.py maths over whichever series it was handed
and returns one uniform envelope. Adding a metric is one entry in
METRIC_PROVIDERS, not a new endpoint.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.schemas.analytics import (
    AnomalyOut,
    ForecastPoint,
    InsightOut,
    MetricInfo,
    RiskItemOut,
    RiskOut,
    SeriesPoint,
    TrendOut,
)
from app.services import aiml, llm_provider
from app.services import complaint_service, reports_service

DEFAULT_MONTHS = 6
MIN_MONTHS = 3
MAX_MONTHS = 24
FORECAST_PERIODS = 3


# ── Month-window helpers ─────────────────────────────────────────────────────

def _month_label(year: int, month: int) -> str:
    return f"{date(year, month, 1).strftime('%b')} {year}"


def _month_windows(months: int) -> list[tuple[str, str, date, date]]:
    """
    The last `months` calendar months, oldest first, as
    (period, label, first_day, last_day) - the shape the reports_service
    functions expect, so their per-range logic can be reused per month.
    """
    today = datetime.now(timezone.utc).date()
    year, month = today.year, today.month

    windows = []
    for _ in range(months):
        first = date(year, month, 1)
        last = date(year + (month == 12), (month % 12) + 1, 1) - timedelta(days=1)
        windows.append((f"{year:04d}-{month:02d}", _month_label(year, month), first, last))
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return list(reversed(windows))


def _future_months(count: int) -> list[tuple[str, str]]:
    today = datetime.now(timezone.utc).date()
    year, month = today.year, today.month

    periods = []
    for _ in range(count):
        month += 1
        if month == 13:
            month, year = 1, year + 1
        periods.append((f"{year:04d}-{month:02d}", _month_label(year, month)))
    return periods


# ── Metric providers ─────────────────────────────────────────────────────────
# Each returns [(period, label, value)] oldest-first by delegating to the
# owning module's own service - never by querying tables directly.

def _complaints_series(db: Session, months: int, field: str) -> list[tuple[str, str, float]]:
    stats = complaint_service.get_complaint_stats(db, trend_months=months)
    return [(point.period, point.label, float(getattr(point, field))) for point in stats.trend]


def _complaints_raised(db: Session, months: int):
    return _complaints_series(db, months, "raised")


def _complaints_resolved(db: Session, months: int):
    return _complaints_series(db, months, "resolved")


def _payments_collected(db: Session, months: int):
    return [
        (period, label, float(reports_service.get_payments_report(db, first, last).total_collected))
        for period, label, first, last in _month_windows(months)
    ]


def _payments_outstanding(db: Session, months: int):
    return [
        (period, label, float(reports_service.get_payments_report(db, first, last).total_outstanding))
        for period, label, first, last in _month_windows(months)
    ]


def _visitors_total(db: Session, months: int):
    return [
        (period, label, float(reports_service.get_visitors_report(db, first, last).total_visitors))
        for period, label, first, last in _month_windows(months)
    ]


def _maintenance_scheduled(db: Session, months: int):
    return [
        (period, label, float(reports_service.get_maintenance_report(db, first, last).total_scheduled))
        for period, label, first, last in _month_windows(months)
    ]


METRIC_PROVIDERS: dict[str, dict] = {
    "complaints_raised": {
        "provider": _complaints_raised,
        "label": "Complaints raised",
        "module": "BE-07 Complaints",
        "unit": "complaints",
        "description": "Complaints created per month, sourced from the BE-07 stats trend.",
    },
    "complaints_resolved": {
        "provider": _complaints_resolved,
        "label": "Complaints resolved",
        "module": "BE-07 Complaints",
        "unit": "complaints",
        "description": "Complaints reaching resolved/closed per month, sourced from the BE-07 stats trend.",
    },
    "payments_collected": {
        "provider": _payments_collected,
        "label": "Payments collected",
        "module": "BE-36 Reports",
        "unit": "INR",
        "description": "Amount collected per month, sourced from the BE-36 payments report.",
    },
    "payments_outstanding": {
        "provider": _payments_outstanding,
        "label": "Payments outstanding",
        "module": "BE-36 Reports",
        "unit": "INR",
        "description": "Amount still outstanding per month, sourced from the BE-36 payments report.",
    },
    "visitors_total": {
        "provider": _visitors_total,
        "label": "Visitors",
        "module": "BE-36 Reports",
        "unit": "visitors",
        "description": "Visitor requests raised per month, sourced from the BE-36 visitors report.",
    },
    "maintenance_scheduled": {
        "provider": _maintenance_scheduled,
        "label": "Maintenance scheduled",
        "module": "BE-36 Reports",
        "unit": "jobs",
        "description": "Maintenance jobs scheduled per month, sourced from the BE-36 maintenance report.",
    },
}


def list_metrics() -> list[MetricInfo]:
    return [
        MetricInfo(
            metric=name,
            label=meta["label"],
            module=meta["module"],
            unit=meta["unit"],
            description=meta["description"],
        )
        for name, meta in sorted(METRIC_PROVIDERS.items())
    ]


# ── Summary composition ──────────────────────────────────────────────────────

def _describe(label: str, unit: str, values: list[float], trend_info: dict, anomalies: list[dict]) -> str:
    """
    The deterministic headline. This sentence is always correct on its own -
    llm_provider may reword it, but every figure in it is computed here.
    """
    if not values:
        return f"No {label.lower()} data has been recorded yet."

    total = round(sum(values), 2)
    latest = values[-1]
    direction = trend_info["direction"]
    change = abs(trend_info["change_pct"])

    if direction == "flat":
        movement = "has stayed broadly flat"
    else:
        movement = f"has trended {direction} by {change:.1f}%"

    sentence = (
        f"{label} {movement} over the last {len(values)} months, "
        f"totalling {total:g} {unit} with {latest:g} in the most recent month."
    )
    if anomalies:
        spikes = sum(1 for a in anomalies if a["kind"] == "spike")
        dips = len(anomalies) - spikes
        parts = []
        if spikes:
            parts.append(f"{spikes} unusual spike{'s' if spikes > 1 else ''}")
        if dips:
            parts.append(f"{dips} unusual dip{'s' if dips > 1 else ''}")
        sentence += f" Watch out for {' and '.join(parts)}."
    return sentence


# ── Insight assembly ─────────────────────────────────────────────────────────

def build_insight(db: Session, metric: str, months: int = DEFAULT_MONTHS) -> InsightOut:
    """
    Run the shared statistics over one registered metric.

    Errors:
      400 - unknown metric
      422 - months outside MIN_MONTHS..MAX_MONTHS (enforced by the router)
    """
    meta = METRIC_PROVIDERS.get(metric)
    if meta is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unknown metric '{metric}'. "
                f"Available metrics: {', '.join(sorted(METRIC_PROVIDERS))}."
            ),
        )

    rows = meta["provider"](db, months)
    values = [value for _, _, value in rows]

    trend_info = aiml.trend(values)
    raw_anomalies = aiml.detect_anomalies(values)
    forecast_values = aiml.linear_forecast(values, FORECAST_PERIODS)

    anomalies = [
        AnomalyOut(
            period=rows[item["index"]][0],
            label=rows[item["index"]][1],
            value=item["value"],
            z_score=item["z_score"],
            kind=item["kind"],
        )
        for item in raw_anomalies
    ]

    forecast = [
        ForecastPoint(period=period, label=label, value=value)
        for (period, label), value in zip(_future_months(len(forecast_values)), forecast_values)
    ]

    summary, source = llm_provider.rephrase(
        _describe(meta["label"], meta["unit"], values, trend_info, raw_anomalies)
    )

    return InsightOut(
        metric=metric,
        label=meta["label"],
        module=meta["module"],
        unit=meta["unit"],
        months=len(rows),
        series=[SeriesPoint(period=p, label=l, value=v) for p, l, v in rows],
        smoothed=aiml.moving_average(values),
        trend=TrendOut(**trend_info),
        anomalies=anomalies,
        forecast=forecast,
        summary=summary,
        summary_source=source,
        generated_at=datetime.now(timezone.utc),
    )


# ── Risk registry ────────────────────────────────────────────────────────────
# Same idea as METRIC_PROVIDERS, for "rank these records" rather than
# "chart this series".

def _band(score: float) -> str:
    if score >= 66:
        return "high"
    if score >= 33:
        return "medium"
    return "low"


# Open work drives the score; finished work is a mild counterweight, since
# a staff member clearing tickets quickly is coping better than their raw
# open count suggests. Weights apply to normalised 0-1 features, not to raw
# counts - see aiml.saturating_ratio.
_WORKLOAD_WEIGHTS = {"open_load": 1.0, "throughput_relief": -0.25}

# Open complaints at which a staff member is considered fully loaded. Above
# this the score saturates, so one extreme outlier can't flatten everyone
# else's ranking into a rounding error.
_WORKLOAD_FULL_LOAD = 10


def _staff_workload_risk(db: Session) -> list[RiskItemOut]:
    rows = complaint_service.get_staff_workload(db)
    items = []
    for row in rows:
        normalised = {
            "open_load": aiml.saturating_ratio(row.assigned_count, _WORKLOAD_FULL_LOAD),
            "throughput_relief": aiml.saturating_ratio(row.completed_count, _WORKLOAD_FULL_LOAD),
        }
        score = aiml.risk_score(normalised, _WORKLOAD_WEIGHTS)
        items.append(
            RiskItemOut(
                id=row.staff_id,
                label=f"{row.name} ({row.role})",
                score=score,
                band=_band(score),
                # Raw counts, not the normalised features - a committee member
                # reading this wants "8 open", not "0.8 open_load".
                factors={
                    "assigned_count": row.assigned_count,
                    "completed_count": row.completed_count,
                },
            )
        )
    return sorted(items, key=lambda item: item.score, reverse=True)


RISK_PROVIDERS: dict[str, dict] = {
    "staff_workload": {
        "provider": _staff_workload_risk,
        "label": "Staff overload risk",
        "module": "BE-15 Staff Workload",
    },
}


def build_risk(db: Session, kind: str) -> RiskOut:
    """
    Rank records by weighted risk score.

    Errors:
      400 - unknown risk kind
    """
    meta = RISK_PROVIDERS.get(kind)
    if meta is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Unknown risk kind '{kind}'. "
                f"Available kinds: {', '.join(sorted(RISK_PROVIDERS))}."
            ),
        )

    items = meta["provider"](db)
    high = [item for item in items if item.band == "high"]

    if not items:
        template = f"No {meta['label'].lower()} data has been recorded yet."
    elif high:
        template = (
            f"{len(high)} of {len(items)} are at high risk, led by "
            f"{high[0].label} at {high[0].score:g}/100."
        )
    else:
        template = f"All {len(items)} are within normal range, highest at {items[0].score:g}/100."

    summary, source = llm_provider.rephrase(template)

    return RiskOut(
        kind=kind,
        label=meta["label"],
        module=meta["module"],
        items=items,
        summary=summary,
        summary_source=source,
        generated_at=datetime.now(timezone.utc),
    )


# ── What deserves attention (BE-41) ──────────────────────────────────────────

# A month that stands this far from the norm is worth a second look.
_ATTENTION_ANOMALY_Z = 1.5
# A swing this large matters even without a single outlier month.
_ATTENTION_CHANGE_PCT = 25.0


def _attention_score(
    trend_info: dict, anomalies: list[dict], rows: list
) -> tuple[float, str | None]:
    """
    How much a metric is asking to be looked at, and why.

    A spike or dip outranks a steady drift, because an unusual month is
    something that happened rather than something that is happening. Below
    both thresholds a metric scores zero and is left out entirely - a list
    that flags everything tells the committee nothing.
    """
    worst = max(anomalies, key=lambda a: abs(a.get("z_score", 0)), default=None)
    if worst and abs(worst.get("z_score", 0)) >= _ATTENTION_ANOMALY_Z:
        kind = "spike" if worst.get("kind") == "spike" else "dip"
        # Anomalies carry the position in the series; the month's name lives
        # in the rows those values came from.
        label = rows[worst["index"]][1]
        return 100 + abs(worst["z_score"]), (
            f"an unusual {kind} in {label} ({worst['value']:g})"
        )

    change = abs(trend_info.get("change_pct") or 0)
    if change >= _ATTENTION_CHANGE_PCT:
        direction = trend_info.get("direction", "flat")
        return change, f"{direction} {change:.0f}% over the period"

    return 0.0, None


def build_attention(db: Session, months: int = DEFAULT_MONTHS, limit: int = 3) -> list[dict]:
    """
    Rank every metric by how much it warrants a closer look.

    Each metric's series is run through the same statistics as a single
    insight, but the model is called at most once - for the leading item - so
    a page that scans everything still costs one request rather than one per
    metric.
    """
    scored: list[dict] = []
    for metric, meta in METRIC_PROVIDERS.items():
        # Providers yield (period, label, value) triples, the same shape
        # build_insight consumes.
        rows = meta["provider"](db, months)
        values = [value for _, _, value in rows]
        if not any(values):
            continue

        trend_info = aiml.trend(values)
        anomalies = aiml.detect_anomalies(values)
        score, reason = _attention_score(trend_info, anomalies, rows)
        if not reason:
            continue

        forecast_values = aiml.linear_forecast(values, 1)
        scored.append({
            "metric": metric,
            "label": meta["label"],
            "unit": meta["unit"],
            "reason": reason,
            "direction": trend_info.get("direction", "flat"),
            "change_pct": trend_info.get("change_pct") or 0.0,
            "latest": values[-1],
            "next_period_forecast": forecast_values[0] if forecast_values else None,
            "score": score,
        })

    scored.sort(key=lambda item: item["score"], reverse=True)
    top = scored[:limit]

    if top:
        headline, source = llm_provider.rephrase(
            f"{top[0]['label']} shows {top[0]['reason']}, now at "
            f"{top[0]['latest']:g} {top[0]['unit']}."
        )
        top[0]["headline"] = headline
        top[0]["headline_source"] = source
    return top
