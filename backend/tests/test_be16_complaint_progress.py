"""
pytest tests for BE-16 — Complaint Progress Update API.

Covers:
  - Progress update success (status changes, audit-trail entry recorded)
  - Multiple sequential updates build a full audit trail, in order
  - Reopening a resolved complaint (resolved -> in_progress) is allowed
  - Invalid transitions are rejected: skipping ahead, from a terminal state
    (closed), and "transitioning" to the same status
  - Update persists in the database (queried directly, not via the API)
  - Unknown complaint / unknown employee return 404
  - Missing required fields return 422

Fixtures (client, db_session) are defined in conftest.py.
"""

from app.models.complaint import Complaint, ComplaintProgressLog, Staff


# ── Helpers ───────────────────────────────────────────────────────────────────

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
        "description": "Kitchen tap is leaking continuously.",
        "location": "A-101",
        "raised_by": "resident-001",
    }
    defaults.update(overrides)
    complaint = Complaint(**defaults)
    db_session.add(complaint)
    db_session.commit()
    db_session.refresh(complaint)
    return complaint.complaint_id


# ── Progress update — success ─────────────────────────────────────────────────

def test_progress_update_success(client, db_session):
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="submitted")

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"status": "assigned", "employee_id": staff_id, "notes": "Picked up the ticket"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "assigned"
    assert len(body["progress_logs"]) == 1
    log = body["progress_logs"][0]
    assert log["status"] == "assigned"
    assert log["employee_id"] == staff_id
    assert log["notes"] == "Picked up the ticket"
    assert log["employee"]["name"] == "Raju Kumar"


def test_progress_builds_audit_trail_in_order(client, db_session):
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="submitted")

    client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"status": "in_progress", "employee_id": staff_id},
    )
    response = client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"status": "resolved", "employee_id": staff_id, "notes": "Fixed the leak"},
    )

    assert response.status_code == 200
    logs = response.json()["progress_logs"]
    assert [entry["status"] for entry in logs] == ["in_progress", "resolved"]


def test_progress_reopen_resolved_complaint(client, db_session):
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="resolved")

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"status": "in_progress", "employee_id": staff_id, "notes": "Resident says it's still leaking"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"


def test_progress_persists_in_db(client, db_session):
    """AC: covered by a pytest test verifying the update actually took effect."""
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="submitted")

    client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"status": "assigned", "employee_id": staff_id},
    )

    complaint = db_session.query(Complaint).filter(Complaint.complaint_id == complaint_id).first()
    assert complaint.status == "assigned"

    logs = (
        db_session.query(ComplaintProgressLog)
        .filter(ComplaintProgressLog.complaint_id == complaint_id)
        .all()
    )
    assert len(logs) == 1
    assert logs[0].employee_id == staff_id
    assert logs[0].status == "assigned"


# ── Progress update — invalid transitions ─────────────────────────────────────

def test_progress_skip_ahead_transition_returns_400(client, db_session):
    """submitted -> resolved skips the required assigned/in_progress steps."""
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="submitted")

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"status": "resolved", "employee_id": staff_id},
    )

    assert response.status_code == 400
    assert "cannot transition" in response.json()["detail"].lower()


def test_progress_from_closed_returns_400(client, db_session):
    """closed is a terminal state — no further transitions allowed."""
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="closed")

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"status": "in_progress", "employee_id": staff_id},
    )

    assert response.status_code == 400


def test_progress_same_status_returns_400(client, db_session):
    """Re-submitting the current status isn't a real transition."""
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="in_progress")

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"status": "in_progress", "employee_id": staff_id},
    )

    assert response.status_code == 400


def test_progress_invalid_transition_does_not_write_audit_log(client, db_session):
    """A rejected transition must not leave a partial audit-trail entry behind."""
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="submitted")

    client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"status": "resolved", "employee_id": staff_id},
    )

    logs = (
        db_session.query(ComplaintProgressLog)
        .filter(ComplaintProgressLog.complaint_id == complaint_id)
        .all()
    )
    assert len(logs) == 0


# ── Progress update — not found ────────────────────────────────────────────────

def test_progress_unknown_complaint_returns_404(client, db_session):
    staff_id = seed_staff(db_session)

    response = client.put(
        "/api/v1/complaints/does-not-exist/progress",
        json={"status": "assigned", "employee_id": staff_id},
    )

    assert response.status_code == 404


def test_progress_unknown_employee_returns_404(client, db_session):
    complaint_id = seed_complaint(db_session, status="submitted")

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"status": "assigned", "employee_id": "does-not-exist"},
    )

    assert response.status_code == 404


# ── Progress update — validation ───────────────────────────────────────────────

def test_progress_missing_status_returns_422(client, db_session):
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="submitted")

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"employee_id": staff_id},
    )

    assert response.status_code == 422


def test_progress_invalid_status_value_returns_422(client, db_session):
    """status must be one of the known ENUM values."""
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="submitted")

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/progress",
        json={"status": "done", "employee_id": staff_id},
    )

    assert response.status_code == 422
