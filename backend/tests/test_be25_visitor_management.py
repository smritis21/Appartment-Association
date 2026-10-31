"""
pytest tests for BE-25 — Visitor Management API.

Story: as a guard, I want endpoints so that passes, deliveries, logs and
verification persist.

Covers:
  - POST /visitors/passes issues a pre-authorised, already-approved pass
    with a unique pass_code
  - POST /visitors/passes/verify redeems a pass and logs entry_time
  - A pass is single-use: verifying it twice returns 409
  - Verifying outside [valid_from, valid_until] returns 400
  - Unknown pass codes return 404
  - Issuing against an unknown resident returns 404
  - valid_until <= valid_from is rejected with 400
  - PUT /visitors/{id}/exit logs exit_time, requires a prior entry, and
    rejects a duplicate exit
  - GET /visitors supports filtering by status, purpose, gate and date range
  - Pass codes issued across many passes are all unique

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import datetime, timedelta, timezone

from app.models.resident import Flat, Resident

VISITORS_URL = "/api/v1/visitors"
PASSES_URL = f"{VISITORS_URL}/passes"
VERIFY_URL = f"{PASSES_URL}/verify"


def _iso(dt: datetime) -> str:
    return dt.isoformat()


def seed_resident(db_session, name="Test Resident") -> str:
    flat = Flat(block="A", flat_number="101")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)

    resident = Resident(name=name, flat_id=flat.flat_id, phone="9999999999")
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def pass_payload(resident_id: str, **overrides) -> dict:
    now = datetime.now(timezone.utc)
    defaults = {
        "visitor_name": "Delivery Agent",
        "purpose": "Delivery",
        "phone": "9876543210",
        "flat_number": "A-101",
        "gate": "Main Gate",
        "resident_id": resident_id,
        "valid_from": _iso(now),
        "valid_until": _iso(now + timedelta(hours=2)),
    }
    defaults.update(overrides)
    return defaults


# ── Issuing a pass ───────────────────────────────────────────────────────────

def test_issue_pass_returns_201_and_is_already_approved(client, db_session):
    resident_id = seed_resident(db_session)

    response = client.post(PASSES_URL, json=pass_payload(resident_id))

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "approved"
    assert body["resident_id"] == resident_id
    assert body["pass_code"]
    assert len(body["pass_code"]) == 8
    assert body["entry_time"] is None


def test_issue_pass_unknown_resident_returns_404(client):
    response = client.post(PASSES_URL, json=pass_payload("does-not-exist"))
    assert response.status_code == 404


def test_issue_pass_invalid_window_returns_400(client, db_session):
    resident_id = seed_resident(db_session)
    now = datetime.now(timezone.utc)

    response = client.post(
        PASSES_URL,
        json=pass_payload(resident_id, valid_from=_iso(now), valid_until=_iso(now - timedelta(hours=1))),
    )
    assert response.status_code == 400


def test_issued_pass_codes_are_unique(client, db_session):
    resident_id = seed_resident(db_session)

    codes = set()
    for _ in range(10):
        body = client.post(PASSES_URL, json=pass_payload(resident_id)).json()
        codes.add(body["pass_code"])

    assert len(codes) == 10


# ── Verifying a pass ─────────────────────────────────────────────────────────

def test_verify_pass_logs_entry(client, db_session):
    resident_id = seed_resident(db_session)
    pass_code = client.post(PASSES_URL, json=pass_payload(resident_id)).json()["pass_code"]

    response = client.post(VERIFY_URL, json={"pass_code": pass_code, "gate": "Main Gate"})

    assert response.status_code == 200
    body = response.json()
    assert body["entry_time"] is not None
    assert body["gate"] == "Main Gate"


def test_verify_pass_is_single_use(client, db_session):
    resident_id = seed_resident(db_session)
    pass_code = client.post(PASSES_URL, json=pass_payload(resident_id)).json()["pass_code"]

    first = client.post(VERIFY_URL, json={"pass_code": pass_code})
    assert first.status_code == 200

    second = client.post(VERIFY_URL, json={"pass_code": pass_code})
    assert second.status_code == 409


def test_verify_unknown_pass_code_returns_404(client):
    response = client.post(VERIFY_URL, json={"pass_code": "NOSUCHONE"})
    assert response.status_code == 404


def test_verify_pass_before_valid_from_returns_400(client, db_session):
    resident_id = seed_resident(db_session)
    now = datetime.now(timezone.utc)
    pass_code = client.post(
        PASSES_URL,
        json=pass_payload(
            resident_id,
            valid_from=_iso(now + timedelta(hours=1)),
            valid_until=_iso(now + timedelta(hours=2)),
        ),
    ).json()["pass_code"]

    response = client.post(VERIFY_URL, json={"pass_code": pass_code})
    assert response.status_code == 400


def test_verify_pass_after_valid_until_returns_400(client, db_session):
    resident_id = seed_resident(db_session)
    now = datetime.now(timezone.utc)
    pass_code = client.post(
        PASSES_URL,
        json=pass_payload(
            resident_id,
            valid_from=_iso(now - timedelta(hours=2)),
            valid_until=_iso(now - timedelta(hours=1)),
        ),
    ).json()["pass_code"]

    response = client.post(VERIFY_URL, json={"pass_code": pass_code})
    assert response.status_code == 400


# ── Exit logging ─────────────────────────────────────────────────────────────

def test_log_exit_requires_prior_entry(client, db_session):
    resident_id = seed_resident(db_session)
    visitor_id = client.post(PASSES_URL, json=pass_payload(resident_id)).json()["visitor_id"]

    response = client.put(f"{VISITORS_URL}/{visitor_id}/exit")
    assert response.status_code == 400


def test_log_exit_after_entry_succeeds(client, db_session):
    resident_id = seed_resident(db_session)
    body = client.post(PASSES_URL, json=pass_payload(resident_id)).json()
    client.post(VERIFY_URL, json={"pass_code": body["pass_code"]})

    response = client.put(f"{VISITORS_URL}/{body['visitor_id']}/exit")
    assert response.status_code == 200
    assert response.json()["exit_time"] is not None


def test_log_exit_twice_returns_409(client, db_session):
    resident_id = seed_resident(db_session)
    body = client.post(PASSES_URL, json=pass_payload(resident_id)).json()
    client.post(VERIFY_URL, json={"pass_code": body["pass_code"]})
    visitor_id = body["visitor_id"]

    client.put(f"{VISITORS_URL}/{visitor_id}/exit")
    second = client.put(f"{VISITORS_URL}/{visitor_id}/exit")
    assert second.status_code == 409


def test_log_exit_unknown_visitor_returns_404(client):
    response = client.put(f"{VISITORS_URL}/does-not-exist/exit")
    assert response.status_code == 404


# ── Filterable history ───────────────────────────────────────────────────────

def test_history_filters_by_status(client, db_session):
    resident_id = seed_resident(db_session)
    client.post(PASSES_URL, json=pass_payload(resident_id))  # approved
    client.post(VISITORS_URL, json={"visitor_name": "Walk-in", "resident_id": resident_id})  # pending

    response = client.get(f"{VISITORS_URL}?status=approved")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["status"] == "approved"


def test_history_filters_by_purpose_and_gate(client, db_session):
    resident_id = seed_resident(db_session)
    client.post(PASSES_URL, json=pass_payload(resident_id, purpose="Delivery", gate="Main Gate"))
    client.post(PASSES_URL, json=pass_payload(resident_id, purpose="Guest Visit", gate="East Gate"))

    response = client.get(f"{VISITORS_URL}?purpose=Delivery&gate=Main Gate")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["purpose"] == "Delivery"


def test_history_filters_by_date_range(client, db_session):
    resident_id = seed_resident(db_session)
    client.post(PASSES_URL, json=pass_payload(resident_id))
    far_future = _iso(datetime.now(timezone.utc) + timedelta(days=30))

    response = client.get(VISITORS_URL, params={"date_from": far_future})

    assert response.status_code == 200
    assert response.json() == []


def test_history_combines_with_resident_filter(client, db_session):
    resident_a = seed_resident(db_session, name="Resident A")
    resident_b = seed_resident(db_session, name="Resident B")
    client.post(PASSES_URL, json=pass_payload(resident_a))
    client.post(PASSES_URL, json=pass_payload(resident_b))

    response = client.get(f"{VISITORS_URL}?resident_id={resident_a}")

    assert len(response.json()) == 1
    assert response.json()[0]["resident_id"] == resident_a
