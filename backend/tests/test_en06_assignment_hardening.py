"""
EN-06 — Harden Complaint Assignment.

Story: as the Association President, I want reliable assignment so that
reassignment and invalid staff are handled.

Additional tests beyond test_be06_complaint_assignment.py:
  - Every assignment and reassignment writes an immutable audit-log entry
    (BE-39), captured in the same transaction as the change.
  - A reassignment records the staff member the complaint was taken from.
  - The audit entry is retrievable through the real admin-only GET /audit API.
  - The `assigned_by` field is recorded as the audit actor.
  - Unknown complaint / unknown staff return 404 and write NO audit entry.
  - An inactive staff member is rejected (400) — an "invalid" staff member is
    not only a non-existent one — and nothing is assigned or audited.
  - Reassigning across workflow states preserves status and still audits.

Fixtures (client, db_session) are defined in conftest.py.
"""

from app.models.audit import AuditLog
from app.models.complaint import Complaint, Staff
from app.models.user import User

ASSIGN = "/api/v1/complaints/{}/assign"


# ── Seeding helpers ─────────────────────────────────────────────────────────────

def seed_staff(db_session, name="Raju Kumar", is_active="true") -> str:
    staff = Staff(name=name, role="maintenance", phone="9876500001", is_active=is_active)
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)
    return staff.staff_id


