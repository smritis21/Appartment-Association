"""
EN-16 — Harden Complaint Progress / Audit Trail.

Story: as a maintenance staff member, I want reliable progress updates so that
the audit trail is complete.

Additional tests beyond test_be16_complaint_progress.py:
  - Every accepted update writes exactly one audit-trail row carrying the
    acting employee and a timestamp — checked for each transition type and
    across a full multi-step lifecycle, in order.
  - The recorded employee and status match the request; timestamps are
    non-decreasing along the trail.
  - Negative cases write nothing to the trail:
      * invalid transitions (skip-ahead, same-status, from a terminal state)
      * unknown complaint / unknown employee (404)
      * an inactive staff member — an unauthorised user — (403)

Fixtures (client, db_session) are defined in conftest.py.
"""

from app.models.complaint import Complaint, ComplaintProgressLog, Staff


# ── Seeding ─────────────────────────────────────────────────────────────────────

def seed_staff(db_session, name="Raju Kumar", is_active="true") -> str:
    staff = Staff(name=name, role="maintenance", phone="9876500001", is_active=is_active)
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)
    return staff.staff_id


def seed_complaint(db_session, status="submitted") -> str:
    complaint = Complaint(category="Plumbing", description="Leak", location="A-101",
                          raised_by="resident-001", status=status)
    db_session.add(complaint)
    db_session.commit()
    db_session.refresh(complaint)
    return complaint.complaint_id


def progress_url(complaint_id):
    return f"/api/v1/complaints/{complaint_id}/progress"


def logs_for(db_session, complaint_id):
    return (
        db_session.query(ComplaintProgressLog)
        .filter(ComplaintProgressLog.complaint_id == complaint_id)
        .order_by(ComplaintProgressLog.updated_at)
        .all()
    )


# ── Every accepted update is recorded with employee + timestamp ──────────────────

class TestEveryUpdateIsRecorded:

    def test_single_update_records_employee_and_timestamp(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session, status="submitted")

        resp = client.put(progress_url(complaint_id),
                          json={"status": "assigned", "employee_id": staff_id, "notes": "on it"})
        assert resp.status_code == 200

        rows = logs_for(db_session, complaint_id)
        assert len(rows) == 1
        assert rows[0].employee_id == staff_id
        assert rows[0].status == "assigned"
        assert rows[0].notes == "on it"
        assert rows[0].updated_at is not None

    def test_response_exposes_the_same_audit_entry(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session, status="submitted")

        body = client.put(progress_url(complaint_id),
                         json={"status": "assigned", "employee_id": staff_id}).json()
        assert len(body["progress_logs"]) == 1
        log = body["progress_logs"][0]
        assert log["employee_id"] == staff_id
        assert log["employee"]["staff_id"] == staff_id
        assert log["updated_at"] is not None

    def test_every_step_of_the_lifecycle_is_recorded_in_order(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session, status="submitted")

        steps = ["assigned", "in_progress", "resolved", "in_progress", "resolved", "closed"]
        for step in steps:
            resp = client.put(progress_url(complaint_id),
                              json={"status": step, "employee_id": staff_id})
            assert resp.status_code == 200, step

        rows = logs_for(db_session, complaint_id)
        assert [r.status for r in rows] == steps
        # Every row carries the acting employee and a timestamp.
        assert all(r.employee_id == staff_id for r in rows)
        assert all(r.updated_at is not None for r in rows)
        # Timestamps never go backwards along the trail.
        stamps = [r.updated_at for r in rows]
        assert stamps == sorted(stamps)

    def test_two_staff_updating_are_both_attributed(self, client, db_session):
        alice = seed_staff(db_session, name="Alice")
        bob = seed_staff(db_session, name="Bob")
        complaint_id = seed_complaint(db_session, status="submitted")

        client.put(progress_url(complaint_id), json={"status": "assigned", "employee_id": alice})
        client.put(progress_url(complaint_id), json={"status": "in_progress", "employee_id": bob})

        rows = logs_for(db_session, complaint_id)
        assert [r.employee_id for r in rows] == [alice, bob]

    def test_each_accepted_update_adds_exactly_one_row(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session, status="submitted")

        client.put(progress_url(complaint_id), json={"status": "assigned", "employee_id": staff_id})
        client.put(progress_url(complaint_id), json={"status": "in_progress", "employee_id": staff_id})
        assert len(logs_for(db_session, complaint_id)) == 2


