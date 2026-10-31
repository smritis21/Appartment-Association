"""
pytest tests for BE-02 — Complaint Status API.

Story:
  As a resident, I want to check the current status of my complaint, so
  that I know whether it is being acted on.
  As a staff member, I want to move a complaint to its next stage, so that
  residents can see progress.

Covers:
  - GET /complaints/{id}/status returns the current stage and a timestamp
  - PUT /complaints/{id}/status advances the complaint and records the change
  - Stage skipping and same-status "transitions" are rejected with 400
  - A closed complaint cannot be moved except back to in_progress (reopen)
  - Unknown complaint_id returns 404
  - Unknown status value returns 400 (BE-02's contract, not the default 422)

Fixtures (client, db_session) are defined in conftest.py.
"""

COMPLAINTS_URL = "/api/v1/complaints"


def _status_url(complaint_id: str) -> str:
    return f"{COMPLAINTS_URL}/{complaint_id}/status"


def _create_complaint(client) -> str:
    response = client.post(
        COMPLAINTS_URL,
        json={
            "category": "Electrical",
            "description": "Tripping breaker",
            "location": "Block A",
        },
    )
    return response.json()["complaint_id"]


def test_new_complaint_reports_submitted(client):
    complaint_id = _create_complaint(client)
    response = client.get(_status_url(complaint_id))

    assert response.status_code == 200
    body = response.json()
    assert body["complaint_id"] == complaint_id
    assert body["status"] == "submitted"
    assert body["timestamp"]


def test_update_status_to_assigned_succeeds(client):
    complaint_id = _create_complaint(client)
    response = client.put(_status_url(complaint_id), json={"status": "assigned"})

    assert response.status_code == 200
    assert response.json()["status"] == "assigned"


def test_status_change_is_visible_on_get(client):
    complaint_id = _create_complaint(client)
    client.put(_status_url(complaint_id), json={"status": "assigned"})

    response = client.get(_status_url(complaint_id))
    assert response.json()["status"] == "assigned"


def test_skipping_a_stage_returns_400(client):
    complaint_id = _create_complaint(client)
    response = client.put(_status_url(complaint_id), json={"status": "resolved"})
    assert response.status_code == 400


def test_repeating_current_status_returns_400(client):
    complaint_id = _create_complaint(client)
    response = client.put(_status_url(complaint_id), json={"status": "submitted"})
    assert response.status_code == 400


def test_resolved_complaint_can_be_reopened(client):
    complaint_id = _create_complaint(client)
    client.put(_status_url(complaint_id), json={"status": "assigned"})
    client.put(_status_url(complaint_id), json={"status": "in_progress"})
    client.put(_status_url(complaint_id), json={"status": "resolved"})

    reopened = client.put(_status_url(complaint_id), json={"status": "in_progress"})
    assert reopened.status_code == 200


def test_closed_complaint_is_terminal(client):
    complaint_id = _create_complaint(client)
    client.put(_status_url(complaint_id), json={"status": "assigned"})
    client.put(_status_url(complaint_id), json={"status": "in_progress"})
    client.put(_status_url(complaint_id), json={"status": "resolved"})
    client.put(_status_url(complaint_id), json={"status": "closed"})

    blocked = client.put(_status_url(complaint_id), json={"status": "in_progress"})
    assert blocked.status_code == 400


def test_unknown_status_value_returns_400(client):
    complaint_id = _create_complaint(client)
    response = client.put(_status_url(complaint_id), json={"status": "vanished"})
    assert response.status_code == 400


def test_get_status_unknown_complaint_returns_404(client):
    response = client.get(_status_url("does-not-exist"))
    assert response.status_code == 404


def test_update_status_unknown_complaint_returns_404(client):
    response = client.put(_status_url("does-not-exist"), json={"status": "assigned"})
    assert response.status_code == 404


# ── BE-03: a status change notifies the resident who raised the complaint ─────

from app.models.resident import Flat, Resident


def _seed_resident(db_session):
    flat = Flat(block="C", floor="3", flat_number="301", occupancy_status="occupied")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    resident = Resident(flat_id=flat.flat_id, name="Notified Resident",
                        phone="9876500099", status="active")
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def _raise_complaint(client, raised_by=None):
    payload = {"category": "Plumbing", "description": "Tap is leaking", "location": "C-301"}
    if raised_by:
        payload["raised_by"] = raised_by
    resp = client.post("/api/v1/complaints/", json=payload)
    assert resp.status_code == 201
    return resp.json()["complaint_id"]


def _notifications_for(client, resident_id):
    resp = client.get("/api/v1/notifications", params={"resident_id": resident_id})
    assert resp.status_code == 200
    return resp.json()


def test_a_status_change_notifies_the_resident(client, db_session):
    resident_id = _seed_resident(db_session)
    complaint_id = _raise_complaint(client, raised_by=resident_id)
    assert _notifications_for(client, resident_id)["unread_count"] == 0

    client.put(f"/api/v1/complaints/{complaint_id}/status", json={"status": "assigned"})

    data = _notifications_for(client, resident_id)
    assert data["unread_count"] == 1
    notif = data["notifications"][0]
    assert notif["notification_type"] == "complaint_status_change"
    assert notif["source_module"] == "complaints"
    assert notif["is_read"] is False

    # The list carries a summary; the detail view ties it back to the complaint.
    detail = client.get(
        f"/api/v1/notifications/{notif['notification_id']}",
        params={"resident_id": resident_id},
    ).json()
    assert detail["source_event_id"] == complaint_id
    # The title stays short for the card; the detail names the complaint.
    assert detail["title"] == "Complaint assigned"
    assert "Plumbing" in detail["message"]
    assert "C-301" in detail["message"]


def test_each_status_change_adds_its_own_notification(client, db_session):
    resident_id = _seed_resident(db_session)
    complaint_id = _raise_complaint(client, raised_by=resident_id)

    client.put(f"/api/v1/complaints/{complaint_id}/status", json={"status": "assigned"})
    client.put(f"/api/v1/complaints/{complaint_id}/status", json={"status": "in_progress"})

    assert _notifications_for(client, resident_id)["unread_count"] == 2


def test_a_rejected_transition_does_not_notify(client, db_session):
    """No status change means nothing to tell the resident about."""
    resident_id = _seed_resident(db_session)
    complaint_id = _raise_complaint(client, raised_by=resident_id)

    bad = client.put(f"/api/v1/complaints/{complaint_id}/status", json={"status": "closed"})

    assert bad.status_code == 400
    assert _notifications_for(client, resident_id)["unread_count"] == 0


def test_a_complaint_with_no_resident_still_changes_status(client):
    """An unattributed complaint must not be blocked by having nobody to notify."""
    complaint_id = _raise_complaint(client)

    resp = client.put(f"/api/v1/complaints/{complaint_id}/status", json={"status": "assigned"})

    assert resp.status_code == 200
    assert resp.json()["status"] == "assigned"


def test_an_unknown_resident_does_not_block_the_status_change(client):
    complaint_id = _raise_complaint(client, raised_by="no-such-resident")

    resp = client.put(f"/api/v1/complaints/{complaint_id}/status", json={"status": "assigned"})

    assert resp.status_code == 200
