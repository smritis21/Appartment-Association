"""
EN-02 — Harden Complaint Status Transitions.

Story: as a resident, I want reliable status updates so that invalid stage
transitions are prevented.

Both endpoints that change a complaint's status share one state machine
(app.services.complaint_service.ALLOWED_TRANSITIONS):
  - BE-02  PUT /complaints/{id}/status    (no employee attribution)
  - BE-16  PUT /complaints/{id}/progress  (records the employee)

This suite drives the full 5x5 transition matrix through *both* endpoints and
pins down the edge cases:

  - Every legal move is accepted; every illegal one is rejected with 400.
  - Same-status "changes" are rejected (not a real transition).
  - `closed` is terminal: `closed -> reopened` (and any other move out of
    closed) is rejected with a clear "file a new complaint" message. Reopening
    is only legal from `resolved`.
  - A rejected transition changes nothing — no status change, no audit-trail
    row, no resident notification.
  - Reopening a resolved complaint notifies the resident as a *reopen*.

Fixtures (client, db_session) are defined in conftest.py.
"""

import pytest

from app.models.complaint import Complaint, ComplaintProgressLog, Staff
from app.models.resident import Flat, Resident

STATUSES = ["submitted", "assigned", "in_progress", "resolved", "closed"]

# The single source of truth, mirrored here so the test fails loudly if the
# service's table is changed without the tests being revisited.
LEGAL_TRANSITIONS = {
    ("submitted", "assigned"),
    ("submitted", "in_progress"),
    ("assigned", "in_progress"),
    ("in_progress", "resolved"),
    ("resolved", "closed"),
    ("resolved", "in_progress"),  # reopen
}

ALL_PAIRS = [(a, b) for a in STATUSES for b in STATUSES]


# ── Seeding helpers ─────────────────────────────────────────────────────────────

def seed_staff(db_session) -> str:
    staff = Staff(name="Transition Tester", role="maintenance", phone="9876500002")
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)
    return staff.staff_id


def seed_complaint(db_session, status: str, raised_by: str | None = None) -> str:
    complaint = Complaint(
        category="Electrical",
        description="Breaker keeps tripping.",
        location="A-101",
        status=status,
        raised_by=raised_by,
    )
    db_session.add(complaint)
    db_session.commit()
    db_session.refresh(complaint)
    return complaint.complaint_id


def seed_resident(db_session) -> str:
    flat = Flat(block="C", floor="3", flat_number="303", occupancy_status="occupied")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    resident = Resident(flat_id=flat.flat_id, name="Reopen Resident",
                        phone="9876500303", status="active")
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def status_url(complaint_id: str) -> str:
    return f"/api/v1/complaints/{complaint_id}/status"


def progress_url(complaint_id: str) -> str:
    return f"/api/v1/complaints/{complaint_id}/progress"


# ── Full transition matrix — BE-02 /status ──────────────────────────────────────

class TestStatusEndpointMatrix:

    @pytest.mark.parametrize("from_status,to_status", ALL_PAIRS)
    def test_every_transition_is_allowed_iff_in_the_table(
        self, client, db_session, from_status, to_status
    ):
        complaint_id = seed_complaint(db_session, status=from_status)
        resp = client.put(status_url(complaint_id), json={"status": to_status})

        if (from_status, to_status) in LEGAL_TRANSITIONS:
            assert resp.status_code == 200, (from_status, to_status, resp.json())
            assert resp.json()["status"] == to_status
        else:
            assert resp.status_code == 400, (from_status, to_status, resp.json())


# ── Full transition matrix — BE-16 /progress ────────────────────────────────────

class TestProgressEndpointMatrix:

    @pytest.mark.parametrize("from_status,to_status", ALL_PAIRS)
    def test_every_transition_is_allowed_iff_in_the_table(
        self, client, db_session, from_status, to_status
    ):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session, status=from_status)
        resp = client.put(
            progress_url(complaint_id),
            json={"status": to_status, "employee_id": staff_id},
        )

        if (from_status, to_status) in LEGAL_TRANSITIONS:
            assert resp.status_code == 200, (from_status, to_status, resp.json())
            assert resp.json()["status"] == to_status
        else:
            assert resp.status_code == 400, (from_status, to_status, resp.json())


# ── Edge case: closed is terminal ("closed -> reopened") ────────────────────────

