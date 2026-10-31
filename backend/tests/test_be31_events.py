"""
pytest tests for BE-31 — Community Hub Events API.

Covers:
  - Creating events (with and without a gallery), including gallery validation
  - Listing events, filtered by status and date window
  - Getting a single event (with derived rsvp/volunteer counts + spots_remaining)
  - RSVP registration success and volunteer registration success
  - Capacity enforcement on RSVPs (400 once full) and volunteer exemption
  - Status window enforcement (400 once completed/cancelled)
  - Duplicate registration (409) and the rsvp+volunteer-by-one-resident case
  - Not-found paths (404)
  - Validation paths (422)

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import datetime, timedelta, timezone

from app.models.event import Event, EventRegistration
from app.models.resident import Flat, Resident

BASE = "/api/v1/events"


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


def seed_event(db_session, **overrides) -> str:
    defaults = {
        "title": "Community Meetup",
        "status": "upcoming",
        "event_date": datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7),
    }
    defaults.update(overrides)
    event = Event(**defaults)
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event.event_id


def seed_registration(db_session, event_id: str, resident_id: str, type: str) -> str:
    registration = EventRegistration(event_id=event_id, resident_id=resident_id, type=type)
    db_session.add(registration)
    db_session.commit()
    db_session.refresh(registration)
    return registration.registration_id


# ── Create ────────────────────────────────────────────────────────────────────

def test_create_event_returns_201(client, db_session):
    response = client.post(
        BASE,
        json={
            "title": "Diwali Get-Together",
            "event_date": "2026-11-08T18:30:00",
            "venue": "Community Hall",
            "capacity": 100,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Diwali Get-Together"
    assert body["status"] == "upcoming"
    assert body["rsvp_count"] == 0
    assert body["volunteer_count"] == 0
    assert body["spots_remaining"] == 100


def test_create_event_persists_and_is_listed(client, db_session):
    client.post(BASE, json={"title": "Yoga Day", "event_date": "2026-06-21T07:00:00"})

    response = client.get(BASE)
    assert response.status_code == 200
    titles = [e["title"] for e in response.json()]
    assert "Yoga Day" in titles


def test_create_event_with_unlimited_capacity_has_null_spots_remaining(client, db_session):
    response = client.post(
        BASE, json={"title": "Open House", "event_date": "2026-05-01T10:00:00"}
    )

    assert response.status_code == 201
    assert response.json()["spots_remaining"] is None


# ── Gallery validation ────────────────────────────────────────────────────────

def test_create_event_with_valid_gallery_succeeds(client, db_session):
    response = client.post(
        BASE,
        json={
            "title": "Sports Meet",
            "event_date": "2026-03-15T09:00:00",
            "gallery": [
                "https://cdn.example.com/sports.jpg",
                "/uploads/events/poster.png",
            ],
        },
    )

    assert response.status_code == 201
    assert response.json()["gallery"] == [
        "https://cdn.example.com/sports.jpg",
        "/uploads/events/poster.png",
    ]


def test_create_event_with_invalid_gallery_reference_returns_422(client, db_session):
    response = client.post(
        BASE,
        json={
            "title": "Bad Gallery",
            "event_date": "2026-03-15T09:00:00",
            "gallery": ["not-a-url-or-path"],
        },
    )

    assert response.status_code == 422


def test_create_event_with_blank_gallery_reference_returns_422(client, db_session):
    response = client.post(
        BASE,
        json={
            "title": "Blank Gallery",
            "event_date": "2026-03-15T09:00:00",
            "gallery": ["   "],
        },
    )

    assert response.status_code == 422


def test_create_event_over_gallery_limit_returns_422(client, db_session):
    response = client.post(
        BASE,
        json={
            "title": "Too Many Images",
            "event_date": "2026-03-15T09:00:00",
            "gallery": [f"/img/{i}.png" for i in range(11)],
        },
    )

    assert response.status_code == 422


# ── Listing ───────────────────────────────────────────────────────────────────

def test_list_events_filters_by_status(client, db_session):
    seed_event(db_session, title="Still Coming", status="upcoming")
    seed_event(db_session, title="Already Done", status="completed")

    response = client.get(f"{BASE}?status=completed")

    assert response.status_code == 200
    titles = [e["title"] for e in response.json()]
    assert titles == ["Already Done"]


def test_get_event_returns_derived_counts(client, db_session):
    event_id = seed_event(db_session, capacity=5)
    r1 = seed_resident(db_session, name="A")
    r2 = seed_resident(db_session, name="B")
    seed_registration(db_session, event_id, r1, "rsvp")
    seed_registration(db_session, event_id, r2, "volunteer")

    response = client.get(f"{BASE}/{event_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["rsvp_count"] == 1
    assert body["volunteer_count"] == 1
    assert body["spots_remaining"] == 4


# ── RSVP ──────────────────────────────────────────────────────────────────────

def test_rsvp_success_returns_201(client, db_session):
    event_id = seed_event(db_session)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{event_id}/register",
        json={"resident_id": resident_id, "type": "rsvp"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["event_id"] == event_id
    assert body["resident_id"] == resident_id
    assert body["type"] == "rsvp"


def test_rsvp_updates_rsvp_count(client, db_session):
    event_id = seed_event(db_session)
    resident_id = seed_resident(db_session)

    client.post(f"{BASE}/{event_id}/register", json={"resident_id": resident_id, "type": "rsvp"})

    response = client.get(f"{BASE}/{event_id}")
    assert response.json()["rsvp_count"] == 1


# ── Volunteer ─────────────────────────────────────────────────────────────────

def test_volunteer_success_returns_201(client, db_session):
    event_id = seed_event(db_session)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{event_id}/register",
        json={"resident_id": resident_id, "type": "volunteer"},
    )

    assert response.status_code == 201
    assert response.json()["type"] == "volunteer"


def test_resident_can_rsvp_and_volunteer_for_same_event(client, db_session):
    event_id = seed_event(db_session)
    resident_id = seed_resident(db_session)

    rsvp = client.post(
        f"{BASE}/{event_id}/register", json={"resident_id": resident_id, "type": "rsvp"}
    )
    volunteer = client.post(
        f"{BASE}/{event_id}/register", json={"resident_id": resident_id, "type": "volunteer"}
    )

    assert rsvp.status_code == 201
    assert volunteer.status_code == 201


# ── Capacity ──────────────────────────────────────────────────────────────────

def test_rsvp_at_capacity_returns_400(client, db_session):
    event_id = seed_event(db_session, capacity=1)
    seed_registration(db_session, event_id, seed_resident(db_session), "rsvp")
    late_resident = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{event_id}/register", json={"resident_id": late_resident, "type": "rsvp"}
    )

    assert response.status_code == 400
    assert "capacity" in response.json()["detail"].lower()


def test_rsvp_on_last_remaining_spot_succeeds(client, db_session):
    event_id = seed_event(db_session, capacity=1)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{event_id}/register", json={"resident_id": resident_id, "type": "rsvp"}
    )

    assert response.status_code == 201


def test_volunteer_allowed_even_when_rsvp_at_capacity(client, db_session):
    # capacity caps RSVPs only — a full attendee list must not block volunteers.
    event_id = seed_event(db_session, capacity=1)
    seed_registration(db_session, event_id, seed_resident(db_session), "rsvp")
    volunteer = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{event_id}/register", json={"resident_id": volunteer, "type": "volunteer"}
    )

    assert response.status_code == 201


def test_rsvp_on_unlimited_capacity_always_succeeds(client, db_session):
    event_id = seed_event(db_session, capacity=None)
    for _ in range(5):
        resident_id = seed_resident(db_session)
        response = client.post(
            f"{BASE}/{event_id}/register", json={"resident_id": resident_id, "type": "rsvp"}
        )
        assert response.status_code == 201


# ── Window ────────────────────────────────────────────────────────────────────

def test_register_on_completed_event_returns_400(client, db_session):
    event_id = seed_event(db_session, status="completed")
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{event_id}/register", json={"resident_id": resident_id, "type": "rsvp"}
    )

    assert response.status_code == 400
    assert "completed" in response.json()["detail"].lower()


def test_register_on_cancelled_event_returns_400(client, db_session):
    event_id = seed_event(db_session, status="cancelled")
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{event_id}/register", json={"resident_id": resident_id, "type": "volunteer"}
    )

    assert response.status_code == 400
    assert "cancelled" in response.json()["detail"].lower()


def test_register_on_ongoing_event_succeeds(client, db_session):
    event_id = seed_event(
        db_session, status="ongoing", event_date=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)
    )
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{event_id}/register", json={"resident_id": resident_id, "type": "volunteer"}
    )

    assert response.status_code == 201


# ── Duplicates ────────────────────────────────────────────────────────────────

def test_duplicate_rsvp_returns_409(client, db_session):
    event_id = seed_event(db_session)
    resident_id = seed_resident(db_session)
    seed_registration(db_session, event_id, resident_id, "rsvp")

    response = client.post(
        f"{BASE}/{event_id}/register", json={"resident_id": resident_id, "type": "rsvp"}
    )

    assert response.status_code == 409
    assert "already registered" in response.json()["detail"].lower()


# ── Listing registrations ─────────────────────────────────────────────────────

def test_list_registrations_filters_by_type(client, db_session):
    event_id = seed_event(db_session)
    r1 = seed_resident(db_session, name="A")
    r2 = seed_resident(db_session, name="B")
    seed_registration(db_session, event_id, r1, "rsvp")
    seed_registration(db_session, event_id, r2, "volunteer")

    response = client.get(f"{BASE}/{event_id}/registrations?type=volunteer")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["type"] == "volunteer"


# ── Not found ─────────────────────────────────────────────────────────────────

def test_get_unknown_event_returns_404(client, db_session):
    response = client.get(f"{BASE}/does-not-exist")

    assert response.status_code == 404


def test_register_unknown_event_returns_404(client, db_session):
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/does-not-exist/register", json={"resident_id": resident_id, "type": "rsvp"}
    )

    assert response.status_code == 404
    assert "event" in response.json()["detail"].lower()


def test_register_unknown_resident_returns_404(client, db_session):
    event_id = seed_event(db_session)

    response = client.post(
        f"{BASE}/{event_id}/register", json={"resident_id": "does-not-exist", "type": "rsvp"}
    )

    assert response.status_code == 404
    assert "resident" in response.json()["detail"].lower()


def test_list_registrations_unknown_event_returns_404(client, db_session):
    response = client.get(f"{BASE}/does-not-exist/registrations")

    assert response.status_code == 404


# ── Validation ────────────────────────────────────────────────────────────────

def test_register_missing_type_returns_422(client, db_session):
    event_id = seed_event(db_session)
    resident_id = seed_resident(db_session)

    response = client.post(f"{BASE}/{event_id}/register", json={"resident_id": resident_id})

    assert response.status_code == 422


def test_register_invalid_type_returns_422(client, db_session):
    event_id = seed_event(db_session)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{event_id}/register", json={"resident_id": resident_id, "type": "maybe"}
    )

    assert response.status_code == 422


def test_create_event_missing_title_returns_422(client, db_session):
    response = client.post(BASE, json={"event_date": "2026-05-01T10:00:00"})

    assert response.status_code == 422


def test_list_events_invalid_status_returns_422(client, db_session):
    response = client.get(f"{BASE}?status=not-a-real-status")

    assert response.status_code == 422
