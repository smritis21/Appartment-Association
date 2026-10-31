"""
pytest tests for BE-05 — Log Visitor Entry API.

Story: as a security guard, I want to log a visitor arriving at the gate, so
that the resident receives an approval request and the society keeps a
record of who entered the premises.

Covers:
  - POST /visitors returns 201 with a generated visitor_id and status "pending"
  - The entry is actually persisted, not just echoed back
  - Every entry starts pending and gets a unique id
  - requested_at is stamped by the server
  - Optional fields (phone, gate, vehicle, resident_id) may be omitted
  - An entry can be raised against a real resident and shows up in that
    resident's approval queue
  - A logged entry can then be approved through the existing decision endpoint
    (BE-05), proving the gate-to-resident path works end to end
  - Missing/blank visitor_name is rejected with 422
  - An unknown resident_id is rejected with 404
  - A rejected entry writes nothing to the visitor row it created
  - GET /visitors still works after this change

Fixtures (client, db_session) are defined in conftest.py.
"""

from uuid import UUID

from app.models.resident import Flat, Resident

VISITORS_URL = "/api/v1/visitors"


# ── Helpers ───────────────────────────────────────────────────────────────────

def entry_payload(**overrides) -> dict:
    defaults = {
        "visitor_name": "Ramesh Kumar",
        "phone": "9876543210",
        "purpose": "Delivery",
        "flat_number": "A-101",
        "gate": "Main Gate",
    }
    defaults.update(overrides)
    return defaults


def seed_resident(db_session, **overrides) -> str:
    flat = Flat(block="A", flat_number="101")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)

    defaults = {"name": "Test Resident", "flat_id": flat.flat_id, "phone": "9999999999"}
    defaults.update(overrides)
    resident = Resident(**defaults)
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


# ── Basic entry logging ─────────────────────────────────────────────────────

def test_log_visitor_entry_returns_201(client):
    """
    Swagger contract: POST /visitors -> 201 Created, status = "pending".

    This assertion failed with `assert 405 == 201` before DEF-001 was fixed.
    """
    response = client.post(VISITORS_URL, json=entry_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["visitor_name"] == "Ramesh Kumar"
    assert body["status"] == "pending"
    assert body["visitor_id"]


def test_entry_is_persisted(client, db_session):
    from app.models.visitor import Visitor

    response = client.post(VISITORS_URL, json=entry_payload())
    visitor_id = response.json()["visitor_id"]

    stored = db_session.get(Visitor, visitor_id)
    assert stored is not None
    assert stored.phone == "9876543210"
    assert stored.gate == "Main Gate"


def test_entry_always_starts_pending(client):
    body = client.post(VISITORS_URL, json=entry_payload()).json()
    assert body["status"] == "pending"
    assert body["decision"] is None
    assert body["decided_at"] is None


def test_each_entry_gets_a_unique_id(client):
    first = client.post(VISITORS_URL, json=entry_payload()).json()
    second = client.post(VISITORS_URL, json=entry_payload()).json()

    UUID(first["visitor_id"])
    UUID(second["visitor_id"])
    assert first["visitor_id"] != second["visitor_id"]


def test_requested_at_is_stamped(client):
    body = client.post(VISITORS_URL, json=entry_payload()).json()
    assert body["requested_at"]
    assert body["created_at"]


def test_optional_fields_may_be_omitted(client):
    response = client.post(VISITORS_URL, json={"visitor_name": "Walk-in Guest"})

    assert response.status_code == 201
    body = response.json()
    assert body["visitor_name"] == "Walk-in Guest"
    assert body["phone"] is None
    assert body["gate"] is None


# ── Resident linkage ─────────────────────────────────────────────────────────

def test_entry_can_be_raised_against_a_resident(client, db_session):
    resident_id = seed_resident(db_session)

    response = client.post(VISITORS_URL, json=entry_payload(resident_id=resident_id))

    assert response.status_code == 201
    assert response.json()["resident_id"] == resident_id


def test_logged_entry_appears_in_the_resident_queue(client, db_session):
    resident_id = seed_resident(db_session)
    client.post(VISITORS_URL, json=entry_payload(resident_id=resident_id))

    response = client.get(f"{VISITORS_URL}?resident_id={resident_id}")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["status"] == "pending"


def test_logged_entry_can_then_be_approved(client, db_session):
    """End-to-end: log at the gate, then the resident approves it."""
    resident_id = seed_resident(db_session)
    entry = client.post(VISITORS_URL, json=entry_payload(resident_id=resident_id)).json()

    response = client.post(
        f"{VISITORS_URL}/{entry['visitor_id']}/decision",
        json={"decision": "approved", "decided_by": resident_id},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "approved"


# ── Validation ────────────────────────────────────────────────────────────────

def test_missing_visitor_name_returns_422(client):
    response = client.post(VISITORS_URL, json={"phone": "9876543210"})
    assert response.status_code == 422


def test_blank_visitor_name_returns_422(client):
    response = client.post(VISITORS_URL, json=entry_payload(visitor_name=""))
    assert response.status_code == 422


def test_unknown_resident_returns_404(client):
    response = client.post(
        VISITORS_URL, json=entry_payload(resident_id="does-not-exist")
    )
    assert response.status_code == 404


def test_rejected_entry_writes_nothing(client, db_session):
    from app.models.visitor import Visitor

    before = db_session.query(Visitor).count()
    client.post(VISITORS_URL, json={"phone": "9876543210"})  # missing visitor_name
    after = db_session.query(Visitor).count()

    assert after == before


# ── Regression: existing endpoint still works ──────────────────────────────────

def test_visitor_listing_endpoint_still_works(client):
    client.post(VISITORS_URL, json=entry_payload())
    response = client.get(VISITORS_URL)
    assert response.status_code == 200
    assert len(response.json()) == 1