class TestClosedIsTerminal:

    def test_closed_cannot_be_reopened_via_status(self, client, db_session):
        complaint_id = seed_complaint(db_session, status="closed")
        resp = client.put(status_url(complaint_id), json={"status": "in_progress"})
        assert resp.status_code == 400
        detail = resp.json()["detail"].lower()
        assert "terminal" in detail
        assert "new complaint" in detail

    def test_closed_cannot_be_reopened_via_progress(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session, status="closed")
        resp = client.put(
            progress_url(complaint_id),
            json={"status": "in_progress", "employee_id": staff_id},
        )
        assert resp.status_code == 400
        assert "terminal" in resp.json()["detail"].lower()

    @pytest.mark.parametrize("target", ["submitted", "assigned", "resolved"])
    def test_closed_rejects_every_other_target(self, client, db_session, target):
        complaint_id = seed_complaint(db_session, status="closed")
        resp = client.put(status_url(complaint_id), json={"status": target})
        assert resp.status_code == 400


# ── Edge case: reopening a resolved complaint IS allowed ─────────────────────────

class TestResolvedCanReopen:

    def test_resolved_reopens_to_in_progress_via_status(self, client, db_session):
        complaint_id = seed_complaint(db_session, status="resolved")
        resp = client.put(status_url(complaint_id), json={"status": "in_progress"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    def test_resolved_reopens_to_in_progress_via_progress(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session, status="resolved")
        resp = client.put(
            progress_url(complaint_id),
            json={"status": "in_progress", "employee_id": staff_id},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    def test_reopen_notifies_resident_as_a_reopen(self, client, db_session):
        resident_id = seed_resident(db_session)
        complaint_id = seed_complaint(db_session, status="resolved", raised_by=resident_id)

        client.put(status_url(complaint_id), json={"status": "in_progress"})

        data = client.get(
            "/api/v1/notifications", params={"resident_id": resident_id}
        ).json()
        assert data["unread_count"] == 1
        notif = data["notifications"][0]
        assert notif["title"] == "Complaint reopened"
        detail = client.get(
            f"/api/v1/notifications/{notif['notification_id']}",
            params={"resident_id": resident_id},
        ).json()
        assert "reopened" in detail["message"].lower()


# ── Same-status "changes" are rejected with a clear reason ──────────────────────

class TestSameStatusRejected:

    @pytest.mark.parametrize("state", STATUSES)
    def test_same_status_is_rejected(self, client, db_session, state):
        complaint_id = seed_complaint(db_session, status=state)
        resp = client.put(status_url(complaint_id), json={"status": state})
        assert resp.status_code == 400
        assert "already" in resp.json()["detail"].lower()


# ── Illegal-move error messages are specific and actionable ─────────────────────

class TestErrorMessages:

    def test_skip_ahead_lists_the_valid_next_states(self, client, db_session):
        complaint_id = seed_complaint(db_session, status="submitted")
        resp = client.put(status_url(complaint_id), json={"status": "resolved"})
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        # Keeps the phrase existing callers match on, and names the real options.
        assert "cannot transition" in detail.lower()
        assert "assigned" in detail and "in_progress" in detail

    def test_backward_move_is_rejected(self, client, db_session):
        complaint_id = seed_complaint(db_session, status="in_progress")
        resp = client.put(status_url(complaint_id), json={"status": "assigned"})
        assert resp.status_code == 400
        assert "cannot transition" in resp.json()["detail"].lower()


# ── A rejected transition is a complete no-op ───────────────────────────────────

class TestRejectedTransitionIsNoOp:

    def test_rejected_status_change_does_not_change_stored_status(self, client, db_session):
        complaint_id = seed_complaint(db_session, status="submitted")
        client.put(status_url(complaint_id), json={"status": "closed"})

        stored = db_session.get(Complaint, complaint_id)
        db_session.refresh(stored)
        assert stored.status == "submitted"

    def test_rejected_status_change_writes_no_audit_log(self, client, db_session):
        complaint_id = seed_complaint(db_session, status="submitted")
        client.put(status_url(complaint_id), json={"status": "resolved"})

        logs = (
            db_session.query(ComplaintProgressLog)
            .filter(ComplaintProgressLog.complaint_id == complaint_id)
            .all()
        )
        assert logs == []

    def test_rejected_transition_does_not_notify(self, client, db_session):
        resident_id = seed_resident(db_session)
        complaint_id = seed_complaint(db_session, status="closed", raised_by=resident_id)

        resp = client.put(status_url(complaint_id), json={"status": "in_progress"})
        assert resp.status_code == 400

        data = client.get(
            "/api/v1/notifications", params={"resident_id": resident_id}
        ).json()
        assert data["unread_count"] == 0
