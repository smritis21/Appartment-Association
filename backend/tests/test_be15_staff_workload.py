"""
pytest tests for BE-15 — Staff Workload API.

Covers:
  - Empty state (no staff) returns an empty list
  - A staff member with no assignments shows zero/zero, not omitted
  - Ongoing (assigned/in_progress) vs completed (resolved/closed) counts
    split correctly per staff member
  - Unassigned complaints (no assigned_to) never appear in anyone's counts
  - Results are sorted by name
  - Reassigning a complaint (via BE-06's assign endpoint) moves it out of
    the old staff member's workload and into the new one's — an
    integration check across the two stories, not just BE-15 in isolation

Fixtures (client, db_session) are defined in conftest.py.
"""

from app.models.complaint import Complaint, Staff


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
        "description": "Test complaint",
        "location": "A-101",
        "raised_by": "resident-001",
        "status": "submitted",
    }
    defaults.update(overrides)
    complaint = Complaint(**defaults)
    db_session.add(complaint)
    db_session.commit()
    db_session.refresh(complaint)
    return complaint.complaint_id


# ── Empty / zero states ─────────────────────────────────────────────────────────

def test_workload_empty_when_no_staff(client, db_session):
    response = client.get("/api/v1/staff/workload")

    assert response.status_code == 200
    assert response.json() == []


def test_workload_shows_zero_for_staff_with_no_assignments(client, db_session):
    seed_staff(db_session, name="Idle Staffer")

    response = client.get("/api/v1/staff/workload")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["assigned_count"] == 0
    assert body[0]["completed_count"] == 0


# ── Counts ───────────────────────────────────────────────────────────────────

def test_workload_splits_ongoing_and_completed(client, db_session):
    staff_id = seed_staff(db_session, name="Busy Staffer")
    seed_complaint(db_session, status="assigned", assigned_to=staff_id)
    seed_complaint(db_session, status="in_progress", assigned_to=staff_id)
    seed_complaint(db_session, status="resolved", assigned_to=staff_id)
    seed_complaint(db_session, status="closed", assigned_to=staff_id)

    response = client.get("/api/v1/staff/workload")

    body = response.json()
    assert len(body) == 1
    assert body[0]["assigned_count"] == 2    # assigned + in_progress
    assert body[0]["completed_count"] == 2   # resolved + closed


def test_workload_unassigned_complaints_not_counted(client, db_session):
    staff_id = seed_staff(db_session)
    seed_complaint(db_session, status="submitted", assigned_to=None)  # never assigned

    response = client.get("/api/v1/staff/workload")

    body = response.json()
    assert body[0]["assigned_count"] == 0
    assert body[0]["completed_count"] == 0


def test_workload_separates_counts_per_staff_member(client, db_session):
    staff_a = seed_staff(db_session, name="Staff A")
    staff_b = seed_staff(db_session, name="Staff B")
    seed_complaint(db_session, status="in_progress", assigned_to=staff_a)
    seed_complaint(db_session, status="in_progress", assigned_to=staff_a)
    seed_complaint(db_session, status="resolved", assigned_to=staff_b)

    response = client.get("/api/v1/staff/workload")

    by_id = {row["staff_id"]: row for row in response.json()}
    assert by_id[staff_a]["assigned_count"] == 2
    assert by_id[staff_a]["completed_count"] == 0
    assert by_id[staff_b]["assigned_count"] == 0
    assert by_id[staff_b]["completed_count"] == 1


def test_workload_sorted_by_name(client, db_session):
    seed_staff(db_session, name="Zainab")
    seed_staff(db_session, name="Arun")
    seed_staff(db_session, name="Meera")

    response = client.get("/api/v1/staff/workload")

    names = [row["name"] for row in response.json()]
    assert names == sorted(names)


# ── Integration with BE-06 (assignment) ─────────────────────────────────────────

def test_reassigning_a_complaint_moves_workload_between_staff(client, db_session):
    """Uses the real /complaints/{id}/assign endpoint (BE-06), not direct DB
    writes, to prove the two stories work together correctly."""
    staff_a = seed_staff(db_session, name="Original Staffer")
    staff_b = seed_staff(db_session, name="New Staffer")
    complaint_id = seed_complaint(db_session, status="submitted")

    client.put(f"/api/v1/complaints/{complaint_id}/assign", json={"staff_id": staff_a})
    before = {row["staff_id"]: row for row in client.get("/api/v1/staff/workload").json()}
    assert before[staff_a]["assigned_count"] == 1
    assert before[staff_b]["assigned_count"] == 0

    client.put(f"/api/v1/complaints/{complaint_id}/assign", json={"staff_id": staff_b})
    after = {row["staff_id"]: row for row in client.get("/api/v1/staff/workload").json()}
    assert after[staff_a]["assigned_count"] == 0
    assert after[staff_b]["assigned_count"] == 1
