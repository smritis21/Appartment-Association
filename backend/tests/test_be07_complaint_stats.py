"""
pytest tests for BE-07 — Complaint Statistics API.

Story: as the Association President, I want a stats endpoint so that
dashboard counts and trends can be served.

Covers:
  - Empty database returns zeroed counts and a full (all-zero) trend series,
    not a 404 — a dashboard should render on day one
  - pending / ongoing / completed buckets map to the right statuses
  - total and by_status stay consistent with the buckets
  - Category breakdown is complete and sorted busiest-first
  - Trend has one continuous point per month, current month last, with
    empty months present as zeros
  - "raised" is bucketed by created_at and respects the window boundary
  - "resolved" is bucketed by the audit-trail entry that completed the
    complaint, not by when it was raised
  - The months query parameter is validated (1–24)
  - Integration: moving a complaint through the real /progress endpoint
    (BE-16) shifts it between buckets and into the resolved series

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import datetime, timedelta, timezone

from app.models.complaint import Complaint, ComplaintProgressLog, Staff

STATS_URL = "/api/v1/complaints/stats"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now() -> datetime:
    """Naive UTC — matches what the DateTime columns store."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _months_ago(months: int) -> datetime:
    """
    A timestamp inside the calendar month `months` before the current one.
    Walks the calendar backwards rather than subtracting days, so it lands in
    the intended month regardless of month length. Day 15 keeps it clear of
    month boundaries and timezone drift.
    """
    now = _now()
    year, month = now.year, now.month
    for _ in range(months):
        month -= 1
        if month == 0:
            month, year = 12, year - 1
    return datetime(year, month, 15, 12, 0, 0)


def seed_staff(db_session, **overrides) -> str:
    defaults = {"name": "Raju Kumar", "role": "maintenance", "phone": "9876500001"}
    defaults.update(overrides)
    staff = Staff(**defaults)
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)
    return staff.staff_id


def seed_complaint(db_session, **overrides) -> str:
    defaults = {
        "category": "plumbing",
        "description": "Test complaint",
        "location": "A-101",
        "raised_by": "resident-001",
        "status": "submitted",
        "created_at": _now(),
        "updated_at": _now(),
    }
    defaults.update(overrides)
    complaint = Complaint(**defaults)
    db_session.add(complaint)
    db_session.commit()
    db_session.refresh(complaint)
    return complaint.complaint_id


def seed_progress_log(db_session, complaint_id, employee_id, status, when) -> None:
    """Write an audit-trail row directly, so a resolution date can be backdated."""
    db_session.add(
        ComplaintProgressLog(
            complaint_id=complaint_id,
            employee_id=employee_id,
            status=status,
            notes=None,
            updated_at=when,
        )
    )
    db_session.commit()


def current_period() -> str:
    now = _now()
    return f"{now.year:04d}-{now.month:02d}"


# ── Empty state ───────────────────────────────────────────────────────────────

def test_stats_empty_database_returns_zeroes(client, db_session):
    response = client.get(STATS_URL)

    assert response.status_code == 200
    body = response.json()
    assert body["pending"] == 0
    assert body["ongoing"] == 0
    assert body["completed"] == 0
    assert body["total"] == 0
    assert body["by_category"] == []


def test_stats_empty_database_still_returns_a_full_trend_series(client, db_session):
    """A chart needs an axis even with no data — every month must be present."""
    response = client.get(STATS_URL)

    body = response.json()
    assert len(body["trend"]) == body["trend_months"] == 6
    assert all(point["raised"] == 0 for point in body["trend"])
    assert all(point["resolved"] == 0 for point in body["trend"])


# ── Bucket counts ─────────────────────────────────────────────────────────────

def test_stats_buckets_map_statuses_correctly(client, db_session):
    seed_complaint(db_session, status="submitted")
    seed_complaint(db_session, status="assigned")
    seed_complaint(db_session, status="in_progress")
    seed_complaint(db_session, status="resolved")
    seed_complaint(db_session, status="closed")

    body = client.get(STATS_URL).json()

    assert body["pending"] == 1                       # submitted
    assert body["ongoing"] == 2                       # assigned + in_progress
    assert body["completed"] == 2                     # resolved + closed
    assert body["total"] == 5


def test_stats_buckets_sum_to_total(client, db_session):
    for status in ["submitted", "submitted", "in_progress", "closed"]:
        seed_complaint(db_session, status=status)

    body = client.get(STATS_URL).json()

    assert body["pending"] + body["ongoing"] + body["completed"] == body["total"]


def test_stats_exposes_raw_per_status_counts(client, db_session):
    seed_complaint(db_session, status="submitted")
    seed_complaint(db_session, status="submitted")
    seed_complaint(db_session, status="in_progress")

    body = client.get(STATS_URL).json()

    assert body["by_status"]["submitted"] == 2
    assert body["by_status"]["in_progress"] == 1
    assert body["by_status"]["assigned"] == 0
    assert body["by_status"]["resolved"] == 0
    assert body["by_status"]["closed"] == 0


# ── Category breakdown ────────────────────────────────────────────────────────

def test_stats_category_breakdown_is_sorted_busiest_first(client, db_session):
    seed_complaint(db_session, category="electrical")
    seed_complaint(db_session, category="plumbing")
    seed_complaint(db_session, category="plumbing")
    seed_complaint(db_session, category="plumbing")
    seed_complaint(db_session, category="security")
    seed_complaint(db_session, category="security")

    body = client.get(STATS_URL).json()

    assert body["by_category"] == [
        {"category": "plumbing", "count": 3},
        {"category": "security", "count": 2},
        {"category": "electrical", "count": 1},
    ]


