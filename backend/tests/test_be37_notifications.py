"""
pytest tests for BE-37 — Notification Center API.

Covers:
  - GET /notifications     : retrieval, filtering (type/module/is_read/priority),
                             unread count in envelope, pagination
  - GET /notifications/{id}: success, not found, ownership check
  - PATCH mark-read        : mark single, mark multiple, mark all, already-read idempotency
  - POST /generate         : success (each notification_type), resident not found,
                             validation errors
  - POST /notifications/   : legacy compat retained

Fixtures (client, db_session) come from conftest.py (in-memory SQLite).
"""

import pytest
from app.models.resident import Flat, Resident


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_flat(db_session):
    flat = Flat(block="B", floor="2", flat_number="201",
                ownership_type="owned", occupancy_status="vacant")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    return flat.flat_id


def seed_resident(db_session, name="Test User"):
    flat_id = seed_flat(db_session)
    resident = Resident(flat_id=flat_id, name=name, phone="9876543210", status="active")
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def gen_payload(resident_id, **overrides):
    payload = {
        "resident_id":       resident_id,
        "title":             "Test Notification",
        "message":           "This is a test notification message.",
        "notification_type": "general",
        "source_module":     "general",
        "priority":          "normal",
    }
    payload.update(overrides)
    return payload


def generate(client, resident_id, **overrides):
    """POST to /generate and assert 201."""
    resp = client.post("/api/v1/notifications/generate", json=gen_payload(resident_id, **overrides))
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── POST /api/v1/notifications/generate ──────────────────────────────────────

