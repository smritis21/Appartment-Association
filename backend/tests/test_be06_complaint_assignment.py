"""
pytest tests for BE-06 — Complaint Assignment API.

Covers:
  - Assign complaint to staff (success, status moves submitted -> assigned)
  - Assignment persists in the database (queried directly, not via the API)
  - Assigning an unknown complaint returns 404
  - Assigning to an unknown staff member returns 404
  - Reassigning an in-progress complaint updates staff without regressing status
  - Missing staff_id in the request body returns 422

Fixtures (client, db_session) are defined in conftest.py.
"""

from app.models.complaint import Complaint, Staff


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_staff(db_session, **overrides) -> str:
    """Insert a staff member directly into the test DB and return its staff_id."""
    defaults = {"name": "Raju Kumar", "role": "maintenance", "phone": "9876500001"}
    defaults.update(overrides)
    staff = Staff(**defaults)
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)
    return staff.staff_id


def seed_complaint(db_session, **overrides) -> str:
    """Insert a complaint directly into the test DB and return its complaint_id."""
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


# ── Assign — success ──────────────────────────────────────────────────────────

def test_assign_complaint_success(client, db_session):
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session)

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/assign",
        json={"staff_id": staff_id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["assigned_to"] == staff_id
    assert body["assigned_at"] is not None
    assert body["status"] == "assigned"
    assert body["assigned_staff"]["staff_id"] == staff_id
    assert body["assigned_staff"]["name"] == "Raju Kumar"


def test_assignment_persists_in_db(client, db_session):
    """AC: 'pytest verifies assignment persistence' — check the DB directly."""
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session)

    client.put(f"/api/v1/complaints/{complaint_id}/assign", json={"staff_id": staff_id})

    persisted = (
        db_session.query(Complaint)
        .filter(Complaint.complaint_id == complaint_id)
        .first()
    )
    assert persisted.assigned_to == staff_id
    assert persisted.assigned_at is not None
    assert persisted.status == "assigned"


def test_reassign_in_progress_complaint_keeps_status(client, db_session):
    """Reassigning a complaint that's already in progress shouldn't reset its status."""
    staff_a = seed_staff(db_session, name="Staff A")
    staff_b = seed_staff(db_session, name="Staff B")
    complaint_id = seed_complaint(db_session, status="in_progress")

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/assign",
        json={"staff_id": staff_b},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["assigned_to"] == staff_b
    assert body["assigned_to"] != staff_a
    assert body["status"] == "in_progress"  # unchanged, not reset to "assigned"


def test_reassign_resolved_complaint_keeps_status(client, db_session):
    """A resolved complaint being reassigned (e.g. reopened work) must not
    silently jump back to "assigned" — only BE-16 should ever change status."""
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="resolved")

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/assign",
        json={"staff_id": staff_id},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "resolved"


def test_reassign_closed_complaint_keeps_status(client, db_session):
    staff_id = seed_staff(db_session)
    complaint_id = seed_complaint(db_session, status="closed")

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/assign",
        json={"staff_id": staff_id},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "closed"


# ── Assign — not found ────────────────────────────────────────────────────────

def test_assign_unknown_complaint_returns_404(client, db_session):
    staff_id = seed_staff(db_session)

    response = client.put(
        "/api/v1/complaints/does-not-exist/assign",
        json={"staff_id": staff_id},
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_assign_unknown_staff_returns_404(client, db_session):
    complaint_id = seed_complaint(db_session)

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/assign",
        json={"staff_id": "does-not-exist"},
    )

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ── Assign — validation ───────────────────────────────────────────────────────

def test_assign_missing_staff_id_returns_422(client, db_session):
    complaint_id = seed_complaint(db_session)

    response = client.put(f"/api/v1/complaints/{complaint_id}/assign", json={})

    assert response.status_code == 422


def test_assign_wrong_type_staff_id_returns_422(client, db_session):
    """staff_id must be a string — a JSON number should fail validation
    rather than silently getting coerced."""
    complaint_id = seed_complaint(db_session)

    response = client.put(
        f"/api/v1/complaints/{complaint_id}/assign",
        json={"staff_id": 12345},
    )

    assert response.status_code == 422


def test_assign_null_body_returns_422(client, db_session):
    """No request body at all should fail validation, not 500."""
    complaint_id = seed_complaint(db_session)

    response = client.put(f"/api/v1/complaints/{complaint_id}/assign")

    assert response.status_code == 422
