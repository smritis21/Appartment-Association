"""
pytest tests for BE-20 — Complaint Feedback API.

Story: as a resident, I want a feedback endpoint so that ratings on resolved
complaints are stored.

Covers:
  - POST /complaints/{id}/feedback stores rating and comment
  - Rating bounds (1–5) and the optional comment
  - Only resolved/closed complaints accept feedback; submitted, assigned and
    in_progress are rejected
  - The feedback window (FEEDBACK_WINDOW_DAYS): inside, outside, and both sides
    of the exact boundary
  - The window is anchored to the BE-16 audit entry, not updated_at, so an
    unrelated edit cannot extend or reset it
  - Feedback is one-shot — a second submission is a 409, and it does not
    overwrite the original
  - Rejections write nothing
  - Reading feedback back, including the 404-with-no-feedback case
  - Feedback appears on the complaint payload once stored

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.complaint import Complaint, ComplaintFeedback, ComplaintProgressLog, Staff
from app.services.complaint_service import FEEDBACK_WINDOW_DAYS

VALID_FEEDBACK = {"rating": 5, "comment": "Quick and clean work. Thank you!"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now() -> datetime:
    """Naive UTC — matches what the DateTime columns store."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


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
        "status": "resolved",
        "created_at": _now() - timedelta(days=3),
        "updated_at": _now(),
    }
    defaults.update(overrides)
    complaint = Complaint(**defaults)
    db_session.add(complaint)
    db_session.commit()
    db_session.refresh(complaint)
    return complaint.complaint_id


def seed_resolution_log(db_session, complaint_id, staff_id, when, status="resolved"):
    """Backdate the audit entry that closed a complaint, to move the window."""
    db_session.add(
        ComplaintProgressLog(
            complaint_id=complaint_id,
            employee_id=staff_id,
            status=status,
            notes=None,
            updated_at=when,
        )
    )
    db_session.commit()


def feedback_url(complaint_id: str) -> str:
    return f"/api/v1/complaints/{complaint_id}/feedback"


def submit(client, complaint_id, **overrides):
    payload = {**VALID_FEEDBACK, **overrides}
    return client.post(feedback_url(complaint_id), json=payload)


# ── Happy path ────────────────────────────────────────────────────────────────

def test_feedback_stores_rating_and_comment(client, db_session):
    complaint_id = seed_complaint(db_session)

    response = submit(client, complaint_id)

    assert response.status_code == 201
    body = response.json()
    assert body["rating"] == 5
    assert body["comment"] == "Quick and clean work. Thank you!"
    assert body["complaint_id"] == complaint_id
    assert body["feedback_id"]
    assert body["submitted_at"]


def test_feedback_is_persisted(client, db_session):
    complaint_id = seed_complaint(db_session)

    submit(client, complaint_id, rating=4, comment="Took an extra day.")

    stored = (
        db_session.query(ComplaintFeedback)
        .filter(ComplaintFeedback.complaint_id == complaint_id)
        .one()
    )
    assert stored.rating == 4
    assert stored.comment == "Took an extra day."


def test_feedback_records_who_submitted_it(client, db_session):
    complaint_id = seed_complaint(db_session)

    body = submit(client, complaint_id, submitted_by="resident-001").json()

    assert body["submitted_by"] == "resident-001"


def test_closed_complaints_also_accept_feedback(client, db_session):
    complaint_id = seed_complaint(db_session, status="closed")

    assert submit(client, complaint_id).status_code == 201


# ── Comment handling ──────────────────────────────────────────────────────────

def test_comment_is_optional(client, db_session):
    complaint_id = seed_complaint(db_session)

    response = client.post(feedback_url(complaint_id), json={"rating": 4})

    assert response.status_code == 201
    assert response.json()["comment"] is None


def test_whitespace_only_comment_is_stored_as_null(client, db_session):
    """Otherwise the UI renders an empty speech bubble."""
    complaint_id = seed_complaint(db_session)

    body = submit(client, complaint_id, comment="    ").json()

    assert body["comment"] is None


def test_comment_is_stripped(client, db_session):
    complaint_id = seed_complaint(db_session)

    body = submit(client, complaint_id, comment="  Good work.  ").json()

    assert body["comment"] == "Good work."