def test_stats_category_counts_sum_to_total(client, db_session):
    seed_complaint(db_session, category="plumbing")
    seed_complaint(db_session, category="lift_maintenance")
    seed_complaint(db_session, category="water_supply")

    body = client.get(STATS_URL).json()

    assert sum(row["count"] for row in body["by_category"]) == body["total"]


# ── Trend: shape ──────────────────────────────────────────────────────────────

def test_stats_trend_is_continuous_and_ends_with_the_current_month(client, db_session):
    body = client.get(STATS_URL).json()
    trend = body["trend"]

    assert trend[-1]["period"] == current_period()
    periods = [point["period"] for point in trend]
    assert periods == sorted(periods)        # oldest first, no gaps out of order
    assert len(set(periods)) == len(periods)  # each month appears exactly once


def test_stats_trend_window_is_configurable(client, db_session):
    body = client.get(f"{STATS_URL}?months=12").json()

    assert body["trend_months"] == 12
    assert len(body["trend"]) == 12
    assert body["trend"][-1]["period"] == current_period()


def test_stats_trend_rejects_out_of_range_windows(client, db_session):
    assert client.get(f"{STATS_URL}?months=0").status_code == 422
    assert client.get(f"{STATS_URL}?months=25").status_code == 422


def test_stats_trend_labels_are_human_readable(client, db_session):
    body = client.get(f"{STATS_URL}?months=1").json()

    point = body["trend"][0]
    year, month = point["period"].split("-")
    assert point["label"].endswith(year)
    assert len(point["label"].split()[0]) == 3   # "Jul", "Aug", ...
    assert int(month) in range(1, 13)


# ── Trend: raised series ──────────────────────────────────────────────────────

def test_stats_trend_counts_complaints_in_the_month_they_were_raised(client, db_session):
    seed_complaint(db_session, created_at=_now())
    seed_complaint(db_session, created_at=_now())
    seed_complaint(db_session, created_at=_months_ago(2))

    trend = {p["period"]: p for p in client.get(STATS_URL).json()["trend"]}

    this_month = current_period()
    two_months_ago = f"{_months_ago(2).year:04d}-{_months_ago(2).month:02d}"
    assert trend[this_month]["raised"] == 2
    assert trend[two_months_ago]["raised"] == 1


def test_stats_trend_excludes_complaints_older_than_the_window(client, db_session):
    """Old complaints still count towards the totals, just not the chart."""
    seed_complaint(db_session, created_at=_months_ago(10))

    body = client.get(f"{STATS_URL}?months=3").json()

    assert body["total"] == 1                                   # still counted overall
    assert sum(p["raised"] for p in body["trend"]) == 0         # outside the window


# ── Trend: resolved series ────────────────────────────────────────────────────

def test_stats_trend_counts_resolutions_by_audit_date_not_creation_date(client, db_session):
    """A complaint raised in an old month but resolved this month lands on
    this month's resolved bar — that is the whole point of the second series."""
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(
        db_session, status="resolved", created_at=_months_ago(3)
    )
    seed_progress_log(db_session, complaint_id, staff_id, "resolved", _now())

    trend = {p["period"]: p for p in client.get(STATS_URL).json()["trend"]}

    raised_period = f"{_months_ago(3).year:04d}-{_months_ago(3).month:02d}"
    assert trend[raised_period]["raised"] == 1
    assert trend[raised_period]["resolved"] == 0
    assert trend[current_period()]["resolved"] == 1


def test_stats_trend_falls_back_to_updated_at_without_an_audit_entry(client, db_session):
    """Seeded/imported complaints have no progress logs — they must still
    appear on the resolved series rather than silently vanishing."""
    seed_complaint(
        db_session, status="closed", created_at=_months_ago(1), updated_at=_now()
    )

    trend = {p["period"]: p for p in client.get(STATS_URL).json()["trend"]}

    assert trend[current_period()]["resolved"] == 1


def test_stats_trend_ignores_open_complaints_in_the_resolved_series(client, db_session):
    seed_complaint(db_session, status="submitted")
    seed_complaint(db_session, status="in_progress")

    body = client.get(STATS_URL).json()

    assert sum(p["resolved"] for p in body["trend"]) == 0


def test_stats_trend_uses_the_first_completion_when_reopened(client, db_session):
    """Resolved -> reopened -> resolved again should count once, on the first
    completion date, so a reopen cannot inflate the series."""
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="closed", created_at=_months_ago(2))
    seed_progress_log(db_session, complaint_id, staff_id, "resolved", _months_ago(2))
    seed_progress_log(db_session, complaint_id, staff_id, "closed", _now())

    body = client.get(STATS_URL).json()
    trend = {p["period"]: p for p in body["trend"]}

    two_months_ago = f"{_months_ago(2).year:04d}-{_months_ago(2).month:02d}"
    assert trend[two_months_ago]["resolved"] == 1
    assert sum(p["resolved"] for p in body["trend"]) == 1


# ── Integration with BE-16 (progress endpoint) ─────────────────────────────────

def test_progress_updates_move_a_complaint_between_buckets(client, db_session):
    """Drives the real /progress endpoint rather than writing statuses directly,
    proving the dashboard reflects live workflow activity."""
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="submitted")

    before = client.get(STATS_URL).json()
    assert (before["pending"], before["ongoing"], before["completed"]) == (1, 0, 0)

    client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"status": "in_progress", "employee_id": staff_id},
    )
    mid = client.get(STATS_URL).json()
    assert (mid["pending"], mid["ongoing"], mid["completed"]) == (0, 1, 0)

    client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"status": "resolved", "employee_id": staff_id, "notes": "Fixed"},
    )
    after = client.get(STATS_URL).json()
    assert (after["pending"], after["ongoing"], after["completed"]) == (0, 0, 1)
    assert after["trend"][-1]["resolved"] == 1
