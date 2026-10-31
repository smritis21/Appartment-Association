"""
pytest tests for BE-05 — Visitor Decision API.

Covers:
  - Approve / reject success (status + decision + timestamp recorded)
  - Decision persists in the database (queried directly, not via the API)
  - decided_by and notes are stored
  - left_at_gate on a delivery returns collection details
  - Duplicate decision returns 409 and does not overwrite the original
  - Expired request returns 400
  - left_at_gate on a non-delivery returns 400
  - Unknown visitor returns 404
  - Invalid / missing decision value returns 422
  - Rejected calls leave no partial write behind

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import datetime, timedelta, timezone

from app.models.visitor import Visitor

BASE = "/api/v1/visitors"


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_visitor(db_session, **overrides) -> str:
    defaults = {
        "visitor_name": "Rahul Khanna",
        "purpose": "Guest Visit",
        "phone": "9811122233",
        "flat_number": "A-101",
        "gate": "Main Gate",
        "status": "pending",
    }
    defaults.update(overrides)
    visitor = Visitor(**defaults)
    db_session.add(visitor)
    db_session.commit()
    db_session.refresh(visitor)
    return visitor.visitor_id


def fetch(db_session, visitor_id: str) -> Visitor:
    return db_session.query(Visitor).filter(Visitor.visitor_id == visitor_id).first()


# ── Decision — success ────────────────────────────────────────────────────────

def test_approve_visitor_success(client, db_session):
    visitor_id = seed_visitor(db_session)

    response = client.post(
        f"{BASE}/{visitor_id}/decision",
        json={"decision": "approved", "decided_by": "res-1"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "approved"
    assert body["status"] == "approved"
    assert body["decided_by"] == "res-1"
    assert body["decided_at"] is not None


def test_reject_visitor_success(client, db_session):
    visitor_id = seed_visitor(db_session, visitor_name="Unknown — No ID")

    response = client.post(
        f"{BASE}/{visitor_id}/decision",
        json={"decision": "rejected", "decided_by": "res-1", "notes": "Not expecting anyone"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "rejected"
    assert body["status"] == "rejected"
    assert body["decision_notes"] == "Not expecting anyone"


def test_decision_records_timestamp(client, db_session):
    """AC: the decision is recorded with a timestamp."""
    visitor_id = seed_visitor(db_session)

    response = client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "approved"})

    assert response.status_code == 200
    decided_at = response.json()["decided_at"]
    assert decided_at is not None
    # Parses as a real ISO-8601 timestamp, not an empty string or placeholder.
    parsed = datetime.fromisoformat(decided_at.replace("Z", "+00:00"))
    assert isinstance(parsed, datetime)


def test_decision_persists_in_db(client, db_session):
    """AC: covered by a pytest test verifying the decision actually took effect."""
    visitor_id = seed_visitor(db_session)

    client.post(
        f"{BASE}/{visitor_id}/decision",
        json={"decision": "approved", "decided_by": "res-9", "notes": "Expected guest"},
    )

    visitor = fetch(db_session, visitor_id)
    assert visitor.status == "approved"
    assert visitor.decision == "approved"
    assert visitor.decided_by == "res-9"
    assert visitor.decision_notes == "Expected guest"
    assert visitor.decided_at is not None


def test_reject_decision_persists_reviewer_and_notes(client, db_session):
    visitor_id = seed_visitor(db_session)

    client.post(
        f"{BASE}/{visitor_id}/decision",
        json={"decision": "rejected", "decided_by": "res-2", "notes": "Not expected"},
    )

    visitor = fetch(db_session, visitor_id)
    assert visitor.status == "rejected"
    assert visitor.decision == "rejected"
    assert visitor.decided_by == "res-2"
    assert visitor.decision_notes == "Not expected"


def test_left_at_gate_returns_collection_details(client, db_session):
    visitor_id = seed_visitor(
        db_session, visitor_name="Amazon — Prakash R.", purpose="Delivery", gate="Main Gate"
    )

    response = client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "left_at_gate"})

    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "left_at_gate"
    assert body["collected_by"] == "Suresh Patil"
    assert body["pickup_location"] == "Security Desk · Main Gate"


def test_left_at_gate_unknown_gate_falls_back_to_default_desk(client, db_session):
    visitor_id = seed_visitor(db_session, purpose="Delivery", gate="North Gate")

    response = client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "left_at_gate"})

    assert response.status_code == 200
    body = response.json()
    assert body["collected_by"] == "Gate Security"
    assert body["pickup_location"] == "North Gate"


def test_decision_without_decided_by_is_allowed(client, db_session):
    """decided_by is optional until auth lands — the decision still records."""
    visitor_id = seed_visitor(db_session)

    response = client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "approved"})

    assert response.status_code == 200
    assert response.json()["decided_by"] is None


# ── Decision — duplicates ─────────────────────────────────────────────────────

def test_duplicate_decision_returns_409(client, db_session):
    """AC: duplicate decisions return an appropriate error."""
    visitor_id = seed_visitor(db_session)

    first = client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "approved"})
    assert first.status_code == 200

    second = client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "rejected"})
    assert second.status_code == 409
    assert "already been decided" in second.json()["detail"].lower()


def test_duplicate_decision_does_not_overwrite_original(client, db_session):
    visitor_id = seed_visitor(db_session)

    client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "approved"})
    original_decided_at = fetch(db_session, visitor_id).decided_at

    client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "rejected"})

    visitor = fetch(db_session, visitor_id)
    assert visitor.decision == "approved"
    assert visitor.status == "approved"
    assert visitor.decided_at == original_decided_at


def test_repeating_the_same_decision_also_returns_409(client, db_session):
    """Re-sending the same decision is still a duplicate, not a no-op success."""
    visitor_id = seed_visitor(db_session)

    client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "approved"})
    response = client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "approved"})

    assert response.status_code == 409


def test_decision_on_already_seeded_non_pending_request_returns_409(client, db_session):
    """A request seeded straight into a decided state is also closed to decisions."""
    visitor_id = seed_visitor(db_session, status="rejected", decision="rejected")

    response = client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "approved"})

    assert response.status_code == 409


# ── Decision — invalid ────────────────────────────────────────────────────────

def test_decision_on_expired_request_returns_400(client, db_session):
    """AC: invalid decisions return an appropriate error."""
    visitor_id = seed_visitor(
        db_session, valid_until=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=2)
    )

    response = client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "approved"})

    assert response.status_code == 400
    assert "expired" in response.json()["detail"].lower()


def test_decision_within_valid_window_succeeds(client, db_session):
    visitor_id = seed_visitor(
        db_session, valid_until=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=2)
    )

    response = client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "approved"})

    assert response.status_code == 200


def test_left_at_gate_on_non_delivery_returns_400(client, db_session):
    visitor_id = seed_visitor(db_session, purpose="Guest Visit")

    response = client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "left_at_gate"})

    assert response.status_code == 400
    assert "delivery" in response.json()["detail"].lower()


def test_invalid_decision_leaves_no_partial_write(client, db_session):
    """A rejected call must not stamp a timestamp or move the status."""
    visitor_id = seed_visitor(db_session, purpose="Guest Visit")

    client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "left_at_gate"})

    visitor = fetch(db_session, visitor_id)
    assert visitor.status == "pending"
    assert visitor.decision is None
    assert visitor.decided_at is None


# ── Decision — not found ──────────────────────────────────────────────────────

def test_decision_unknown_visitor_returns_404(client, db_session):
    response = client.post(f"{BASE}/does-not-exist/decision", json={"decision": "approved"})

    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ── Decision — validation ─────────────────────────────────────────────────────

def test_missing_decision_returns_422(client, db_session):
    visitor_id = seed_visitor(db_session)

    response = client.post(f"{BASE}/{visitor_id}/decision", json={"decided_by": "res-1"})

    assert response.status_code == 422


def test_unknown_decision_value_returns_422(client, db_session):
    visitor_id = seed_visitor(db_session)

    response = client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "maybe"})

    assert response.status_code == 422


def test_pending_is_not_an_acceptable_decision(client, db_session):
    """'pending' is a system state, not something a resident can decide."""
    visitor_id = seed_visitor(db_session)

    response = client.post(f"{BASE}/{visitor_id}/decision", json={"decision": "pending"})

    assert response.status_code == 422


def test_notes_over_max_length_returns_422(client, db_session):
    visitor_id = seed_visitor(db_session)

    response = client.post(
        f"{BASE}/{visitor_id}/decision",
        json={"decision": "approved", "notes": "x" * 501},
    )

    assert response.status_code == 422


# ── Supporting read endpoints ─────────────────────────────────────────────────

def test_list_visitors_filters_by_resident(client, db_session):
    seed_visitor(db_session, resident_id=None, visitor_name="Unscoped")
    seed_visitor(db_session, resident_id="res-1", visitor_name="Scoped")

    response = client.get(f"{BASE}?resident_id=res-1")

    assert response.status_code == 200
    names = [v["visitor_name"] for v in response.json()]
    assert names == ["Scoped"]


def test_get_unknown_visitor_returns_404(client, db_session):
    response = client.get(f"{BASE}/does-not-exist")

    assert response.status_code == 404