# ── Rating validation ─────────────────────────────────────────────────────────

@pytest.mark.parametrize("rating", [1, 2, 3, 4, 5])
def test_all_star_ratings_are_accepted(client, db_session, rating):
    complaint_id = seed_complaint(db_session)

    response = submit(client, complaint_id, rating=rating)

    assert response.status_code == 201
    assert response.json()["rating"] == rating


@pytest.mark.parametrize("rating", [0, 6, -1, 100])
def test_out_of_range_ratings_are_rejected(client, db_session, rating):
    complaint_id = seed_complaint(db_session)

    assert submit(client, complaint_id, rating=rating).status_code == 422


def test_rating_is_required(client, db_session):
    complaint_id = seed_complaint(db_session)

    response = client.post(feedback_url(complaint_id), json={"comment": "No stars"})

    assert response.status_code == 422


# ── Status gating ─────────────────────────────────────────────────────────────

@pytest.mark.parametrize("complaint_status", ["submitted", "assigned", "in_progress"])
def test_unresolved_complaints_cannot_be_rated(client, db_session, complaint_status):
    """There is nothing to rate while the work is still in progress."""
    complaint_id = seed_complaint(db_session, status=complaint_status)

    response = submit(client, complaint_id)

    assert response.status_code == 400
    assert complaint_status in response.json()["detail"]


def test_unresolved_rejection_writes_nothing(client, db_session):
    complaint_id = seed_complaint(db_session, status="in_progress")

    submit(client, complaint_id)

    assert db_session.query(ComplaintFeedback).count() == 0


def test_unknown_complaint_returns_404(client, db_session):
    assert submit(client, "does-not-exist").status_code == 404


# ── Feedback window ───────────────────────────────────────────────────────────

def test_feedback_inside_the_window_is_accepted(client, db_session):
    staff_id = seed_staff(db_session)
    resolved_at = _now() - timedelta(days=FEEDBACK_WINDOW_DAYS - 1)
    complaint_id = seed_complaint(db_session, updated_at=resolved_at)
    seed_resolution_log(db_session, complaint_id, staff_id, resolved_at)

    assert submit(client, complaint_id).status_code == 201


def test_feedback_after_the_window_is_rejected(client, db_session):
    staff_id = seed_staff(db_session)
    resolved_at = _now() - timedelta(days=FEEDBACK_WINDOW_DAYS + 1)
    complaint_id = seed_complaint(db_session, updated_at=resolved_at)
    seed_resolution_log(db_session, complaint_id, staff_id, resolved_at)

    response = submit(client, complaint_id)

    assert response.status_code == 410
    assert str(FEEDBACK_WINDOW_DAYS) in response.json()["detail"]


def test_window_boundary_just_inside_and_just_outside(client, db_session):
    """Both sides of the exact deadline, to pin down an off-by-one."""
    staff_id = seed_staff(db_session)

    just_inside = _now() - timedelta(days=FEEDBACK_WINDOW_DAYS) + timedelta(minutes=5)
    inside_id = seed_complaint(db_session, updated_at=just_inside)
    seed_resolution_log(db_session, inside_id, staff_id, just_inside)
    assert submit(client, inside_id).status_code == 201

    just_outside = _now() - timedelta(days=FEEDBACK_WINDOW_DAYS) - timedelta(minutes=5)
    outside_id = seed_complaint(db_session, updated_at=just_outside)
    seed_resolution_log(db_session, outside_id, staff_id, just_outside)
    assert submit(client, outside_id).status_code == 410


def test_expired_window_writes_nothing(client, db_session):
    staff_id = seed_staff(db_session)
    resolved_at = _now() - timedelta(days=FEEDBACK_WINDOW_DAYS + 5)
    complaint_id = seed_complaint(db_session, updated_at=resolved_at)
    seed_resolution_log(db_session, complaint_id, staff_id, resolved_at)

    submit(client, complaint_id)

    assert db_session.query(ComplaintFeedback).count() == 0


