"""
pytest tests for BE-12 — Payment Reminder API.

Covers:
  POST /api/v1/reminders:
    - Success (all reminder types, all channels)
    - Bill not found
    - Resident not found
    - Resident mismatch (bill belongs to different resident)
    - Bill already paid (not remindable)
    - Duplicate active reminder (409)
    - Invalid reminder_type / channel (422)
    - Missing required fields (422)

  GET /api/v1/reminders:
    - List all
    - Filter by resident_id
    - Filter by bill_id
    - Filter by status
    - Pagination

  GET /api/v1/reminders/stats:
    - Empty database
    - After creating reminders

  GET /api/v1/reminders/{reminder_id}:
    - Success
    - Not found

  PUT /api/v1/reminders/{reminder_id}/dismiss:
    - Success (dismissed_at is set, status changes)
    - Already dismissed (400)
    - Not found (404)
    - After dismiss, same type can be re-sent

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import date, timedelta


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_flat(db_session):
    from app.models.resident import Flat
    flat = Flat(block="A", floor="1", flat_number="101",
                ownership_type="owned", occupancy_status="occupied")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    return flat.flat_id


def seed_resident(db_session):
    from app.models.resident import Resident
    flat_id = seed_flat(db_session)
    resident = Resident(flat_id=flat_id, name="Priya Sharma",
                        phone="9000000001", status="active")
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def seed_bill(db_session, resident_id: str, bill_status: str = "pending"):
    from app.models.payment import Bill
    due = date.today() + timedelta(days=10)
    bill = Bill(
        resident_id=resident_id,
        billing_month="2024-05",
        maintenance=3000,
        water=500,
        parking=0,
        miscellaneous=0,
        discount=0,
        gst=630,
        total_amount=4130,
        due_date=due,
        status=bill_status,
    )
    db_session.add(bill)
    db_session.commit()
    db_session.refresh(bill)
    return bill.bill_id


def reminder_payload(bill_id: str, resident_id: str, **overrides) -> dict:
    payload = {
        "bill_id":       bill_id,
        "resident_id":   resident_id,
        "reminder_type": "first_notice",
        "channel":       "in_app",
    }
    payload.update(overrides)
    return payload


# ── POST /api/v1/reminders ────────────────────────────────────────────────────

class TestSendReminder:

    def test_send_reminder_success(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id)

        response = client.post("/api/v1/reminders",
                               json=reminder_payload(bill_id, resident_id))

        assert response.status_code == 201
        data = response.json()
        assert data["bill_id"] == bill_id
        assert data["resident_id"] == resident_id
        assert data["reminder_type"] == "first_notice"
        assert data["channel"] == "in_app"
        assert data["status"] == "sent"
        assert "reminder_id" in data
        assert data["dismissed_at"] is None

    def test_send_reminder_all_types(self, client, db_session):
        resident_id = seed_resident(db_session)
        for reminder_type in ("first_notice", "second_notice", "final_notice", "custom"):
            bill_id = seed_bill(db_session, resident_id)
            response = client.post(
                "/api/v1/reminders",
                json=reminder_payload(bill_id, resident_id, reminder_type=reminder_type),
            )
            assert response.status_code == 201, f"Failed for type: {reminder_type}"
            assert response.json()["reminder_type"] == reminder_type

    def test_send_reminder_all_channels(self, client, db_session):
        resident_id = seed_resident(db_session)
        for channel in ("email", "sms", "push", "in_app"):
            bill_id = seed_bill(db_session, resident_id)
            response = client.post(
                "/api/v1/reminders",
                json=reminder_payload(bill_id, resident_id, channel=channel),
            )
            assert response.status_code == 201, f"Failed for channel: {channel}"
            assert response.json()["channel"] == channel

    def test_send_reminder_overdue_bill(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id, bill_status="overdue")
        response = client.post("/api/v1/reminders",
                               json=reminder_payload(bill_id, resident_id))
        assert response.status_code == 201

    def test_send_reminder_partially_paid_bill(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id, bill_status="partially_paid")
        response = client.post("/api/v1/reminders",
                               json=reminder_payload(bill_id, resident_id))
        assert response.status_code == 201

    def test_send_reminder_bill_not_found(self, client, db_session):
        resident_id = seed_resident(db_session)
        response = client.post(
            "/api/v1/reminders",
            json=reminder_payload("non-existent-bill", resident_id),
        )
        assert response.status_code == 404
        assert "Bill" in response.json()["detail"]

    def test_send_reminder_resident_not_found(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id)
        response = client.post(
            "/api/v1/reminders",
            json=reminder_payload(bill_id, "non-existent-resident"),
        )
        assert response.status_code == 404
        assert "Resident" in response.json()["detail"]

    def test_send_reminder_resident_mismatch(self, client, db_session):
        r1 = seed_resident(db_session)
        r2 = seed_resident(db_session)
        bill_id = seed_bill(db_session, r1)  # bill belongs to r1

        response = client.post(
            "/api/v1/reminders",
            json=reminder_payload(bill_id, r2),  # but we pass r2
        )
        assert response.status_code == 400
        assert "does not belong" in response.json()["detail"].lower()

    def test_send_reminder_paid_bill_rejected(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id, bill_status="paid")
        response = client.post("/api/v1/reminders",
                               json=reminder_payload(bill_id, resident_id))
        assert response.status_code == 400
        assert "paid" in response.json()["detail"].lower()

    def test_send_reminder_duplicate_rejected(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id)
        payload = reminder_payload(bill_id, resident_id, reminder_type="first_notice")

        first = client.post("/api/v1/reminders", json=payload)
        assert first.status_code == 201

        second = client.post("/api/v1/reminders", json=payload)
        assert second.status_code == 409
        assert "already exists" in second.json()["detail"].lower()

    def test_different_types_on_same_bill_allowed(self, client, db_session):
        """first_notice and second_notice are different types — both should succeed."""
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id)

        r1 = client.post("/api/v1/reminders",
                         json=reminder_payload(bill_id, resident_id,
                                               reminder_type="first_notice"))
        r2 = client.post("/api/v1/reminders",
                         json=reminder_payload(bill_id, resident_id,
                                               reminder_type="second_notice"))
        assert r1.status_code == 201
        assert r2.status_code == 201

    def test_send_reminder_invalid_type(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id)
        response = client.post(
            "/api/v1/reminders",
            json=reminder_payload(bill_id, resident_id, reminder_type="urgent_notice"),
        )
        assert response.status_code == 422

    def test_send_reminder_invalid_channel(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id)
        response = client.post(
            "/api/v1/reminders",
            json=reminder_payload(bill_id, resident_id, channel="telegram"),
        )
        assert response.status_code == 422

    def test_send_reminder_missing_bill_id(self, client, db_session):
        resident_id = seed_resident(db_session)
        response = client.post(
            "/api/v1/reminders",
            json={"resident_id": resident_id, "reminder_type": "first_notice"},
        )
        assert response.status_code == 422

    def test_send_reminder_missing_resident_id(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id)
        response = client.post(
            "/api/v1/reminders",
            json={"bill_id": bill_id, "reminder_type": "first_notice"},
        )
        assert response.status_code == 422


# ── GET /api/v1/reminders ─────────────────────────────────────────────────────

class TestListReminders:

    def test_list_all_reminders(self, client, db_session):
        resident_id = seed_resident(db_session)
        b1 = seed_bill(db_session, resident_id)
        b2 = seed_bill(db_session, resident_id)
        client.post("/api/v1/reminders",
                    json=reminder_payload(b1, resident_id, reminder_type="first_notice"))
        client.post("/api/v1/reminders",
                    json=reminder_payload(b2, resident_id, reminder_type="first_notice"))

        response = client.get("/api/v1/reminders")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    def test_list_by_resident(self, client, db_session):
        r1 = seed_resident(db_session)
        r2 = seed_resident(db_session)
        b1 = seed_bill(db_session, r1)
        b2 = seed_bill(db_session, r2)
        client.post("/api/v1/reminders",
                    json=reminder_payload(b1, r1))
        client.post("/api/v1/reminders",
                    json=reminder_payload(b2, r2))

        response = client.get(f"/api/v1/reminders?resident_id={r1}")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["resident_id"] == r1

    def test_list_by_bill(self, client, db_session):
        resident_id = seed_resident(db_session)
        b1 = seed_bill(db_session, resident_id)
        b2 = seed_bill(db_session, resident_id)
        client.post("/api/v1/reminders",
                    json=reminder_payload(b1, resident_id, reminder_type="first_notice"))
        client.post("/api/v1/reminders",
                    json=reminder_payload(b2, resident_id, reminder_type="first_notice"))

        response = client.get(f"/api/v1/reminders?bill_id={b1}")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["items"][0]["bill_id"] == b1

    def test_list_filter_by_status(self, client, db_session):
        resident_id = seed_resident(db_session)
        b1 = seed_bill(db_session, resident_id)
        b2 = seed_bill(db_session, resident_id)
        r1 = client.post("/api/v1/reminders",
                         json=reminder_payload(b1, resident_id,
                                               reminder_type="first_notice")).json()
        client.post("/api/v1/reminders",
                    json=reminder_payload(b2, resident_id, reminder_type="first_notice"))
        # Dismiss the first one
        client.put(f"/api/v1/reminders/{r1['reminder_id']}/dismiss")

        sent_resp = client.get("/api/v1/reminders?status=sent")
        dismissed_resp = client.get("/api/v1/reminders?status=dismissed")
        assert sent_resp.json()["total"] == 1
        assert dismissed_resp.json()["total"] == 1

    def test_list_pagination(self, client, db_session):
        resident_id = seed_resident(db_session)
        for reminder_type in ("first_notice", "second_notice", "final_notice", "custom"):
            bill_id = seed_bill(db_session, resident_id)
            client.post("/api/v1/reminders",
                        json=reminder_payload(bill_id, resident_id,
                                              reminder_type=reminder_type))

        page1 = client.get("/api/v1/reminders?skip=0&limit=2").json()
        page2 = client.get("/api/v1/reminders?skip=2&limit=2").json()
        assert len(page1["items"]) == 2
        assert len(page2["items"]) == 2

    def test_list_empty_database(self, client, db_session):
        response = client.get("/api/v1/reminders")
        assert response.status_code == 200
        assert response.json()["total"] == 0
        assert response.json()["items"] == []


# ── GET /api/v1/reminders/stats ───────────────────────────────────────────────

class TestReminderStats:

    def test_stats_empty_database(self, client, db_session):
        response = client.get("/api/v1/reminders/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["sent"] == 0
        assert data["dismissed"] == 0
        assert data["failed"] == 0
        assert data["by_type"] == {}
        assert data["by_channel"] == {}

    def test_stats_after_creating_reminders(self, client, db_session):
        resident_id = seed_resident(db_session)
        b1 = seed_bill(db_session, resident_id)
        b2 = seed_bill(db_session, resident_id)
        b3 = seed_bill(db_session, resident_id)

        client.post("/api/v1/reminders",
                    json=reminder_payload(b1, resident_id,
                                          reminder_type="first_notice", channel="email"))
        client.post("/api/v1/reminders",
                    json=reminder_payload(b2, resident_id,
                                          reminder_type="second_notice", channel="sms"))
        r3 = client.post("/api/v1/reminders",
                         json=reminder_payload(b3, resident_id,
                                               reminder_type="final_notice",
                                               channel="in_app")).json()
        client.put(f"/api/v1/reminders/{r3['reminder_id']}/dismiss")

        response = client.get("/api/v1/reminders/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert data["sent"] == 2
        assert data["dismissed"] == 1
        assert data["by_type"]["first_notice"] == 1
        assert data["by_type"]["second_notice"] == 1
        assert data["by_type"]["final_notice"] == 1
        assert data["by_channel"]["email"] == 1
        assert data["by_channel"]["sms"] == 1
        assert data["by_channel"]["in_app"] == 1


# ── GET /api/v1/reminders/{reminder_id} ──────────────────────────────────────

class TestGetReminder:

    def test_get_reminder_success(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id)
        created = client.post("/api/v1/reminders",
                              json=reminder_payload(bill_id, resident_id)).json()

        response = client.get(f"/api/v1/reminders/{created['reminder_id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["reminder_id"] == created["reminder_id"]
        assert data["bill_id"] == bill_id
        assert data["status"] == "sent"

    def test_get_reminder_not_found(self, client, db_session):
        response = client.get("/api/v1/reminders/does-not-exist")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_reminder_invalid_id_format(self, client, db_session):
        # Any string is a valid path param — service returns 404, not 422
        response = client.get("/api/v1/reminders/!!!invalid!!!")
        assert response.status_code == 404


# ── PUT /api/v1/reminders/{reminder_id}/dismiss ───────────────────────────────

class TestDismissReminder:

    def test_dismiss_success(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id)
        created = client.post("/api/v1/reminders",
                              json=reminder_payload(bill_id, resident_id)).json()

        response = client.put(f"/api/v1/reminders/{created['reminder_id']}/dismiss")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "dismissed"
        assert data["dismissed_at"] is not None

    def test_dismiss_already_dismissed(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id)
        created = client.post("/api/v1/reminders",
                              json=reminder_payload(bill_id, resident_id)).json()

        client.put(f"/api/v1/reminders/{created['reminder_id']}/dismiss")
        response = client.put(f"/api/v1/reminders/{created['reminder_id']}/dismiss")
        assert response.status_code == 400
        assert "already been dismissed" in response.json()["detail"].lower()

    def test_dismiss_not_found(self, client, db_session):
        response = client.put("/api/v1/reminders/does-not-exist/dismiss")
        assert response.status_code == 404

    def test_after_dismiss_same_type_can_be_resent(self, client, db_session):
        """Once dismissed, a new reminder of the same type should be allowed."""
        resident_id = seed_resident(db_session)
        bill_id = seed_bill(db_session, resident_id)
        payload = reminder_payload(bill_id, resident_id, reminder_type="first_notice")

        first = client.post("/api/v1/reminders", json=payload).json()
        client.put(f"/api/v1/reminders/{first['reminder_id']}/dismiss")

        second = client.post("/api/v1/reminders", json=payload)
        assert second.status_code == 201
        assert second.json()["reminder_id"] != first["reminder_id"]
