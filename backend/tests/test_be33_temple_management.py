"""
pytest tests for BE-33 — Temple Management API.

Covers:
  - Seva booking success, cancellation, and re-booking a slot after cancel
  - Seva slot conflicts (confirmed-only) and their boundaries
  - Seva validation (past date, bad seva_type, non-positive amount) and not-found
  - Donation success (resident-linked and anonymous), validation, not-found
  - Temple event creation/listing
  - Event signup success (rsvp/volunteer, both by the same resident)
  - Event signup conflicts, window (status/date) rules, not-found, validation

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import date, datetime, timedelta

from app.models.resident import Flat, Resident
from app.models.temple import TempleBooking, TempleDonation, TempleEvent, TempleEventSignup

BASE = "/api/v1/temple"


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


def future_date(days: int = 7) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def future_datetime(days: int = 7) -> str:
    return (datetime.now() + timedelta(days=days)).isoformat()


def seed_event(db_session, **overrides) -> str:
    defaults = {
        "title": "Annual Festival",
        "event_date": datetime.now() + timedelta(days=7),
        "status": "upcoming",
    }
    defaults.update(overrides)
    event = TempleEvent(**defaults)
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event.event_id


# ── Seva booking — success ────────────────────────────────────────────────────

def test_book_seva_success_returns_201(client, db_session):
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/sevas",
        json={
            "resident_id": resident_id,
            "seva_type": "archana",
            "booking_date": future_date(),
            "slot": "morning",
            "amount": "101.00",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "confirmed"
    assert body["seva_type"] == "archana"


def test_book_seva_persists_in_db(client, db_session):
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/sevas",
        json={
            "resident_id": resident_id,
            "seva_type": "abhishekam",
            "booking_date": future_date(),
            "amount": "501",
        },
    )
    booking_id = response.json()["booking_id"]

    row = db_session.query(TempleBooking).filter(TempleBooking.booking_id == booking_id).first()
    assert row is not None
    assert row.status == "confirmed"


def test_cancel_seva_success(client, db_session):
    resident_id = seed_resident(db_session)
    booking_id = client.post(
        f"{BASE}/sevas",
        json={
            "resident_id": resident_id,
            "seva_type": "monthly_pooja",
            "booking_date": future_date(),
            "amount": "50",
        },
    ).json()["booking_id"]

    response = client.post(f"{BASE}/sevas/{booking_id}/cancel")

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_rebooking_same_slot_after_cancel_succeeds(client, db_session):
    """Proves the conflict check only looks at *confirmed* bookings."""
    resident_id = seed_resident(db_session)
    booking_date = future_date()
    payload = {
        "resident_id": resident_id,
        "seva_type": "archana",
        "booking_date": booking_date,
        "slot": "evening",
        "amount": "101",
    }

    first = client.post(f"{BASE}/sevas", json=payload)
    client.post(f"{BASE}/sevas/{first.json()['booking_id']}/cancel")

    second = client.post(f"{BASE}/sevas", json=payload)

    assert second.status_code == 201


# ── Seva booking — conflicts ──────────────────────────────────────────────────

def test_duplicate_confirmed_slot_returns_409(client, db_session):
    resident_id = seed_resident(db_session)
    payload = {
        "resident_id": resident_id,
        "seva_type": "archana",
        "booking_date": future_date(),
        "slot": "morning",
        "amount": "101",
    }

    first = client.post(f"{BASE}/sevas", json=payload)
    assert first.status_code == 201

    second = client.post(f"{BASE}/sevas", json=payload)
    assert second.status_code == 409
    assert "already confirmed" in second.json()["detail"].lower()


def test_same_slot_different_seva_type_succeeds(client, db_session):
    resident_id = seed_resident(db_session)
    booking_date = future_date()

    first = client.post(
        f"{BASE}/sevas",
        json={
            "resident_id": resident_id,
            "seva_type": "archana",
            "booking_date": booking_date,
            "slot": "morning",
            "amount": "101",
        },
    )
    second = client.post(
        f"{BASE}/sevas",
        json={
            "resident_id": resident_id,
            "seva_type": "abhishekam",
            "booking_date": booking_date,
            "slot": "morning",
            "amount": "101",
        },
    )

    assert first.status_code == 201
    assert second.status_code == 201


def test_same_slot_different_date_succeeds(client, db_session):
    resident_id = seed_resident(db_session)

    first = client.post(
        f"{BASE}/sevas",
        json={
            "resident_id": resident_id,
            "seva_type": "archana",
            "booking_date": future_date(1),
            "slot": "morning",
            "amount": "101",
        },
    )
    second = client.post(
        f"{BASE}/sevas",
        json={
            "resident_id": resident_id,
            "seva_type": "archana",
            "booking_date": future_date(2),
            "slot": "morning",
            "amount": "101",
        },
    )

    assert first.status_code == 201
    assert second.status_code == 201


def test_cancel_already_cancelled_returns_409(client, db_session):
    resident_id = seed_resident(db_session)
    booking_id = client.post(
        f"{BASE}/sevas",
        json={
            "resident_id": resident_id,
            "seva_type": "monthly_pooja",
            "booking_date": future_date(),
            "amount": "50",
        },
    ).json()["booking_id"]
    client.post(f"{BASE}/sevas/{booking_id}/cancel")

    response = client.post(f"{BASE}/sevas/{booking_id}/cancel")

    assert response.status_code == 409
    assert "already cancelled" in response.json()["detail"].lower()


# ── Seva booking — validation & not found ─────────────────────────────────────

def test_book_seva_past_date_returns_422(client, db_session):
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/sevas",
        json={
            "resident_id": resident_id,
            "seva_type": "archana",
            "booking_date": (date.today() - timedelta(days=1)).isoformat(),
            "amount": "101",
        },
    )

    assert response.status_code == 422


def test_book_seva_invalid_seva_type_returns_422(client, db_session):
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/sevas",
        json={
            "resident_id": resident_id,
            "seva_type": "not_a_real_seva",
            "booking_date": future_date(),
            "amount": "101",
        },
    )

    assert response.status_code == 422


def test_book_seva_non_positive_amount_returns_422(client, db_session):
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/sevas",
        json={
            "resident_id": resident_id,
            "seva_type": "archana",
            "booking_date": future_date(),
            "amount": "0",
        },
    )

    assert response.status_code == 422


def test_book_seva_unknown_resident_returns_404(client, db_session):
    response = client.post(
        f"{BASE}/sevas",
        json={
            "resident_id": "does-not-exist",
            "seva_type": "archana",
            "booking_date": future_date(),
            "amount": "101",
        },
    )

    assert response.status_code == 404


def test_cancel_unknown_booking_returns_404(client, db_session):
    response = client.post(f"{BASE}/sevas/does-not-exist/cancel")

    assert response.status_code == 404


def test_get_unknown_booking_returns_404(client, db_session):
    response = client.get(f"{BASE}/sevas/does-not-exist")

    assert response.status_code == 404


# ── Donations — success ───────────────────────────────────────────────────────

def test_donation_with_resident_success(client, db_session):
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/donations",
        json={"resident_id": resident_id, "amount": "501", "purpose": "annadanam"},
    )

    assert response.status_code == 201
    assert response.json()["resident_id"] == resident_id


def test_anonymous_donation_with_donor_name_success(client, db_session):
    response = client.post(
        f"{BASE}/donations",
        json={"donor_name": "Anonymous Well-wisher", "amount": "1001"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["resident_id"] is None
    assert body["donor_name"] == "Anonymous Well-wisher"


# ── Donations — validation & not found ────────────────────────────────────────

def test_donation_non_positive_amount_returns_422(client, db_session):
    response = client.post(
        f"{BASE}/donations", json={"donor_name": "Someone", "amount": "0"}
    )

    assert response.status_code == 422


def test_donation_missing_identity_returns_422(client, db_session):
    """Neither resident_id nor donor_name supplied."""
    response = client.post(f"{BASE}/donations", json={"amount": "101"})

    assert response.status_code == 422


def test_donation_unknown_resident_returns_404(client, db_session):
    response = client.post(
        f"{BASE}/donations", json={"resident_id": "does-not-exist", "amount": "101"}
    )

    assert response.status_code == 404


def test_get_unknown_donation_returns_404(client, db_session):
    response = client.get(f"{BASE}/donations/does-not-exist")

    assert response.status_code == 404


# ── Events — success ──────────────────────────────────────────────────────────

def test_create_event_success(client, db_session):
    response = client.post(
        f"{BASE}/events",
        json={"title": "Annual Festival", "event_date": future_datetime()},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "upcoming"


def test_list_events_filters_by_status(client, db_session):
    client.post(f"{BASE}/events", json={"title": "Still Coming", "event_date": future_datetime()})
    client.post(
        f"{BASE}/events",
        json={"title": "Already Done", "event_date": future_datetime(), "status": "completed"},
    )

    response = client.get(f"{BASE}/events?status=completed")

    assert response.status_code == 200
    titles = [e["title"] for e in response.json()]
    assert titles == ["Already Done"]


# ── Event signup — success ────────────────────────────────────────────────────

def test_event_rsvp_signup_success(client, db_session):
    event_id = seed_event(db_session)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/events/{event_id}/signup", json={"resident_id": resident_id, "type": "rsvp"}
    )

    assert response.status_code == 201
    assert response.json()["type"] == "rsvp"


def test_event_volunteer_signup_success(client, db_session):
    event_id = seed_event(db_session)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/events/{event_id}/signup", json={"resident_id": resident_id, "type": "volunteer"}
    )

    assert response.status_code == 201
    assert response.json()["type"] == "volunteer"


def test_same_resident_can_rsvp_and_volunteer(client, db_session):
    event_id = seed_event(db_session)
    resident_id = seed_resident(db_session)

    rsvp = client.post(
        f"{BASE}/events/{event_id}/signup", json={"resident_id": resident_id, "type": "rsvp"}
    )
    volunteer = client.post(
        f"{BASE}/events/{event_id}/signup", json={"resident_id": resident_id, "type": "volunteer"}
    )

    assert rsvp.status_code == 201
    assert volunteer.status_code == 201


def test_list_event_signups(client, db_session):
    event_id = seed_event(db_session)
    r1 = seed_resident(db_session, name="First")
    r2 = seed_resident(db_session, name="Second")
    client.post(f"{BASE}/events/{event_id}/signup", json={"resident_id": r1, "type": "rsvp"})
    client.post(f"{BASE}/events/{event_id}/signup", json={"resident_id": r2, "type": "volunteer"})

    response = client.get(f"{BASE}/events/{event_id}/signups")

    assert response.status_code == 200
    assert len(response.json()) == 2


# ── Event signup — conflicts ──────────────────────────────────────────────────

def test_duplicate_same_type_signup_returns_409(client, db_session):
    event_id = seed_event(db_session)
    resident_id = seed_resident(db_session)
    client.post(f"{BASE}/events/{event_id}/signup", json={"resident_id": resident_id, "type": "rsvp"})

    response = client.post(
        f"{BASE}/events/{event_id}/signup", json={"resident_id": resident_id, "type": "rsvp"}
    )

    assert response.status_code == 409


# ── Event signup — window ─────────────────────────────────────────────────────

def test_signup_on_completed_event_returns_400(client, db_session):
    event_id = seed_event(db_session, status="completed")
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/events/{event_id}/signup", json={"resident_id": resident_id, "type": "rsvp"}
    )

    assert response.status_code == 400
    assert "completed" in response.json()["detail"].lower()


def test_signup_on_cancelled_event_returns_400(client, db_session):
    event_id = seed_event(db_session, status="cancelled")
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/events/{event_id}/signup", json={"resident_id": resident_id, "type": "rsvp"}
    )

    assert response.status_code == 400


def test_signup_on_past_dated_event_returns_400(client, db_session):
    event_id = seed_event(
        db_session, status="upcoming", event_date=datetime.now() - timedelta(days=1)
    )
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/events/{event_id}/signup", json={"resident_id": resident_id, "type": "rsvp"}
    )

    assert response.status_code == 400
    assert "already took place" in response.json()["detail"].lower()


# ── Event signup — not found & validation ─────────────────────────────────────

def test_signup_unknown_event_returns_404(client, db_session):
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/events/does-not-exist/signup", json={"resident_id": resident_id, "type": "rsvp"}
    )

    assert response.status_code == 404


def test_signup_unknown_resident_returns_404(client, db_session):
    event_id = seed_event(db_session)

    response = client.post(
        f"{BASE}/events/{event_id}/signup", json={"resident_id": "does-not-exist", "type": "rsvp"}
    )

    assert response.status_code == 404


def test_list_signups_unknown_event_returns_404(client, db_session):
    response = client.get(f"{BASE}/events/does-not-exist/signups")

    assert response.status_code == 404


def test_signup_invalid_type_returns_422(client, db_session):
    event_id = seed_event(db_session)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/events/{event_id}/signup", json={"resident_id": resident_id, "type": "not_a_type"}
    )

    assert response.status_code == 422
