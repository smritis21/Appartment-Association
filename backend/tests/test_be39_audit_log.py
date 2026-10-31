"""
pytest tests for BE-39 — Audit Log API.

Covers:
  - Access control (admin-only, enforced with a real BE-21 Bearer token)
  - Retrieval: empty state, filtering by every field, pagination
  - Validation: date_from later than date_to
  - Logging on key actions — integration tests that hit the real BE-33/BE-34
    endpoints and confirm a matching audit row was written
  - Immutability at the API level: no PUT/DELETE route exists

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.models.audit import AuditLog
from app.models.resident import Flat, Resident
from app.models.user import User

BASE = "/api/v1/audit"


# ── Auth ──────────────────────────────────────────────────────────────────────
# The audit router originally sat behind the interim X-User-Role header stub.
# BE-21 replaced that with real JWT role checks, so these tests sign in and
# send a Bearer token like every other protected endpoint's tests do.

def _token_headers(client, db_session, email, role):
    resp = client.post("/api/v1/auth/register", json={
        "email": email, "password": "password123", "full_name": "Audit Test", "role": role,
    })
    assert resp.status_code == 201
    user = db_session.query(User).filter(User.user_id == resp.json()["user_id"]).first()
    user.account_status = "active"
    db_session.commit()

    login = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    assert login.status_code == 200

    # Signing up writes its own audit entries. These tests assert on the rows
    # their own actions produce, so the sign-up noise is cleared here rather
    # than every assertion having to filter it out.
    from app.models.audit import AuditLog
    db_session.query(AuditLog).delete()
    db_session.commit()

    return {"Authorization": f"Bearer {login.json()['access_token']}"}


@pytest.fixture
def admin_headers(client, db_session):
    return _token_headers(client, db_session, "audit-admin@jkr.com", "admin")


@pytest.fixture
def resident_headers(client, db_session):
    return _token_headers(client, db_session, "audit-resident@jkr.com", "owner")


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_resident(db_session, **overrides) -> str:
    flat = Flat(block="A", floor="1", flat_number="101", ownership_type="owned", occupancy_status="occupied")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)

    defaults = {
        "flat_id": flat.flat_id,
        "name": "Test Resident",
        "phone": "9800000000",
        "status": "active",
    }
    defaults.update(overrides)
    resident = Resident(**defaults)
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def seed_log(db_session, **overrides) -> str:
    defaults = {
        "actor_id": "res-1",
        "actor_role": "resident",
        "module": "temple",
        "action": "seva_booking_created",
        "target_type": "temple_booking",
        "target_id": "booking-1",
        "description": "Booked archana.",
    }
    defaults.update(overrides)
    log = AuditLog(**defaults)
    db_session.add(log)
    db_session.commit()
    db_session.refresh(log)
    return log.log_id


# ── Access control ────────────────────────────────────────────────────────────

def test_list_without_a_token_returns_401(client, db_session):
    """No credentials at all is unauthenticated, not forbidden."""
    response = client.get(BASE)

    assert response.status_code == 401


def test_list_with_wrong_role_returns_403(client, db_session, resident_headers):
    """Signed in, but not an admin."""
    response = client.get(BASE, headers=resident_headers)

    assert response.status_code == 403


def test_list_with_admin_role_returns_200(client, db_session, admin_headers):
    response = client.get(BASE, headers=admin_headers)

    assert response.status_code == 200


# ── Retrieval ─────────────────────────────────────────────────────────────────

def test_list_empty_returns_200_with_empty_items(client, db_session, admin_headers):
    response = client.get(BASE, headers=admin_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["items"] == []
    assert body["total"] == 0
    assert body["pages"] == 0


def test_list_returns_all_newest_first(client, db_session, admin_headers):
    seed_log(db_session, action="first", timestamp=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5))
    seed_log(db_session, action="second", timestamp=datetime.now(timezone.utc).replace(tzinfo=None))

    response = client.get(BASE, headers=admin_headers)

    assert response.status_code == 200
    actions = [item["action"] for item in response.json()["items"]]
    assert actions == ["second", "first"]


def test_filter_by_module(client, db_session, admin_headers):
    seed_log(db_session, module="temple")
    seed_log(db_session, module="community", action="activity_signup_created")

    response = client.get(f"{BASE}?module=community", headers=admin_headers)

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["module"] == "community"


def test_filter_by_action(client, db_session, admin_headers):
    seed_log(db_session, action="seva_booking_created")
    seed_log(db_session, action="donation_recorded")

    response = client.get(f"{BASE}?action=donation_recorded", headers=admin_headers)

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["action"] == "donation_recorded"


def test_filter_by_actor_id(client, db_session, admin_headers):
    seed_log(db_session, actor_id="res-1")
    seed_log(db_session, actor_id="res-2")

    response = client.get(f"{BASE}?actor_id=res-2", headers=admin_headers)

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["actor_id"] == "res-2"


def test_filter_by_target_id(client, db_session, admin_headers):
    seed_log(db_session, target_id="booking-1")
    seed_log(db_session, target_id="booking-2")

    response = client.get(f"{BASE}?target_id=booking-2", headers=admin_headers)

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["target_id"] == "booking-2"


def test_filter_by_date_range(client, db_session, admin_headers):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    seed_log(db_session, action="old", timestamp=now - timedelta(days=10))
    seed_log(db_session, action="recent", timestamp=now)

    response = client.get(
        f"{BASE}?date_from={(now - timedelta(days=1)).isoformat()}", headers=admin_headers
    )

    assert response.status_code == 200
    actions = [item["action"] for item in response.json()["items"]]
    assert actions == ["recent"]


def test_pagination(client, db_session, admin_headers):
    for i in range(5):
        seed_log(db_session, action=f"action-{i}")

    response = client.get(f"{BASE}?page=1&page_size=2", headers=admin_headers)

    assert response.status_code == 200
    body = response.json()
    assert len(body["items"]) == 2
    assert body["total"] == 5
    assert body["pages"] == 3


# ── Validation ────────────────────────────────────────────────────────────────

def test_date_from_after_date_to_returns_422(client, db_session, admin_headers):
    response = client.get(
        f"{BASE}?date_from=2026-06-01T00:00:00&date_to=2026-01-01T00:00:00", headers=admin_headers
    )

    assert response.status_code == 422


# ── Logging on key actions (integration) ──────────────────────────────────────

def test_seva_booking_writes_audit_entry(client, db_session, admin_headers):
    resident_id = seed_resident(db_session)
    booking = client.post(
        "/api/v1/temple/sevas",
        json={
            "resident_id": resident_id,
            "seva_type": "archana",
            "booking_date": (datetime.now() + timedelta(days=7)).date().isoformat(),
            "amount": "101",
        },
    ).json()

    response = client.get(f"{BASE}?target_id={booking['booking_id']}", headers=admin_headers)

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["action"] == "seva_booking_created"
    assert items[0]["module"] == "temple"
    assert items[0]["actor_id"] == resident_id


def test_donation_writes_audit_entry(client, db_session, admin_headers):
    donation = client.post(
        "/api/v1/temple/donations", json={"donor_name": "Anonymous", "amount": "501"}
    ).json()

    response = client.get(f"{BASE}?target_id={donation['donation_id']}", headers=admin_headers)

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["action"] == "donation_recorded"


def test_activity_signup_writes_audit_entry(client, db_session, admin_headers):
    from app.models.community import CommunityActivity

    activity = CommunityActivity(corner="kids", title="Camp", status="upcoming")
    db_session.add(activity)
    db_session.commit()
    db_session.refresh(activity)

    resident_id = seed_resident(db_session)
    signup = client.post(
        f"/api/v1/community/activities/{activity.activity_id}/signup",
        json={"resident_id": resident_id},
    ).json()

    response = client.get(f"{BASE}?target_id={signup['signup_id']}", headers=admin_headers)

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["action"] == "activity_signup_created"
    assert items[0]["module"] == "community"


def test_event_signup_writes_audit_entry(client, db_session, admin_headers):
    from app.models.temple import TempleEvent

    event = TempleEvent(
        title="Festival", event_date=datetime.now() + timedelta(days=7), status="upcoming"
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)

    resident_id = seed_resident(db_session)
    signup = client.post(
        f"/api/v1/temple/events/{event.event_id}/signup",
        json={"resident_id": resident_id, "type": "volunteer"},
    ).json()

    response = client.get(f"{BASE}?target_id={signup['signup_id']}", headers=admin_headers)

    assert response.status_code == 200
    items = response.json()["items"]
    assert len(items) == 1
    assert items[0]["action"] == "event_signup_created"


# ── Immutability (API level) ──────────────────────────────────────────────────
# There is no /audit/{id} route at all (list-only) — PUT/DELETE/POST against
# the one registered path (/audit) hit a real path with an unsupported
# method, which is what actually proves 405 rather than a routing 404.

def test_no_put_method_for_audit(client, db_session):
    seed_log(db_session)

    response = client.put(BASE, json={})

    assert response.status_code == 405


def test_no_delete_method_for_audit(client, db_session):
    seed_log(db_session)

    response = client.delete(BASE)

    assert response.status_code == 405


def test_no_post_method_for_audit(client, db_session, admin_headers):
    """Entries can only be written by trusted server-side calls, not the public API."""
    response = client.post(BASE, json={"module": "temple", "action": "forged"}, headers=admin_headers)

    assert response.status_code == 405