def seed_complaint(db_session, **overrides) -> str:
    defaults = {
        "category": "Plumbing",
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


def assignment_logs(db_session, complaint_id):
    return (
        db_session.query(AuditLog)
        .filter(AuditLog.module == "complaints", AuditLog.target_id == complaint_id)
        .order_by(AuditLog.timestamp)
        .all()
    )


# ── First assignment is audited ─────────────────────────────────────────────────

class TestAssignmentIsAudited:

    def test_first_assignment_writes_an_audit_entry(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session)

        resp = client.put(ASSIGN.format(complaint_id), json={"staff_id": staff_id})
        assert resp.status_code == 200

        logs = assignment_logs(db_session, complaint_id)
        assert len(logs) == 1
        assert logs[0].action == "complaint_assigned"
        assert logs[0].target_type == "complaint"
        assert staff_id in logs[0].description

    def test_assigned_by_is_recorded_as_the_actor(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session)

        client.put(
            ASSIGN.format(complaint_id),
            json={"staff_id": staff_id, "assigned_by": "president-007"},
        )

        logs = assignment_logs(db_session, complaint_id)
        assert logs[0].actor_id == "president-007"
        assert logs[0].actor_role == "association_president"

    def test_assignment_without_assigned_by_still_audits(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session)
        client.put(ASSIGN.format(complaint_id), json={"staff_id": staff_id})

        logs = assignment_logs(db_session, complaint_id)
        assert len(logs) == 1
        assert logs[0].actor_id is None


# ── Reassignment is supported and audited (with the prior assignee) ─────────────

class TestReassignmentIsAudited:

    def test_reassignment_updates_staff_and_audits_the_move(self, client, db_session):
        staff_a = seed_staff(db_session, name="Staff A")
        staff_b = seed_staff(db_session, name="Staff B")
        complaint_id = seed_complaint(db_session)

        client.put(ASSIGN.format(complaint_id), json={"staff_id": staff_a})
        resp = client.put(ASSIGN.format(complaint_id), json={"staff_id": staff_b})

        assert resp.status_code == 200
        assert resp.json()["assigned_to"] == staff_b

        logs = assignment_logs(db_session, complaint_id)
        assert [log.action for log in logs] == ["complaint_assigned", "complaint_reassigned"]

    def test_reassignment_records_the_previous_assignee(self, client, db_session):
        staff_a = seed_staff(db_session, name="Old Owner")
        staff_b = seed_staff(db_session, name="New Owner")
        complaint_id = seed_complaint(db_session)

        client.put(ASSIGN.format(complaint_id), json={"staff_id": staff_a})
        client.put(ASSIGN.format(complaint_id), json={"staff_id": staff_b})

        reassign_log = assignment_logs(db_session, complaint_id)[-1]
        assert staff_a in reassign_log.description   # taken from
        assert staff_b in reassign_log.description   # given to
        assert "Old Owner" in reassign_log.description

    def test_reassigning_to_the_same_staff_is_still_audited_as_assignment(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session)

        client.put(ASSIGN.format(complaint_id), json={"staff_id": staff_id})
        client.put(ASSIGN.format(complaint_id), json={"staff_id": staff_id})

        logs = assignment_logs(db_session, complaint_id)
        # Same staff twice is not a "reassignment" — no prior different owner.
        assert [log.action for log in logs] == ["complaint_assigned", "complaint_assigned"]

    def test_reassignment_preserves_in_progress_status_and_audits(self, client, db_session):
        staff_a = seed_staff(db_session, name="Staff A")
        staff_b = seed_staff(db_session, name="Staff B")
        complaint_id = seed_complaint(db_session, status="in_progress")

        client.put(ASSIGN.format(complaint_id), json={"staff_id": staff_a})
        resp = client.put(ASSIGN.format(complaint_id), json={"staff_id": staff_b})

        assert resp.json()["status"] == "in_progress"
        assert assignment_logs(db_session, complaint_id)[-1].action == "complaint_reassigned"


# ── Invalid staff / complaint are handled, and never audited ────────────────────

class TestInvalidTargetsAreHandled:

    def test_unknown_complaint_returns_404_and_writes_no_audit(self, client, db_session):
        staff_id = seed_staff(db_session)
        resp = client.put(ASSIGN.format("does-not-exist"), json={"staff_id": staff_id})

        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()
        assert db_session.query(AuditLog).filter(AuditLog.module == "complaints").count() == 0

    def test_unknown_staff_returns_404_and_writes_no_audit(self, client, db_session):
        complaint_id = seed_complaint(db_session)
        resp = client.put(ASSIGN.format(complaint_id), json={"staff_id": "no-such-staff"})

        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()
        assert assignment_logs(db_session, complaint_id) == []

    def test_inactive_staff_is_rejected(self, client, db_session):
        staff_id = seed_staff(db_session, name="Retired Ravi", is_active="false")
        complaint_id = seed_complaint(db_session)

        resp = client.put(ASSIGN.format(complaint_id), json={"staff_id": staff_id})

        assert resp.status_code == 400
        assert "inactive" in resp.json()["detail"].lower()

    def test_inactive_staff_leaves_complaint_unassigned_and_unaudited(self, client, db_session):
        staff_id = seed_staff(db_session, is_active="false")
        complaint_id = seed_complaint(db_session)

        client.put(ASSIGN.format(complaint_id), json={"staff_id": staff_id})

        stored = db_session.get(Complaint, complaint_id)
        db_session.refresh(stored)
        assert stored.assigned_to is None
        assert stored.status == "submitted"
        assert assignment_logs(db_session, complaint_id) == []

    def test_failed_reassignment_does_not_disturb_the_existing_assignment(self, client, db_session):
        good_staff = seed_staff(db_session, name="Good Staff")
        complaint_id = seed_complaint(db_session)
        client.put(ASSIGN.format(complaint_id), json={"staff_id": good_staff})

        # A reassignment to an unknown staff must fail without unassigning.
        resp = client.put(ASSIGN.format(complaint_id), json={"staff_id": "ghost"})
        assert resp.status_code == 404

        stored = db_session.get(Complaint, complaint_id)
        db_session.refresh(stored)
        assert stored.assigned_to == good_staff
        assert len(assignment_logs(db_session, complaint_id)) == 1  # only the first assign


# ── The audit entry is visible through the admin-only GET /audit API ────────────

class TestAuditVisibleViaApi:

    def _admin_headers(self, client, db_session):
        resp = client.post("/api/v1/auth/register", json={
            "email": "assign-admin@jkr.com", "password": "password123",
            "full_name": "Assign Admin", "role": "admin",
        })
        assert resp.status_code == 201
        user = db_session.query(User).filter(User.user_id == resp.json()["user_id"]).first()
        user.account_status = "active"
        db_session.commit()
        login = client.post("/api/v1/auth/login",
                            json={"email": "assign-admin@jkr.com", "password": "password123"})
        assert login.status_code == 200
        # Clear the sign-up's own audit noise so the filter below is clean.
        db_session.query(AuditLog).delete()
        db_session.commit()
        return {"Authorization": f"Bearer {login.json()['access_token']}"}

    def test_assignment_audit_is_queryable_via_audit_endpoint(self, client, db_session):
        headers = self._admin_headers(client, db_session)
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session)
        client.put(ASSIGN.format(complaint_id),
                   json={"staff_id": staff_id, "assigned_by": "president-007"})

        resp = client.get(
            "/api/v1/audit",
            params={"module": "complaints", "action": "complaint_assigned"},
            headers=headers,
        )
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) == 1
        assert items[0]["target_id"] == complaint_id
        assert items[0]["actor_id"] == "president-007"
