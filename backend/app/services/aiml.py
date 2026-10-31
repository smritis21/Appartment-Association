"""Shared statistical helpers for the AI/ML analytics layer (BE-41).

This is the backend counterpart of the `aiml` utility described in the
team's AI/ML Enhancement Plan: one dependency-free module that every
analytics consumer imports, so nobody re-implements the maths.

Functions here work on plain lists of floats - no SQLAlchemy, no
FastAPI, no numpy/scipy - so the module stays importable and testable on
its own from a clean clone with no extra installs. They also tolerate
empty and single-point series, since a society with three complaints in
its first week is the normal case, not an error case. Nothing here talks
to an LLM: these numbers are always computed deterministically, and the
optional LLM in llm_provider.py only rephrases the summary text, so a
model can never invent a figure.
"""

from statistics import mean, pstdev

# A z-score past this many standard deviations is reported as an anomaly.
# 2.0 is deliberately looser than the textbook 3.0: society datasets are
# small (6-24 monthly points), where 3.0 essentially never fires.
ANOMALY_Z_THRESHOLD = 2.0

# Below this many points a series has no meaningful distribution to compare
# against, so anomaly detection returns nothing rather than flagging noise.
MIN_POINTS_FOR_ANOMALIES = 4

# Trend changes smaller than this (in percent) are reported as "flat"
# rather than up/down, so a 1-complaint wobble doesn't read as a spike.
FLAT_TREND_TOLERANCE_PCT = 5.0


def moving_average(series: list[float], window: int = 3) -> list[float]:
    """
    Rolling mean, used to smooth a noisy trend line.

    The result is the same length as the input: leading points average
    over however many values exist so far, so the smoothed line can be
    plotted against the original x-axis without an offset.
    """
    if not series:
        return []
    if window < 1:
        raise ValueError("window must be at least 1.")

    smoothed = []
    for index in range(len(series)):
        start = max(0, index - window + 1)
        smoothed.append(round(mean(series[start : index + 1]), 2))
    return smoothed


def _linear_fit(series: list[float]) -> tuple[float, float]:
    """
    Least-squares fit over x = 0..n-1, returning (slope, intercept).

    Uses the closed-form solution rather than a matrix library so the
    module stays dependency-free.
    """
    n = len(series)
    x_mean = (n - 1) / 2
    y_mean = mean(series)

    denominator = sum((x - x_mean) ** 2 for x in range(n))
    if denominator == 0:  # single point - a flat line through it
        return 0.0, y_mean

    numerator = sum((x - x_mean) * (y - y_mean) for x, y in enumerate(series))
    slope = numerator / denominator
    return slope, y_mean - slope * x_mean


def linear_forecast(series: list[float], periods: int = 3) -> list[float]:
    """
    Project the next `periods` values with a least-squares linear fit.

    Negative projections are clamped to zero: every series this layer
    forecasts is a count or an amount, and "-3 complaints next month" is
    not a meaningful thing to show a committee member.
    """
    if periods < 0:
        raise ValueError("periods must not be negative.")
    if not series or periods == 0:
        return []

    slope, intercept = _linear_fit(series)
    n = len(series)
    return [round(max(0.0, slope * (n + step) + intercept), 2) for step in range(periods)]


def trend(series: list[float]) -> dict:
    """
    Direction and magnitude of change across the series.

    `change_pct` compares the first and second half of the series rather
    than just first-vs-last point, so one freak month at either end does
    not decide the direction on its own.
    """
    if len(series) < 2:
        return {"direction": "flat", "change_pct": 0.0, "slope": 0.0}

    midpoint = len(series) // 2
    first_half = series[:midpoint] or series[:1]
    second_half = series[midpoint:]

    first_mean = mean(first_half)
    second_mean = mean(second_half)

    if first_mean == 0:
        # Going from nothing to something is a rise, but the percentage is
        # undefined - report the direction without a misleading infinity.
        change_pct = 100.0 if second_mean > 0 else 0.0
    else:
        change_pct = ((second_mean - first_mean) / first_mean) * 100

    slope, _ = _linear_fit(series)

    if abs(change_pct) < FLAT_TREND_TOLERANCE_PCT:
        direction = "flat"
    elif change_pct > 0:
        direction = "up"
    else:
        direction = "down"

    return {
        "direction": direction,
        "change_pct": round(change_pct, 2),
        "slope": round(slope, 4),
    }


def detect_anomalies(series: list[float], threshold: float = ANOMALY_Z_THRESHOLD) -> list[dict]:
    """
    Flag unusual spikes and dips by z-score.

    Returns one entry per outlier: its index, value, signed z-score and
    whether it was a spike or a dip. An all-identical series has zero
    standard deviation and correctly yields no anomalies.
    """
    if len(series) < MIN_POINTS_FOR_ANOMALIES:
        return []

    series_mean = mean(series)
    series_sd = pstdev(series)
    if series_sd == 0:
        return []

    anomalies = []
    for index, value in enumerate(series):
        z = (value - series_mean) / series_sd
        if abs(z) >= threshold:
            anomalies.append(
                {
                    "index": index,
                    "value": value,
                    "z_score": round(z, 2),
                    "kind": "spike" if z > 0 else "dip",
                }
            )
    return anomalies


def saturating_ratio(value: float, full_load: float) -> float:
    """
    Map a raw count onto 0-1, where `full_load` and anything above it is 1.0.

    Risk features have to be normalised before they can be weighted against
    each other - otherwise a raw count (23 open complaints) and a raw rate
    sit on wildly different scales and whichever has the bigger units wins
    regardless of its weight. Callers use this to convert their own counts
    before handing them to risk_score.
    """
    if full_load <= 0:
        raise ValueError("full_load must be positive.")
    return min(1.0, max(0.0, value / full_load))


def risk_score(record: dict, weights: dict[str, float]) -> float:
    """
    Weighted 0-100 score used to rank records (e.g. which staff member is
    most overloaded, which flat is most at risk of defaulting).

    Feature values are expected to be normalised to 0-1 first - see
    saturating_ratio(). The score is expressed as a percentage of the
    maximum achievable positive score, so a record that maxes out every
    aggravating factor scores 100 and one with none scores 0. Negative
    weights are mitigating factors and pull the score down.

    Missing keys count as zero so a caller can pass a partially-populated
    record without special-casing every field.
    """
    if not weights:
        return 0.0

    raw = sum(float(record.get(field, 0) or 0) * weight for field, weight in weights.items())

    # Only positive weights can raise the score, so they alone define the
    # ceiling. Dividing by the sum of absolute weights instead would make a
    # fully-loaded record score well under 100 whenever a mitigating factor
    # exists, which is what makes such a scale unreadable.
    max_possible = sum(weight for weight in weights.values() if weight > 0)
    if max_possible == 0:
        return 0.0

    return round(max(0.0, min(100.0, (raw / max_possible) * 100)), 2)