def test_window_is_anchored_to_the_audit_entry_not_updated_at(client, db_session):
    """
    The complaint was resolved long ago but touched recently. Anchoring on
    updated_at would wrongly reopen a window that should have closed — this is
    the bug the audit-trail anchor exists to prevent.
    """
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, updated_at=_now())  # touched just now
    seed_resolution_log(
        db_session,
        complaint_id,
        staff_id,
        _now() - timedelta(days=FEEDBACK_WINDOW_DAYS + 10),  # actually resolved ages ago
    )

    assert submit(client, complaint_id).status_code == 410


def test_window_falls_back_to_updated_at_without_an_audit_entry(client, db_session):
    """Seeded/imported complaints have no progress logs but must still be rateable."""
    complaint_id = seed_complaint(db_session, updated_at=_now() - timedelta(days=1))

    assert submit(client, complaint_id).status_code == 201


def test_reopening_does_not_extend_the_window(client, db_session):
    """
    The window runs from the *first* completion, matching how BE-07 counts a
    resolution, so a later status change cannot hand back an expired window.
    """
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="closed", updated_at=_now())
    seed_resolution_log(
        db_session, complaint_id, staff_id,
        _now() - timedelta(days=FEEDBACK_WINDOW_DAYS + 3), status="resolved",
    )
    seed_resolution_log(db_session, complaint_id, staff_id, _now(), status="closed")

    assert submit(client, complaint_id).status_code == 410


# ── One-shot rule ─────────────────────────────────────────────────────────────

def test_second_submission_is_rejected(client, db_session):
    complaint_id = seed_complaint(db_session)
    assert submit(client, complaint_id).status_code == 201

    response = submit(client, complaint_id, rating=1, comment="Changed my mind")

    assert response.status_code == 409
    assert "already been submitted" in response.json()["detail"]


def test_second_submission_does_not_overwrite_the_original(client, db_session):
    complaint_id = seed_complaint(db_session)
    submit(client, complaint_id, rating=5, comment="Great work")

    submit(client, complaint_id, rating=1, comment="Actually terrible")

    stored = (
        db_session.query(ComplaintFeedback)
        .filter(ComplaintFeedback.complaint_id == complaint_id)
        .one()
    )
    assert stored.rating == 5
    assert stored.comment == "Great work"
    assert db_session.query(ComplaintFeedback).count() == 1


def test_duplicate_feedback_is_blocked_at_the_database_level(client, db_session):
    """
    The 409 above is a service-layer check, which two concurrent requests
    could both pass before either commits. The UNIQUE constraint on
    complaint_id is what actually makes that race impossible, so it is worth
    asserting directly rather than trusting the column definition.
    """
    complaint_id = seed_complaint(db_session)
    submit(client, complaint_id, rating=5)

    db_session.add(ComplaintFeedback(complaint_id=complaint_id, rating=1))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    assert db_session.query(ComplaintFeedback).count() == 1


def test_separate_complaints_are_rated_independently(client, db_session):
    first = seed_complaint(db_session)
    second = seed_complaint(db_session)

    assert submit(client, first, rating=5).status_code == 201
    assert submit(client, second, rating=2).status_code == 201
    assert db_session.query(ComplaintFeedback).count() == 2


# ── Reading it back ───────────────────────────────────────────────────────────

def test_feedback_can_be_read_back(client, db_session):
    complaint_id = seed_complaint(db_session)
    submit(client, complaint_id, rating=4, comment="Solid job")

    response = client.get(feedback_url(complaint_id))

    assert response.status_code == 200
    assert response.json()["rating"] == 4
    assert response.json()["comment"] == "Solid job"


def test_unrated_complaint_has_no_feedback_to_read(client, db_session):
    complaint_id = seed_complaint(db_session)

    response = client.get(feedback_url(complaint_id))

    assert response.status_code == 404
    assert "No feedback" in response.json()["detail"]


def test_reading_feedback_for_an_unknown_complaint_returns_404(client, db_session):
    assert client.get(feedback_url("does-not-exist")).status_code == 404


def test_feedback_appears_on_the_complaint_payload(client, db_session):
    """The assign endpoint returns ComplaintOut — feedback should ride along."""
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session)
    submit(client, complaint_id, rating=3, comment="Average")

    body = client.put(
        f"/api/v1/complaints/{complaint_id}/assign", json={"staff_id": staff_id}
    ).json()

    assert body["feedback"]["rating"] == 3
    assert body["feedback"]["comment"] == "Average"