class TestGenerateNotification:

    def test_generate_success(self, client, db_session):
        """Basic notification generation returns full NotificationOut."""
        rid = seed_resident(db_session)
        resp = client.post("/api/v1/notifications/generate", json=gen_payload(rid))
        assert resp.status_code == 201
        data = resp.json()
        assert data["resident_id"] == rid
        assert data["title"] == "Test Notification"
        assert data["is_read"] is False
        assert data["priority"] == "normal"
        assert "notification_id" in data
        assert "created_at" in data

    def test_generate_complaint_type(self, client, db_session):
        rid = seed_resident(db_session)
        data = generate(client, rid,
                        title="Complaint Resolved",
                        notification_type="complaint_status_change",
                        source_module="complaints",
                        source_event_id="complaint-abc-123",
                        priority="high")
        assert data["notification_type"] == "complaint_status_change"
        assert data["source_module"] == "complaints"
        assert data["source_event_id"] == "complaint-abc-123"
        assert data["priority"] == "high"

    def test_generate_payment_due(self, client, db_session):
        rid = seed_resident(db_session)
        data = generate(client, rid,
                        title="Payment Due",
                        notification_type="payment_due",
                        source_module="payments",
                        priority="high")
        assert data["notification_type"] == "payment_due"

    def test_generate_visitor_approval(self, client, db_session):
        rid = seed_resident(db_session)
        data = generate(client, rid,
                        title="Visitor Approved",
                        notification_type="visitor_approval",
                        source_module="visitors")
        assert data["notification_type"] == "visitor_approval"

    def test_generate_maintenance_update(self, client, db_session):
        rid = seed_resident(db_session)
        data = generate(client, rid,
                        title="Maintenance Scheduled",
                        notification_type="maintenance_update",
                        source_module="maintenance")
        assert data["notification_type"] == "maintenance_update"

    def test_generate_emergency_alert(self, client, db_session):
        rid = seed_resident(db_session)
        data = generate(client, rid,
                        title="Fire Drill",
                        notification_type="emergency_alert",
                        source_module="alerts",
                        priority="high")
        assert data["notification_type"] == "emergency_alert"
        assert data["priority"] == "high"

    def test_generate_resident_not_found(self, client, db_session):
        """Non-existent resident_id must return 404."""
        resp = client.post(
            "/api/v1/notifications/generate",
            json=gen_payload("non-existent-resident-id"),
        )
        assert resp.status_code == 404

    def test_generate_missing_title(self, client, db_session):
        rid = seed_resident(db_session)
        payload = gen_payload(rid)
        del payload["title"]
        resp = client.post("/api/v1/notifications/generate", json=payload)
        assert resp.status_code == 422

    def test_generate_invalid_notification_type(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.post(
            "/api/v1/notifications/generate",
            json=gen_payload(rid, notification_type="invalid_type"),
        )
        assert resp.status_code == 422

    def test_generate_invalid_priority(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.post(
            "/api/v1/notifications/generate",
            json=gen_payload(rid, priority="critical"),
        )
        assert resp.status_code == 422


# ── GET /api/v1/notifications ─────────────────────────────────────────────────

class TestListNotifications:

    def test_list_empty(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.get(f"/api/v1/notifications?resident_id={rid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["unread_count"] == 0
        assert data["notifications"] == []

    def test_list_returns_notifications(self, client, db_session):
        rid = seed_resident(db_session)
        generate(client, rid, title="Notif 1")
        generate(client, rid, title="Notif 2")

        resp = client.get(f"/api/v1/notifications?resident_id={rid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert data["unread_count"] == 2
        assert len(data["notifications"]) == 2

    def test_list_resident_not_found(self, client, db_session):
        resp = client.get("/api/v1/notifications?resident_id=no-such-id")
        assert resp.status_code == 404

    def test_filter_by_notification_type(self, client, db_session):
        rid = seed_resident(db_session)
        generate(client, rid, notification_type="complaint_status_change")
        generate(client, rid, notification_type="payment_due")

        resp = client.get(
            f"/api/v1/notifications?resident_id={rid}&notification_type=payment_due"
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["notifications"][0]["notification_type"] == "payment_due"

    def test_filter_by_source_module(self, client, db_session):
        rid = seed_resident(db_session)
        generate(client, rid, source_module="complaints")
        generate(client, rid, source_module="payments")

        resp = client.get(
            f"/api/v1/notifications?resident_id={rid}&source_module=complaints"
        )
        assert resp.status_code == 200
        assert resp.json()["total"] == 1
        assert resp.json()["notifications"][0]["source_module"] == "complaints"

    def test_filter_by_is_read_false(self, client, db_session):
        """Filter for unread only."""
        rid = seed_resident(db_session)
        generate(client, rid, title="Unread")
        generate(client, rid, title="Also Unread")
        # Mark all read
        client.patch(f"/api/v1/notifications/{rid}/mark-read", json={})
        # Add one more unread
        generate(client, rid, title="New Unread")

        resp = client.get(f"/api/v1/notifications?resident_id={rid}&is_read=false")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["notifications"][0]["title"] == "New Unread"

    def test_filter_by_priority(self, client, db_session):
        rid = seed_resident(db_session)
        generate(client, rid, priority="high")
        generate(client, rid, priority="low")

        resp = client.get(f"/api/v1/notifications?resident_id={rid}&priority=high")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1
        assert resp.json()["notifications"][0]["priority"] == "high"

    def test_unread_count_unaffected_by_type_filter(self, client, db_session):
        """unread_count in the envelope must reflect ALL unread, not just the filtered set."""
        rid = seed_resident(db_session)
        generate(client, rid, notification_type="general")
        generate(client, rid, notification_type="payment_due")
        generate(client, rid, notification_type="payment_due")

        resp = client.get(
            f"/api/v1/notifications?resident_id={rid}&notification_type=payment_due"
        )
        data = resp.json()
        assert data["total"] == 2          # filtered count
        assert data["unread_count"] == 3   # global unread

    def test_list_pagination(self, client, db_session):
        rid = seed_resident(db_session)
        for i in range(6):
            generate(client, rid, title=f"Notif {i}")

        page1 = client.get(f"/api/v1/notifications?resident_id={rid}&skip=0&limit=4").json()
        page2 = client.get(f"/api/v1/notifications?resident_id={rid}&skip=4&limit=4").json()

        assert len(page1["notifications"]) == 4
        assert len(page2["notifications"]) == 2
        assert page1["total"] == 6

    def test_newest_first_ordering(self, client, db_session):
        """Notifications must be ordered newest-first."""
        rid = seed_resident(db_session)
        generate(client, rid, title="First")
        generate(client, rid, title="Second")
        generate(client, rid, title="Third")

        data = client.get(f"/api/v1/notifications?resident_id={rid}").json()
        titles = [n["title"] for n in data["notifications"]]
        assert titles[0] == "Third"
        assert titles[-1] == "First"


# ── GET /api/v1/notifications/{notification_id} ───────────────────────────────

class TestGetNotification:

    def test_get_success(self, client, db_session):
        rid = seed_resident(db_session)
        notif = generate(client, rid, title="Single Get Test")
        nid = notif["notification_id"]

        resp = client.get(f"/api/v1/notifications/{nid}?resident_id={rid}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["notification_id"] == nid
        assert data["title"] == "Single Get Test"
        assert "message" in data

    def test_get_not_found(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.get(f"/api/v1/notifications/no-such-id?resident_id={rid}")
        assert resp.status_code == 404

    def test_get_wrong_resident(self, client, db_session):
        """Fetching another resident's notification must return 403."""
        rid1 = seed_resident(db_session, name="Resident One")
        rid2 = seed_resident(db_session, name="Resident Two")
        notif = generate(client, rid1, title="Belongs to Resident 1")
        nid = notif["notification_id"]

        resp = client.get(f"/api/v1/notifications/{nid}?resident_id={rid2}")
        assert resp.status_code == 403


# ── PATCH /api/v1/notifications/{resident_id}/mark-read ──────────────────────

class TestMarkRead:

    def test_mark_all_as_read(self, client, db_session):
        rid = seed_resident(db_session)
        generate(client, rid, title="N1")
        generate(client, rid, title="N2")
        generate(client, rid, title="N3")

        # Verify all unread before
        before = client.get(f"/api/v1/notifications?resident_id={rid}").json()
        assert before["unread_count"] == 3

        # Mark all read
        resp = client.patch(f"/api/v1/notifications/{rid}/mark-read", json={})
        assert resp.status_code == 200
        result = resp.json()
        assert result["updated_count"] == 3
        assert "3" in result["detail"]

        # Verify all read after
        after = client.get(f"/api/v1/notifications?resident_id={rid}").json()
        assert after["unread_count"] == 0

    def test_mark_single_as_read(self, client, db_session):
        rid = seed_resident(db_session)
        n1 = generate(client, rid, title="N1")
        n2 = generate(client, rid, title="N2")

        resp = client.patch(
            f"/api/v1/notifications/{rid}/mark-read",
            json={"notification_ids": [n1["notification_id"]]},
        )
        assert resp.status_code == 200
        assert resp.json()["updated_count"] == 1

        after = client.get(f"/api/v1/notifications?resident_id={rid}").json()
        assert after["unread_count"] == 1  # n2 still unread

    def test_mark_multiple_specific(self, client, db_session):
        rid = seed_resident(db_session)
        n1 = generate(client, rid)
        n2 = generate(client, rid)
        n3 = generate(client, rid)

        resp = client.patch(
            f"/api/v1/notifications/{rid}/mark-read",
            json={"notification_ids": [n1["notification_id"], n2["notification_id"]]},
        )
        assert resp.status_code == 200
        assert resp.json()["updated_count"] == 2

        after = client.get(f"/api/v1/notifications?resident_id={rid}").json()
        assert after["unread_count"] == 1  # n3 still unread

    def test_mark_already_read_is_idempotent(self, client, db_session):
        """Marking an already-read notification again returns updated_count=0 (no error)."""
        rid = seed_resident(db_session)
        n = generate(client, rid)
        nid = n["notification_id"]

        # Mark once
        client.patch(f"/api/v1/notifications/{rid}/mark-read",
                     json={"notification_ids": [nid]})
        # Mark again — should not error
        resp = client.patch(f"/api/v1/notifications/{rid}/mark-read",
                            json={"notification_ids": [nid]})
        assert resp.status_code == 200
        assert resp.json()["updated_count"] == 0

    def test_mark_read_resident_not_found(self, client, db_session):
        resp = client.patch(
            "/api/v1/notifications/no-such-resident/mark-read",
            json={},
        )
        assert resp.status_code == 404

    def test_mark_read_wrong_resident_forbidden(self, client, db_session):
        """Trying to mark another resident's notification must return 403."""
        rid1 = seed_resident(db_session, name="Alice")
        rid2 = seed_resident(db_session, name="Bob")
        n = generate(client, rid1)

        resp = client.patch(
            f"/api/v1/notifications/{rid2}/mark-read",
            json={"notification_ids": [n["notification_id"]]},
        )
        assert resp.status_code == 403


# ── POST /api/v1/notifications/ (legacy) ─────────────────────────────────────

class TestLegacyNotificationCreate:

    def test_legacy_create_success(self, client, db_session):
        rid = seed_resident(db_session)
        payload = {
            "resident_id": rid,
            "title": "Legacy Notification",
            "message": "Testing the legacy endpoint.",
            "notification_type": "general",
        }
        resp = client.post("/api/v1/notifications/", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Legacy Notification"
        assert data["is_read"] is False

    def test_legacy_create_resident_not_found(self, client, db_session):
        payload = {
            "resident_id": "invalid-resident-id",
            "title": "Test",
            "message": "Test message.",
        }
        resp = client.post("/api/v1/notifications/", json=payload)
        assert resp.status_code == 404
        assert "Resident" in resp.json()["detail"]


# ── DELETE /notifications/{resident_id} — the centre's clear-all action ───────

def test_clear_all_removes_every_notification(client, db_session):
    resident_id = seed_resident(db_session)
    client.post("/api/v1/notifications/generate", json=gen_payload(resident_id, title="One"))
    client.post("/api/v1/notifications/generate", json=gen_payload(resident_id, title="Two"))

    resp = client.delete(f"/api/v1/notifications/{resident_id}")

    assert resp.status_code == 200
    assert resp.json()["deleted"] == 2
    assert client.get("/api/v1/notifications", params={"resident_id": resident_id}).json()["total"] == 0


def test_clear_all_leaves_other_residents_alone(client, db_session):
    mine = seed_resident(db_session, name="Mine")
    theirs = seed_resident(db_session, name="Theirs")
    client.post("/api/v1/notifications/generate", json=gen_payload(mine, title="Mine"))
    client.post("/api/v1/notifications/generate", json=gen_payload(theirs, title="Theirs"))

    client.delete(f"/api/v1/notifications/{mine}")

    assert client.get("/api/v1/notifications", params={"resident_id": theirs}).json()["total"] == 1


def test_clear_all_on_an_empty_list_is_not_an_error(client, db_session):
    resident_id = seed_resident(db_session)

    resp = client.delete(f"/api/v1/notifications/{resident_id}")

    assert resp.status_code == 200
    assert resp.json()["deleted"] == 0


def test_clear_all_for_an_unknown_resident_is_404(client):
    resp = client.delete("/api/v1/notifications/no-such-resident")

    assert resp.status_code == 404