# ── Negative: invalid transitions write nothing ─────────────────────────────────

class TestInvalidTransitionsWriteNothing:

    def test_skip_ahead_is_rejected_and_unrecorded(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session, status="submitted")

        resp = client.put(progress_url(complaint_id),
                          json={"status": "resolved", "employee_id": staff_id})
        assert resp.status_code == 400
        assert logs_for(db_session, complaint_id) == []

    def test_same_status_is_rejected_and_unrecorded(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session, status="in_progress")

        resp = client.put(progress_url(complaint_id),
                          json={"status": "in_progress", "employee_id": staff_id})
        assert resp.status_code == 400
        assert logs_for(db_session, complaint_id) == []

    def test_from_terminal_state_is_rejected_and_unrecorded(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session, status="closed")

        resp = client.put(progress_url(complaint_id),
                          json={"status": "in_progress", "employee_id": staff_id})
        assert resp.status_code == 400
        assert logs_for(db_session, complaint_id) == []

    def test_a_rejected_step_does_not_disturb_earlier_valid_history(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session, status="submitted")

        client.put(progress_url(complaint_id), json={"status": "assigned", "employee_id": staff_id})
        # Illegal next move — must not add or remove a row.
        client.put(progress_url(complaint_id), json={"status": "closed", "employee_id": staff_id})

        rows = logs_for(db_session, complaint_id)
        assert [r.status for r in rows] == ["assigned"]


# ── Negative: unknown / unauthorised users write nothing ────────────────────────

class TestInvalidAndUnauthorisedUsers:

    def test_unknown_complaint_returns_404(self, client, db_session):
        staff_id = seed_staff(db_session)
        resp = client.put(progress_url("does-not-exist"),
                          json={"status": "assigned", "employee_id": staff_id})
        assert resp.status_code == 404

    def test_unknown_employee_returns_404_and_records_nothing(self, client, db_session):
        complaint_id = seed_complaint(db_session, status="submitted")
        resp = client.put(progress_url(complaint_id),
                          json={"status": "assigned", "employee_id": "ghost"})
        assert resp.status_code == 404
        assert logs_for(db_session, complaint_id) == []

    def test_inactive_staff_is_not_authorised(self, client, db_session):
        staff_id = seed_staff(db_session, name="Retired Ravi", is_active="false")
        complaint_id = seed_complaint(db_session, status="submitted")

        resp = client.put(progress_url(complaint_id),
                          json={"status": "assigned", "employee_id": staff_id})
        assert resp.status_code == 403
        assert "not authorised" in resp.json()["detail"].lower()

    def test_inactive_staff_update_changes_nothing(self, client, db_session):
        staff_id = seed_staff(db_session, is_active="false")
        complaint_id = seed_complaint(db_session, status="submitted")

        client.put(progress_url(complaint_id),
                  json={"status": "assigned", "employee_id": staff_id})

        stored = db_session.get(Complaint, complaint_id)
        db_session.refresh(stored)
        assert stored.status == "submitted"          # status untouched
        assert logs_for(db_session, complaint_id) == []  # nothing recorded

    def test_active_staff_still_authorised(self, client, db_session):
        """The guard rejects only inactive staff — an active one works normally."""
        staff_id = seed_staff(db_session, is_active="true")
        complaint_id = seed_complaint(db_session, status="submitted")
        resp = client.put(progress_url(complaint_id),
                          json={"status": "assigned", "employee_id": staff_id})
        assert resp.status_code == 200


# ── Validation still applies ────────────────────────────────────────────────────

class TestValidation:

    def test_missing_employee_id_returns_422(self, client, db_session):
        complaint_id = seed_complaint(db_session, status="submitted")
        resp = client.put(progress_url(complaint_id), json={"status": "assigned"})
        assert resp.status_code == 422

    def test_unknown_status_value_returns_422(self, client, db_session):
        staff_id = seed_staff(db_session)
        complaint_id = seed_complaint(db_session, status="submitted")
        resp = client.put(progress_url(complaint_id),
                          json={"status": "done", "employee_id": staff_id})
        assert resp.status_code == 422
