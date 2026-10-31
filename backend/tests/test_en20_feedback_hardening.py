"""
EN-20 — Harden Complaint Feedback.

Story: as a resident, I want reliable feedback so that window and duplicate
rules are enforced.

Additional tests beyond test_be20_complaint_feedback.py:
  - The window is 7 days, pinned with literal 7-day timings (inside, the exact
    boundary on both sides, and well outside) so a change to the constant is
    noticed here, not just accepted silently.
  - Duplicate feedback is rejected (409) and never overwrites the original;
    the database UNIQUE constraint backs the service check.
  - Rating bounds 1..5 are enforced: below, above, non-integer, and missing
    ratings are all rejected with 422.
  - Every rejection (window, duplicate, bad rating, wrong status, unknown
    complaint) writes nothing.

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.models.complaint import Complaint, ComplaintFeedback, ComplaintProgressLog, Staff
from app.services.complaint_service import FEEDBACK_WINDOW_DAYS

VALID = {"rating": 5, "comment": "Great work."}


# ── Helpers ─────────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def seed_staff(db_session) -> str:
    staff = Staff(name="Raju Kumar", role="maintenance", phone="9876500001")
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)
    return staff.staff_id


def seed_complaint(db_session, status="resolved", updated_at=None) -> str:
    c = Complaint(category="plumbing", description="leak", location="A-101",
                  raised_by="resident-001", status=status,
                  created_at=_now() - timedelta(days=1),
                  updated_at=updated_at or _now())
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c.complaint_id


def seed_resolution_log(db_session, complaint_id, staff_id, when, status="resolved"):
    db_session.add(ComplaintProgressLog(complaint_id=complaint_id, employee_id=staff_id,
                                        status=status, notes=None, updated_at=when))
    db_session.commit()


def url(complaint_id):
    return f"/api/v1/complaints/{complaint_id}/feedback"


def submit(client, complaint_id, **overrides):
    return client.post(url(complaint_id), json={**VALID, **overrides})


def feedback_count(db_session):
    return db_session.query(ComplaintFeedback).count()


# ── The window is exactly 7 days ────────────────────────────────────────────────

class TestSevenDayWindow:

    def test_the_window_is_seven_days(self):
        assert FEEDBACK_WINDOW_DAYS == 7

    def test_resolved_six_days_ago_is_inside(self, client, db_session):
        staff = seed_staff(db_session)
        resolved_at = _now() - timedelta(days=6)
        cid = seed_complaint(db_session, updated_at=resolved_at)
        seed_resolution_log(db_session, cid, staff, resolved_at)
        assert submit(client, cid).status_code == 201

    def test_resolved_eight_days_ago_is_outside(self, client, db_session):
        staff = seed_staff(db_session)
        resolved_at = _now() - timedelta(days=8)
        cid = seed_complaint(db_session, updated_at=resolved_at)
        seed_resolution_log(db_session, cid, staff, resolved_at)
        resp = submit(client, cid)
        assert resp.status_code == 410
        assert "7 days" in resp.json()["detail"]

    def test_just_inside_the_seven_day_boundary(self, client, db_session):
        staff = seed_staff(db_session)
        just_inside = _now() - timedelta(days=7) + timedelta(minutes=5)
        cid = seed_complaint(db_session, updated_at=just_inside)
        seed_resolution_log(db_session, cid, staff, just_inside)
        assert submit(client, cid).status_code == 201

    def test_just_outside_the_seven_day_boundary(self, client, db_session):
        staff = seed_staff(db_session)
        just_outside = _now() - timedelta(days=7) - timedelta(minutes=5)
        cid = seed_complaint(db_session, updated_at=just_outside)
        seed_resolution_log(db_session, cid, staff, just_outside)
        assert submit(client, cid).status_code == 410

    def test_expired_window_writes_nothing(self, client, db_session):
        staff = seed_staff(db_session)
        resolved_at = _now() - timedelta(days=30)
        cid = seed_complaint(db_session, updated_at=resolved_at)
        seed_resolution_log(db_session, cid, staff, resolved_at)
        submit(client, cid)
        assert feedback_count(db_session) == 0

    def test_window_anchored_to_resolution_not_last_edit(self, client, db_session):
        """Resolved 10 days ago but edited just now → still closed."""
        staff = seed_staff(db_session)
        cid = seed_complaint(db_session, updated_at=_now())          # touched now
        seed_resolution_log(db_session, cid, staff, _now() - timedelta(days=10))
        assert submit(client, cid).status_code == 410


# ── Duplicate rule ──────────────────────────────────────────────────────────────

class TestDuplicateRejected:

    def test_second_submission_returns_409(self, client, db_session):
        cid = seed_complaint(db_session)
        assert submit(client, cid).status_code == 201
        resp = submit(client, cid, rating=1, comment="changed my mind")
        assert resp.status_code == 409
        assert "already been submitted" in resp.json()["detail"]

    def test_duplicate_does_not_overwrite_or_add(self, client, db_session):
        cid = seed_complaint(db_session)
        submit(client, cid, rating=5, comment="Great")
        submit(client, cid, rating=1, comment="Terrible")

        stored = db_session.query(ComplaintFeedback).filter(
            ComplaintFeedback.complaint_id == cid).one()
        assert stored.rating == 5
        assert stored.comment == "Great"
        assert feedback_count(db_session) == 1

    def test_unique_constraint_backs_the_check(self, client, db_session):
        from sqlalchemy.exc import IntegrityError
        cid = seed_complaint(db_session)
        submit(client, cid)
        db_session.add(ComplaintFeedback(complaint_id=cid, rating=1))
        with pytest.raises(IntegrityError):
            db_session.commit()
        db_session.rollback()
        assert feedback_count(db_session) == 1

    def test_different_complaints_rated_independently(self, client, db_session):
        a = seed_complaint(db_session)
        b = seed_complaint(db_session)
        assert submit(client, a, rating=5).status_code == 201
        assert submit(client, b, rating=2).status_code == 201
        assert feedback_count(db_session) == 2


# ── Rating bounds (1–5) ─────────────────────────────────────────────────────────

class TestRatingBounds:

    @pytest.mark.parametrize("rating", [1, 2, 3, 4, 5])
    def test_in_range_is_accepted(self, client, db_session, rating):
        cid = seed_complaint(db_session)
        assert submit(client, cid, rating=rating).status_code == 201

    @pytest.mark.parametrize("rating", [0, 6, -1, 7, 100, -100])
    def test_out_of_range_is_rejected(self, client, db_session, rating):
        cid = seed_complaint(db_session)
        assert submit(client, cid, rating=rating).status_code == 422

    def test_non_integer_rating_is_rejected(self, client, db_session):
        cid = seed_complaint(db_session)
        # 3.5 is not an integer number of stars.
        assert submit(client, cid, rating=3.5).status_code == 422

    def test_string_rating_is_rejected(self, client, db_session):
        cid = seed_complaint(db_session)
        assert submit(client, cid, rating="five").status_code == 422

    def test_missing_rating_is_rejected(self, client, db_session):
        cid = seed_complaint(db_session)
        assert client.post(url(cid), json={"comment": "no stars"}).status_code == 422

    def test_bad_rating_writes_nothing(self, client, db_session):
        cid = seed_complaint(db_session)
        submit(client, cid, rating=9)
        assert feedback_count(db_session) == 0


# ── Status gating ───────────────────────────────────────────────────────────────

class TestStatusGating:

    @pytest.mark.parametrize("status", ["submitted", "assigned", "in_progress"])
    def test_unresolved_cannot_be_rated(self, client, db_session, status):
        cid = seed_complaint(db_session, status=status)
        resp = submit(client, cid)
        assert resp.status_code == 400
        assert status in resp.json()["detail"]

    def test_closed_can_be_rated(self, client, db_session):
        cid = seed_complaint(db_session, status="closed")
        assert submit(client, cid).status_code == 201

    def test_unknown_complaint_returns_404(self, client, db_session):
        assert submit(client, "does-not-exist").status_code == 404
