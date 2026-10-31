"""
pytest tests for BE-34 — Community Corners API.

Covers:
  - Listing activities across corners, filtered by corner/status
  - Getting a single activity (with derived signup_count/spots_remaining)
  - Signup success, including unlimited-capacity and last-spot-boundary cases
  - Capacity enforcement (400 once full)
  - Date/status window enforcement (400 once completed/cancelled/past-dated)
  - Duplicate signup (409)
  - Not-found paths (404)
  - Validation paths (422)

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import date, timedelta

from app.models.community import ActivitySignup, CommunityActivity
from app.models.resident import Flat, Resident

BASE = "/api/v1/community"


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


def seed_activity(db_session, **overrides) -> str:
    defaults = {
        "corner": "kids",
        "title": "Summer Camp",
        "status": "upcoming",
        "activity_date": date.today() + timedelta(days=7),
    }
    defaults.update(overrides)
    activity = CommunityActivity(**defaults)
    db_session.add(activity)
    db_session.commit()
    db_session.refresh(activity)
    return activity.activity_id


def seed_signup(db_session, activity_id: str, resident_id: str) -> str:
    signup = ActivitySignup(activity_id=activity_id, resident_id=resident_id)
    db_session.add(signup)
    db_session.commit()
    db_session.refresh(signup)
    return signup.signup_id


# ── Listing — success ─────────────────────────────────────────────────────────

def test_list_activities_returns_all(client, db_session):
    seed_activity(db_session, corner="kids", title="Kids Club")
    seed_activity(db_session, corner="senior", title="Yoga")

    response = client.get(f"{BASE}/activities")

    assert response.status_code == 200
    titles = {a["title"] for a in response.json()}
    assert titles == {"Kids Club", "Yoga"}


def test_list_activities_filters_by_corner(client, db_session):
    seed_activity(db_session, corner="kids", title="Kids Club")
    seed_activity(db_session, corner="senior", title="Yoga")

    response = client.get(f"{BASE}/activities?corner=senior")

    assert response.status_code == 200
    titles = [a["title"] for a in response.json()]
    assert titles == ["Yoga"]


def test_list_activities_filters_by_status(client, db_session):
    seed_activity(db_session, title="Still Coming", status="upcoming")
    seed_activity(db_session, title="Already Done", status="completed")

    response = client.get(f"{BASE}/activities?status=completed")

    assert response.status_code == 200
    titles = [a["title"] for a in response.json()]
    assert titles == ["Already Done"]


def test_get_activity_returns_derived_counts(client, db_session):
    activity_id = seed_activity(db_session, capacity=5)
    resident_id = seed_resident(db_session)
    seed_signup(db_session, activity_id, resident_id)

    response = client.get(f"{BASE}/activities/{activity_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["signup_count"] == 1
    assert body["spots_remaining"] == 4


def test_get_activity_with_unlimited_capacity_has_null_spots_remaining(client, db_session):
    activity_id = seed_activity(db_session, capacity=None)

    response = client.get(f"{BASE}/activities/{activity_id}")

    assert response.status_code == 200
    assert response.json()["spots_remaining"] is None


# ── Signup — success ──────────────────────────────────────────────────────────

def test_signup_success_returns_201(client, db_session):
    activity_id = seed_activity(db_session)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/activities/{activity_id}/signup",
        json={"resident_id": resident_id, "notes": "Bringing a friend"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["activity_id"] == activity_id
    assert body["resident_id"] == resident_id
    assert body["notes"] == "Bringing a friend"


def test_signup_persists_and_updates_signup_count(client, db_session):
    activity_id = seed_activity(db_session)
    resident_id = seed_resident(db_session)

    client.post(f"{BASE}/activities/{activity_id}/signup", json={"resident_id": resident_id})

    response = client.get(f"{BASE}/activities/{activity_id}")
    assert response.json()["signup_count"] == 1


def test_signup_on_unlimited_capacity_activity_always_succeeds(client, db_session):
    activity_id = seed_activity(db_session, capacity=None)
    for _ in range(5):
        resident_id = seed_resident(db_session)
        response = client.post(
            f"{BASE}/activities/{activity_id}/signup", json={"resident_id": resident_id}
        )
        assert response.status_code == 201


def test_signup_on_last_remaining_spot_succeeds(client, db_session):
    activity_id = seed_activity(db_session, capacity=1)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/activities/{activity_id}/signup", json={"resident_id": resident_id}
    )

    assert response.status_code == 201


def test_list_signups_for_activity(client, db_session):
    activity_id = seed_activity(db_session)
    r1 = seed_resident(db_session, name="First")
    r2 = seed_resident(db_session, name="Second")
    seed_signup(db_session, activity_id, r1)
    seed_signup(db_session, activity_id, r2)

    response = client.get(f"{BASE}/activities/{activity_id}/signups")

    assert response.status_code == 200
    assert len(response.json()) == 2


# ── Capacity ──────────────────────────────────────────────────────────────────

def test_signup_at_capacity_returns_400(client, db_session):
    activity_id = seed_activity(db_session, capacity=1)
    seed_signup(db_session, activity_id, seed_resident(db_session))
    late_resident = seed_resident(db_session)

    response = client.post(
        f"{BASE}/activities/{activity_id}/signup", json={"resident_id": late_resident}
    )

    assert response.status_code == 400
    assert "capacity" in response.json()["detail"].lower()


# ── Window ────────────────────────────────────────────────────────────────────

def test_signup_on_completed_activity_returns_400(client, db_session):
    activity_id = seed_activity(db_session, status="completed")
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/activities/{activity_id}/signup", json={"resident_id": resident_id}
    )

    assert response.status_code == 400
    assert "completed" in response.json()["detail"].lower()


def test_signup_on_cancelled_activity_returns_400(client, db_session):
    activity_id = seed_activity(db_session, status="cancelled")
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/activities/{activity_id}/signup", json={"resident_id": resident_id}
    )

    assert response.status_code == 400
    assert "cancelled" in response.json()["detail"].lower()


def test_signup_on_past_dated_activity_returns_400(client, db_session):
    activity_id = seed_activity(
        db_session, status="upcoming", activity_date=date.today() - timedelta(days=1)
    )
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/activities/{activity_id}/signup", json={"resident_id": resident_id}
    )

    assert response.status_code == 400
    assert "already took place" in response.json()["detail"].lower()


def test_signup_on_future_upcoming_activity_succeeds(client, db_session):
    activity_id = seed_activity(
        db_session, status="upcoming", activity_date=date.today() + timedelta(days=1)
    )
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/activities/{activity_id}/signup", json={"resident_id": resident_id}
    )

    assert response.status_code == 201


# ── Duplicates ────────────────────────────────────────────────────────────────

def test_duplicate_signup_returns_409(client, db_session):
    activity_id = seed_activity(db_session)
    resident_id = seed_resident(db_session)
    seed_signup(db_session, activity_id, resident_id)

    response = client.post(
        f"{BASE}/activities/{activity_id}/signup", json={"resident_id": resident_id}
    )

    assert response.status_code == 409
    assert "already signed up" in response.json()["detail"].lower()


# ── Not found ─────────────────────────────────────────────────────────────────

def test_get_unknown_activity_returns_404(client, db_session):
    response = client.get(f"{BASE}/activities/does-not-exist")

    assert response.status_code == 404


def test_signup_unknown_activity_returns_404(client, db_session):
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/activities/does-not-exist/signup", json={"resident_id": resident_id}
    )

    assert response.status_code == 404
    assert "activity" in response.json()["detail"].lower()


def test_signup_unknown_resident_returns_404(client, db_session):
    activity_id = seed_activity(db_session)

    response = client.post(
        f"{BASE}/activities/{activity_id}/signup", json={"resident_id": "does-not-exist"}
    )

    assert response.status_code == 404
    assert "resident" in response.json()["detail"].lower()


def test_list_signups_unknown_activity_returns_404(client, db_session):
    response = client.get(f"{BASE}/activities/does-not-exist/signups")

    assert response.status_code == 404


# ── Validation ────────────────────────────────────────────────────────────────

def test_signup_missing_resident_id_returns_422(client, db_session):
    activity_id = seed_activity(db_session)

    response = client.post(f"{BASE}/activities/{activity_id}/signup", json={})

    assert response.status_code == 422


def test_list_activities_invalid_corner_returns_422(client, db_session):
    response = client.get(f"{BASE}/activities?corner=not-a-real-corner")

    assert response.status_code == 422


def test_list_activities_invalid_status_returns_422(client, db_session):
    response = client.get(f"{BASE}/activities?status=not-a-real-status")

    assert response.status_code == 422
