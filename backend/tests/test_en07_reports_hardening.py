"""
EN-07 — Harden Complaint Reports / Stats.

Story: as the Association President, I want dependable reports so that ranges
and empty months are accurate.

Two parts:
  1. Unit tests for the average resolution-time calculation
     (complaint_service.average_resolution_hours) — a pure function, tested
     without a database: empty input, missing timestamps, anomalous negatives,
     rounding, and a real average.
  2. Integration tests that the /complaints/stats report is accurate for empty
     months, the partial current month, month-boundary resolutions, range
     bounds (trend_months 1..24), and an empty database.

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.models.complaint import Complaint, ComplaintProgressLog, Staff
from app.services.complaint_service import average_resolution_hours

STATS_URL = "/api/v1/complaints/stats"


# ── Part 1: the calculation, in isolation ───────────────────────────────────────

class TestAverageResolutionHoursUnit:

    def test_empty_is_none(self):
        assert average_resolution_hours([]) is None

    def test_single_pair(self):
        created = datetime(2026, 1, 1, 0, 0, 0)
        resolved = datetime(2026, 1, 1, 5, 0, 0)   # 5 hours
        assert average_resolution_hours([(created, resolved)]) == 5.0

    def test_average_of_several(self):
        base = datetime(2026, 1, 1, 0, 0, 0)
        pairs = [
            (base, base + timedelta(hours=2)),
            (base, base + timedelta(hours=4)),
            (base, base + timedelta(hours=6)),
        ]
        assert average_resolution_hours(pairs) == 4.0

    def test_result_is_rounded_to_two_dp(self):
        base = datetime(2026, 1, 1, 0, 0, 0)
        pairs = [
            (base, base + timedelta(hours=1)),
            (base, base + timedelta(hours=2)),
        ]  # (1 + 2) / 2 = 1.5, but test a value that needs rounding:
        pairs.append((base, base + timedelta(minutes=10)))  # +0.1667h
        # (1 + 2 + 0.16667)/3 = 1.05556 -> 1.06
        assert average_resolution_hours(pairs) == 1.06

    def test_same_instant_is_zero(self):
        t = datetime(2026, 1, 1, 9, 0, 0)
        assert average_resolution_hours([(t, t)]) == 0.0

    def test_missing_timestamp_is_skipped(self):
        base = datetime(2026, 1, 1, 0, 0, 0)
        pairs = [(base, None), (base, base + timedelta(hours=3))]
        assert average_resolution_hours(pairs) == 3.0   # the None pair ignored

    def test_all_missing_is_none(self):
        base = datetime(2026, 1, 1, 0, 0, 0)
        assert average_resolution_hours([(base, None), (None, base)]) is None

    def test_negative_duration_is_clamped_to_zero(self):
        base = datetime(2026, 1, 1, 12, 0, 0)
        earlier = base - timedelta(hours=5)            # resolved before created
        # One clamped-to-0 and one real 4h -> (0 + 4)/2 = 2.0
        pairs = [(base, earlier), (base, base + timedelta(hours=4))]
        assert average_resolution_hours(pairs) == 2.0

    def test_fractional_hours(self):
        base = datetime(2026, 1, 1, 0, 0, 0)
        assert average_resolution_hours([(base, base + timedelta(minutes=90))]) == 1.5


# ── Integration helpers ─────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _months_ago(months: int) -> datetime:
    now = _now()
    year, month = now.year, now.month
    for _ in range(months):
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return datetime(year, month, 15, 12, 0, 0)


def seed_staff(db_session) -> str:
    staff = Staff(name="Resolver", role="maintenance", phone="9876500001")
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)
    return staff.staff_id


def seed_resolved_complaint(db_session, created_at, resolved_at, employee_id):
    """A complaint created at `created_at` and resolved at `resolved_at` via a
    real progress-log row, so the stats resolution logic sees an audit date."""
    c = Complaint(category="plumbing", description="leak", location="A-101",
                  raised_by="resident-001", status="resolved",
                  created_at=created_at, updated_at=resolved_at)
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    db_session.add(ComplaintProgressLog(complaint_id=c.complaint_id, employee_id=employee_id,
                                        status="resolved", notes=None, updated_at=resolved_at))
    db_session.commit()
    return c.complaint_id


def _point(body, period):
    return next(p for p in body["trend"] if p["period"] == period)


def _period(dt) -> str:
    return f"{dt.year:04d}-{dt.month:02d}"


# ── Part 2a: empty database and empty months ────────────────────────────────────

class TestEmptyReports:

    def test_empty_database_has_no_average_and_zero_sample(self, client, db_session):
        body = client.get(STATS_URL).json()
        assert body["avg_resolution_hours"] is None
        assert body["resolved_sample_size"] == 0

    def test_every_month_is_present_with_null_average(self, client, db_session):
        body = client.get(STATS_URL).json()
        assert len(body["trend"]) == body["trend_months"]
        assert all(p["resolved"] == 0 for p in body["trend"])
        assert all(p["avg_resolution_hours"] is None for p in body["trend"])

    def test_a_month_with_no_resolutions_reports_null_not_zero(self, client, db_session):
        staff = seed_staff(db_session)
        # Resolve something only in the current month; an earlier month stays empty.
        now = _now()
        seed_resolved_complaint(db_session, now - timedelta(hours=2), now, staff)

        body = client.get(STATS_URL).json()
        empty_month = _point(body, _period(_months_ago(3)))
        assert empty_month["resolved"] == 0
        assert empty_month["avg_resolution_hours"] is None   # null, never 0.0


# ── Part 2b: the average is accurate and month-scoped ────────────────────────────

class TestAverageIsAccurate:

    def test_overall_average_matches_seeded_durations(self, client, db_session):
        staff = seed_staff(db_session)
        now = _now()
        seed_resolved_complaint(db_session, now - timedelta(hours=2), now, staff)  # 2h
        seed_resolved_complaint(db_session, now - timedelta(hours=6), now, staff)  # 6h

        body = client.get(STATS_URL).json()
        assert body["avg_resolution_hours"] == 4.0
        assert body["resolved_sample_size"] == 2

    def test_per_month_average_is_scoped_to_that_month(self, client, db_session):
        staff = seed_staff(db_session)
        now = _now()
        last_month = _months_ago(1)
        # This month: a 4h resolution. Last month: a 10h resolution.
        seed_resolved_complaint(db_session, now - timedelta(hours=4), now, staff)
        seed_resolved_complaint(db_session, last_month - timedelta(hours=10), last_month, staff)

        body = client.get(STATS_URL).json()
        assert _point(body, _period(now))["avg_resolution_hours"] == 4.0
        assert _point(body, _period(last_month))["avg_resolution_hours"] == 10.0


# ── Part 2c: partial current month and month-boundary resolutions ────────────────

class TestPartialAndBoundaryMonths:

    def test_partial_current_month_counts_what_is_resolved_so_far(self, client, db_session):
        staff = seed_staff(db_session)
        now = _now()
        seed_resolved_complaint(db_session, now - timedelta(hours=3), now, staff)

        body = client.get(STATS_URL).json()
        current = _point(body, _period(now))
        assert current["resolved"] == 1
        assert current["avg_resolution_hours"] == 3.0
        # The current (partial) month is the last point in the series.
        assert body["trend"][-1]["period"] == _period(now)

    def test_resolution_spanning_a_month_boundary_lands_in_the_resolved_month(self, client, db_session):
        """Created last month, resolved this month: counted in this month, and
        its long duration is reflected in this month's average."""
        staff = seed_staff(db_session)
        now = _now()
        created = _months_ago(1)                       # last month
        resolved_at = now                              # this month
        seed_resolved_complaint(db_session, created, resolved_at, staff)

        body = client.get(STATS_URL).json()
        assert _point(body, _period(now))["resolved"] == 1
        assert _point(body, _period(_months_ago(1)))["resolved"] == 0
        # Duration is roughly a month of hours — well over 100.
        assert _point(body, _period(now))["avg_resolution_hours"] > 100


# ── Part 2d: range validation ────────────────────────────────────────────────────

class TestRangeValidation:

    def test_default_window_is_six_months(self, client, db_session):
        body = client.get(STATS_URL).json()
        assert body["trend_months"] == 6
        assert len(body["trend"]) == 6

    def test_minimum_window(self, client, db_session):
        body = client.get(STATS_URL, params={"months": 1}).json()
        assert body["trend_months"] == 1
        assert len(body["trend"]) == 1

    def test_maximum_window(self, client, db_session):
        body = client.get(STATS_URL, params={"months": 24}).json()
        assert body["trend_months"] == 24
        assert len(body["trend"]) == 24

    def test_zero_months_is_rejected(self, client, db_session):
        assert client.get(STATS_URL, params={"months": 0}).status_code == 422

    def test_over_max_months_is_rejected(self, client, db_session):
        assert client.get(STATS_URL, params={"months": 25}).status_code == 422
