"""
pytest tests for BE-19 — Emergency Alert Broadcast API.

Story: as the Association President, I want a broadcast endpoint so that
alerts reach all residents.

Covers:
  - POST /alerts/emergency reaches every active resident and returns 201
  - A delivery row is written for each recipient — the per-recipient status
    the acceptance criteria require
  - Successful deliveries carry a timestamp; failed ones carry a reason and
    no timestamp
  - A recipient with no phone on record fails without aborting the broadcast
    for everyone else, and the counts reflect the split
  - Inactive and moved-out residents are excluded
  - target_block scopes the broadcast; an unknown block is rejected rather
    than silently broadcasting to nobody
  - Broadcasting with no recipients is rejected instead of writing an empty
    alert
  - Validation: missing title, short message, whitespace-only fields
  - Severity is fixed to "emergency" by the endpoint, not the caller
  - The delivery log is readable afterwards, including ?status=failed
  - A rejected broadcast writes nothing at all (no partial alert)

Fixtures (client, db_session) are defined in conftest.py.
"""

from app.models.alert import Alert, AlertDelivery
from app.models.resident import Flat, Resident

BROADCAST_URL = "/api/v1/alerts/emergency"

VALID_PAYLOAD = {
    "title": "Fire Drill — Evacuate Now",
    "message": "Please evacuate via the nearest stairwell and assemble in the car park.",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_flat(db_session, **overrides) -> str:
    defaults = {
        "block": "A",
        "floor": "1",
        "flat_number": "A-101",
        "ownership_type": "owned",
        "occupancy_status": "occupied",
    }
    defaults.update(overrides)
    flat = Flat(**defaults)
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    return flat.flat_id


def seed_resident(db_session, flat_id=None, **overrides) -> str:
    if flat_id is None:
        flat_id = seed_flat(db_session)
    defaults = {
        "flat_id": flat_id,
        "name": "Arjun Mehta",
        "phone": "9876500001",
        "status": "active",
    }
    defaults.update(overrides)
    resident = Resident(**defaults)
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def broadcast(client, **overrides):
    payload = {**VALID_PAYLOAD, **overrides}
    return client.post(BROADCAST_URL, json=payload)


# ── Happy path ────────────────────────────────────────────────────────────────

def test_broadcast_reaches_every_active_resident(client, db_session):
    for i, name in enumerate(["Arjun Mehta", "Priya Sharma", "Ravi Kumar"]):
        seed_resident(db_session, name=name, phone=f"98765000{i:02d}")

    response = broadcast(client)

    assert response.status_code == 201
    body = response.json()
    assert body["recipient_count"] == 3
    assert body["sent_count"] == 3
    assert body["failed_count"] == 0
    assert len(body["deliveries"]) == 3


def test_broadcast_echoes_the_alert_content(client, db_session):
    seed_resident(db_session)

    body = broadcast(client).json()

    assert body["title"] == VALID_PAYLOAD["title"]
    assert body["message"] == VALID_PAYLOAD["message"]
    assert body["alert_id"]
    assert body["created_at"]


def test_broadcast_records_who_raised_it(client, db_session):
    seed_resident(db_session)

    body = broadcast(client, raised_by="president-001").json()

    assert body["raised_by"] == "president-001"


def test_broadcast_severity_is_always_emergency(client, db_session):
    """Severity is a property of the endpoint — a caller cannot downgrade a
    society-wide alarm by putting a different value in the body."""
    seed_resident(db_session)

    body = broadcast(client, severity="info").json()

    assert body["severity"] == "emergency"


# ── Per-recipient delivery log ────────────────────────────────────────────────

def test_delivery_row_written_for_each_recipient(client, db_session):
    ids = {
        seed_resident(db_session, name="Arjun Mehta", phone="9876500001"),
        seed_resident(db_session, name="Priya Sharma", phone="9876500002"),
    }

    body = broadcast(client).json()

    logged = {d["resident_id"] for d in body["deliveries"]}
    assert logged == ids
    assert db_session.query(AlertDelivery).count() == 2


def test_successful_delivery_records_status_and_timestamp(client, db_session):
    seed_resident(db_session, name="Arjun Mehta", phone="9876500001")

    delivery = broadcast(client).json()["deliveries"][0]

    assert delivery["status"] == "sent"
    assert delivery["delivered_at"] is not None
    assert delivery["failure_reason"] is None
    assert delivery["channel"] == "sms"


def test_delivery_snapshots_recipient_details(client, db_session):
    """Name/phone/flat are copied onto the log so it stays readable even after
    the resident record changes or is removed."""
    flat_id = seed_flat(db_session, block="B", flat_number="B-204")
    seed_resident(db_session, flat_id=flat_id, name="Priya Sharma", phone="9876500002")

    delivery = broadcast(client).json()["deliveries"][0]

    assert delivery["recipient_name"] == "Priya Sharma"
    assert delivery["recipient_phone"] == "9876500002"
    assert delivery["flat_number"] == "B-204"


# ── Partial failure ───────────────────────────────────────────────────────────

def test_recipient_without_a_phone_is_recorded_as_failed(client, db_session):
    seed_resident(db_session, name="No Phone", phone=None)

    body = broadcast(client).json()

    delivery = body["deliveries"][0]
    assert delivery["status"] == "failed"
    assert delivery["failure_reason"]
    assert delivery["delivered_at"] is None


def test_one_unreachable_recipient_does_not_abort_the_broadcast(client, db_session):
    """The other residents must still get the alert — that is the whole point
    of recording failures as data instead of raising."""
    seed_resident(db_session, name="Arjun Mehta", phone="9876500001")
    seed_resident(db_session, name="Blank Phone", phone="   ")
    seed_resident(db_session, name="No Phone", phone=None)
    seed_resident(db_session, name="Priya Sharma", phone="9876500002")

    response = broadcast(client)

    assert response.status_code == 201
    body = response.json()
    assert body["recipient_count"] == 4
    assert body["sent_count"] == 2
    assert body["failed_count"] == 2


def test_counts_match_the_delivery_rows(client, db_session):
    seed_resident(db_session, name="A", phone="9876500001")
    seed_resident(db_session, name="B", phone=None)
    seed_resident(db_session, name="C", phone="9876500003")

    body = broadcast(client).json()

    statuses = [d["status"] for d in body["deliveries"]]
    assert statuses.count("sent") == body["sent_count"]
    assert statuses.count("failed") == body["failed_count"]
    assert len(statuses) == body["recipient_count"]


# ── Recipient selection ───────────────────────────────────────────────────────

def test_inactive_and_moved_out_residents_are_excluded(client, db_session):
    seed_resident(db_session, name="Active Resident", status="active")
    seed_resident(db_session, name="Inactive Resident", status="inactive")
    seed_resident(db_session, name="Gone Resident", status="moved_out")

    body = broadcast(client).json()

    assert body["recipient_count"] == 1
    assert body["deliveries"][0]["recipient_name"] == "Active Resident"


def test_target_block_scopes_the_broadcast(client, db_session):
    flat_a = seed_flat(db_session, block="A", flat_number="A-101")
    flat_b = seed_flat(db_session, block="B", flat_number="B-204")
    seed_resident(db_session, flat_id=flat_a, name="Tower A Resident")
    seed_resident(db_session, flat_id=flat_b, name="Tower B Resident")

    body = broadcast(client, target_block="B").json()

    assert body["target_block"] == "B"
    assert body["recipient_count"] == 1
    assert body["deliveries"][0]["recipient_name"] == "Tower B Resident"


def test_target_block_is_case_insensitive(client, db_session):
    flat_a = seed_flat(db_session, block="A")
    seed_resident(db_session, flat_id=flat_a)

    body = broadcast(client, target_block="a").json()

    assert body["target_block"] == "A"
    assert body["recipient_count"] == 1


def test_omitting_target_block_reaches_every_block(client, db_session):
    flat_a = seed_flat(db_session, block="A", flat_number="A-101")
    flat_b = seed_flat(db_session, block="B", flat_number="B-204")
    seed_resident(db_session, flat_id=flat_a, name="Tower A Resident")
    seed_resident(db_session, flat_id=flat_b, name="Tower B Resident")

    body = broadcast(client).json()

    assert body["target_block"] is None
    assert body["recipient_count"] == 2


# ── Rejections ────────────────────────────────────────────────────────────────

def test_unknown_target_block_is_rejected(client, db_session):
    """A typo'd block must not quietly broadcast to nobody during an emergency."""
    seed_resident(db_session)

    response = broadcast(client, target_block="Z")

    assert response.status_code == 400
    assert "Z" in response.json()["detail"]


def test_broadcast_with_no_active_residents_is_rejected(client, db_session):
    seed_resident(db_session, status="moved_out")

    response = broadcast(client)

    assert response.status_code == 400
    assert "No active residents" in response.json()["detail"]


def test_rejected_broadcast_writes_nothing(client, db_session):
    """No half-written alert should survive a rejection."""
    seed_resident(db_session)

    broadcast(client, target_block="Z")

    assert db_session.query(Alert).count() == 0
    assert db_session.query(AlertDelivery).count() == 0


# ── Validation ────────────────────────────────────────────────────────────────

def test_missing_title_is_rejected(client, db_session):
    seed_resident(db_session)

    response = client.post(BROADCAST_URL, json={"message": VALID_PAYLOAD["message"]})

    assert response.status_code == 422


def test_short_message_is_rejected(client, db_session):
    seed_resident(db_session)

    response = broadcast(client, message="Fire!")

    assert response.status_code == 422


def test_whitespace_only_fields_are_rejected(client, db_session):
    """min_length alone would let a padded string through."""
    seed_resident(db_session)

    assert broadcast(client, title="   ").status_code == 422
    assert broadcast(client, message="            ").status_code == 422


def test_title_and_message_are_stripped(client, db_session):
    seed_resident(db_session)

    body = broadcast(
        client, title="  Gas Leak  ", message="  Evacuate immediately please.  "
    ).json()

    assert body["title"] == "Gas Leak"
    assert body["message"] == "Evacuate immediately please."


# ── Reading the log back ──────────────────────────────────────────────────────

def test_delivery_log_is_readable_after_the_broadcast(client, db_session):
    seed_resident(db_session, name="Arjun Mehta", phone="9876500001")
    seed_resident(db_session, name="No Phone", phone=None)
    alert_id = broadcast(client).json()["alert_id"]

    response = client.get(f"/api/v1/alerts/{alert_id}/deliveries")

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_delivery_log_can_be_filtered_to_failures(client, db_session):
    """The operational query: who do we still need to reach in person?"""
    seed_resident(db_session, name="Reached", phone="9876500001")
    seed_resident(db_session, name="Missed", phone=None)
    alert_id = broadcast(client).json()["alert_id"]

    body = client.get(f"/api/v1/alerts/{alert_id}/deliveries?status=failed").json()

    assert len(body) == 1
    assert body[0]["recipient_name"] == "Missed"


def test_get_alert_returns_the_full_log(client, db_session):
    seed_resident(db_session)
    alert_id = broadcast(client).json()["alert_id"]

    body = client.get(f"/api/v1/alerts/{alert_id}").json()

    assert body["alert_id"] == alert_id
    assert len(body["deliveries"]) == 1


def test_alert_list_returns_newest_first_without_deliveries(client, db_session):
    seed_resident(db_session)
    broadcast(client, title="First Alert")
    broadcast(client, title="Second Alert")

    body = client.get("/api/v1/alerts").json()

    assert [a["title"] for a in body] == ["Second Alert", "First Alert"]
    assert "deliveries" not in body[0]
    assert body[0]["recipient_count"] == 1


def test_alert_ordering_holds_for_alerts_raised_in_the_same_second(client, db_session):
    """
    SQLite's CURRENT_TIMESTAMP only has second resolution, so a func.now()
    default would give same-second alerts identical timestamps and make
    "newest first" arbitrary. created_at is generated in Python with
    microsecond precision precisely so this holds — during an emergency,
    several alerts really can land within one second.
    """
    seed_resident(db_session)
    titles = [f"Alert {i}" for i in range(6)]
    for title in titles:
        broadcast(client, title=title)

    body = client.get("/api/v1/alerts").json()

    assert [a["title"] for a in body] == list(reversed(titles))
    timestamps = [a["created_at"] for a in body]
    assert len(set(timestamps)) == len(timestamps)   # no ties


def test_alert_list_respects_the_limit(client, db_session):
    seed_resident(db_session)
    for i in range(4):
        broadcast(client, title=f"Alert {i}")

    assert len(client.get("/api/v1/alerts?limit=2").json()) == 2
    assert client.get("/api/v1/alerts?limit=0").status_code == 422


def test_unknown_alert_returns_404(client, db_session):
    assert client.get("/api/v1/alerts/does-not-exist").status_code == 404
    assert client.get("/api/v1/alerts/does-not-exist/deliveries").status_code == 404


# ── INT-19: the alert has to reach recipients in the portal, not just by SMS ──

def _notifications(client, resident_id):
    resp = client.get("/api/v1/notifications", params={"resident_id": resident_id})
    assert resp.status_code == 200
    return resp.json()


def test_a_broadcast_reaches_every_resident_in_the_portal(client, db_session):
    flat_id = seed_flat(db_session)
    first = seed_resident(db_session, flat_id=flat_id, name="First", phone="9876500011")
    second = seed_resident(db_session, flat_id=flat_id, name="Second", phone="9876500012")

    assert broadcast(client).status_code == 201

    for resident_id in (first, second):
        data = _notifications(client, resident_id)
        assert data["unread_count"] == 1
        notif = data["notifications"][0]
        assert notif["notification_type"] == "emergency_alert"
        assert notif["priority"] == "high"


def test_the_in_app_alert_carries_the_broadcast_wording(client, db_session):
    resident_id = seed_resident(db_session, name="Reader", phone="9876500013")

    resp = broadcast(client, title="Fire in Tower B", message="Evacuate immediately.")
    alert_id = resp.json()["alert_id"]

    notif = _notifications(client, resident_id)["notifications"][0]
    assert notif["title"] == "Fire in Tower B"
    detail = client.get(
        f"/api/v1/notifications/{notif['notification_id']}",
        params={"resident_id": resident_id},
    ).json()
    assert detail["message"] == "Evacuate immediately."
    assert detail["source_event_id"] == alert_id
