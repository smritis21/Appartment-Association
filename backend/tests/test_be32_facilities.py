"""
pytest tests for BE-32 — Community Facilities booking API.

Covers:
  - Creating and listing facilities (with status filter)
  - Slot availability: available / booked / past states + spots_remaining
  - Booking a slot (success), shared-capacity fill, and single-capacity court
  - Slot conflict / capacity enforcement (409 once full)
  - Duplicate booking by the same resident (409)
  - Cancelling a booking, freeing the slot, and double-cancel (409)
  - Inactive facility rejection (400)
  - Not-found paths (404) for facility, resident and booking
  - Validation paths (422) for unknown slot and past date

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import date, datetime, timedelta, timezone

from app.models.facility import Facility, FacilityBooking
from app.models.resident import Flat, Resident

BASE = "/api/v1/facilities"

# A safe future date so bookings never trip the past-date validator.
FUTURE_DATE = (datetime.now(timezone.utc).replace(tzinfo=None).date() + timedelta(days=3)).isoformat()
SLOT = "18:00 - 19:00"


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_resident(db_session, **overrides) -> str:
    flat = Flat(
        block="A", floor="1", flat_number="101",
        ownership_type="owned", occupancy_status="occupied",
    )
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


def seed_facility(db_session, **overrides) -> str:
    defaults = {
        "name": "Gymnasium",
        "location": "Clubhouse",
        "capacity": 4,
        "status": "active",
    }
    defaults.update(overrides)
    facility = Facility(**defaults)
    db_session.add(facility)
    db_session.commit()
    db_session.refresh(facility)
    return facility.facility_id


def seed_booking(db_session, facility_id, resident_id, booking_date, slot, status="confirmed") -> str:
    booking = FacilityBooking(
        facility_id=facility_id,
        resident_id=resident_id,
        booking_date=date.fromisoformat(booking_date),
        slot=slot,
        status=status,
    )
    db_session.add(booking)
    db_session.commit()
    db_session.refresh(booking)
    return booking.booking_id


# ── Facility create / list ────────────────────────────────────────────────────

def test_create_facility_returns_201(client, db_session):
    response = client.post(
        BASE,
        json={"name": "Swimming Pool", "location": "Rear Deck", "capacity": 6},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Swimming Pool"
    assert body["capacity"] == 6
    assert body["status"] == "active"


def test_list_facilities_filters_by_status(client, db_session):
    seed_facility(db_session, name="Active Gym", status="active")
    seed_facility(db_session, name="Closed Court", status="inactive")

    response = client.get(f"{BASE}?status=inactive")

    assert response.status_code == 200
    names = [f["name"] for f in response.json()]
    assert names == ["Closed Court"]


# ── Availability ──────────────────────────────────────────────────────────────

def test_availability_lists_all_slots_available_by_default(client, db_session):
    facility_id = seed_facility(db_session, capacity=4)

    response = client.get(f"{BASE}/{facility_id}/availability?date={FUTURE_DATE}")

    assert response.status_code == 200
    body = response.json()
    assert body["facility_id"] == facility_id
    assert body["capacity"] == 4
    assert len(body["slots"]) == 6
    assert all(s["state"] == "available" for s in body["slots"])
    assert all(s["spots_remaining"] == 4 for s in body["slots"])


def test_availability_reflects_confirmed_bookings(client, db_session):
    facility_id = seed_facility(db_session, capacity=4)
    seed_booking(db_session, facility_id, seed_resident(db_session), FUTURE_DATE, SLOT)

    response = client.get(f"{BASE}/{facility_id}/availability?date={FUTURE_DATE}")

    slot = next(s for s in response.json()["slots"] if s["slot"] == SLOT)
    assert slot["booked"] == 1
    assert slot["spots_remaining"] == 3
    assert slot["state"] == "available"


def test_availability_marks_full_slot_as_booked(client, db_session):
    facility_id = seed_facility(db_session, capacity=1)
    seed_booking(db_session, facility_id, seed_resident(db_session), FUTURE_DATE, SLOT)

    response = client.get(f"{BASE}/{facility_id}/availability?date={FUTURE_DATE}")

    slot = next(s for s in response.json()["slots"] if s["slot"] == SLOT)
    assert slot["state"] == "booked"
    assert slot["spots_remaining"] == 0


def test_availability_marks_yesterday_slots_as_past(client, db_session):
    facility_id = seed_facility(db_session)
    yesterday = (datetime.now(timezone.utc).replace(tzinfo=None).date() - timedelta(days=1)).isoformat()

    response = client.get(f"{BASE}/{facility_id}/availability?date={yesterday}")

    assert response.status_code == 200
    assert all(s["state"] == "past" for s in response.json()["slots"])


def test_cancelled_booking_frees_slot_in_availability(client, db_session):
    facility_id = seed_facility(db_session, capacity=1)
    seed_booking(
        db_session, facility_id, seed_resident(db_session), FUTURE_DATE, SLOT,
        status="cancelled",
    )

    response = client.get(f"{BASE}/{facility_id}/availability?date={FUTURE_DATE}")

    slot = next(s for s in response.json()["slots"] if s["slot"] == SLOT)
    assert slot["booked"] == 0
    assert slot["state"] == "available"


# ── Booking success ───────────────────────────────────────────────────────────

def test_book_slot_returns_201(client, db_session):
    facility_id = seed_facility(db_session)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{facility_id}/bookings",
        json={"resident_id": resident_id, "booking_date": FUTURE_DATE, "slot": SLOT},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["facility_id"] == facility_id
    assert body["resident_id"] == resident_id
    assert body["slot"] == SLOT
    assert body["status"] == "confirmed"


def test_shared_capacity_allows_multiple_residents_same_slot(client, db_session):
    facility_id = seed_facility(db_session, capacity=3)

    for _ in range(3):
        resident_id = seed_resident(db_session)
        response = client.post(
            f"{BASE}/{facility_id}/bookings",
            json={"resident_id": resident_id, "booking_date": FUTURE_DATE, "slot": SLOT},
        )
        assert response.status_code == 201


def test_book_last_remaining_spot_succeeds(client, db_session):
    facility_id = seed_facility(db_session, capacity=1)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{facility_id}/bookings",
        json={"resident_id": resident_id, "booking_date": FUTURE_DATE, "slot": SLOT},
    )

    assert response.status_code == 201


# ── Conflict / capacity ───────────────────────────────────────────────────────

def test_book_full_slot_returns_409(client, db_session):
    facility_id = seed_facility(db_session, capacity=1)
    seed_booking(db_session, facility_id, seed_resident(db_session), FUTURE_DATE, SLOT)
    late_resident = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{facility_id}/bookings",
        json={"resident_id": late_resident, "booking_date": FUTURE_DATE, "slot": SLOT},
    )

    assert response.status_code == 409
    assert "full" in response.json()["detail"].lower()


def test_other_slots_still_bookable_when_one_is_full(client, db_session):
    facility_id = seed_facility(db_session, capacity=1)
    seed_booking(db_session, facility_id, seed_resident(db_session), FUTURE_DATE, SLOT)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{facility_id}/bookings",
        json={
            "resident_id": resident_id,
            "booking_date": FUTURE_DATE,
            "slot": "19:00 - 20:00",
        },
    )

    assert response.status_code == 201


def test_duplicate_booking_by_same_resident_returns_409(client, db_session):
    facility_id = seed_facility(db_session, capacity=4)
    resident_id = seed_resident(db_session)
    seed_booking(db_session, facility_id, resident_id, FUTURE_DATE, SLOT)

    response = client.post(
        f"{BASE}/{facility_id}/bookings",
        json={"resident_id": resident_id, "booking_date": FUTURE_DATE, "slot": SLOT},
    )

    assert response.status_code == 409
    assert "already" in response.json()["detail"].lower()


# ── Cancel ────────────────────────────────────────────────────────────────────

def test_cancel_booking_returns_200_and_cancelled_status(client, db_session):
    facility_id = seed_facility(db_session)
    booking_id = seed_booking(
        db_session, facility_id, seed_resident(db_session), FUTURE_DATE, SLOT
    )

    response = client.post(f"{BASE}/bookings/{booking_id}/cancel")

    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_cancel_frees_slot_for_rebooking(client, db_session):
    facility_id = seed_facility(db_session, capacity=1)
    first_resident = seed_resident(db_session)
    booking_id = seed_booking(db_session, facility_id, first_resident, FUTURE_DATE, SLOT)

    client.post(f"{BASE}/bookings/{booking_id}/cancel")

    new_resident = seed_resident(db_session)
    response = client.post(
        f"{BASE}/{facility_id}/bookings",
        json={"resident_id": new_resident, "booking_date": FUTURE_DATE, "slot": SLOT},
    )

    assert response.status_code == 201


def test_cancel_already_cancelled_returns_409(client, db_session):
    facility_id = seed_facility(db_session)
    booking_id = seed_booking(
        db_session, facility_id, seed_resident(db_session), FUTURE_DATE, SLOT,
        status="cancelled",
    )

    response = client.post(f"{BASE}/bookings/{booking_id}/cancel")

    assert response.status_code == 409
    assert "already cancelled" in response.json()["detail"].lower()


# ── Listing bookings ──────────────────────────────────────────────────────────

def test_list_bookings_filters_by_resident(client, db_session):
    facility_id = seed_facility(db_session, capacity=4)
    r1 = seed_resident(db_session, name="A")
    r2 = seed_resident(db_session, name="B")
    seed_booking(db_session, facility_id, r1, FUTURE_DATE, "17:00 - 18:00")
    seed_booking(db_session, facility_id, r2, FUTURE_DATE, "18:00 - 19:00")

    response = client.get(f"{BASE}/{facility_id}/bookings?resident_id={r1}")

    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["resident_id"] == r1


# ── Inactive facility ─────────────────────────────────────────────────────────

def test_book_inactive_facility_returns_400(client, db_session):
    facility_id = seed_facility(db_session, status="inactive")
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{facility_id}/bookings",
        json={"resident_id": resident_id, "booking_date": FUTURE_DATE, "slot": SLOT},
    )

    assert response.status_code == 400
    assert "inactive" in response.json()["detail"].lower()


# ── Not found ─────────────────────────────────────────────────────────────────

def test_get_unknown_facility_returns_404(client, db_session):
    response = client.get(f"{BASE}/does-not-exist")

    assert response.status_code == 404


def test_availability_unknown_facility_returns_404(client, db_session):
    response = client.get(f"{BASE}/does-not-exist/availability?date={FUTURE_DATE}")

    assert response.status_code == 404


def test_book_unknown_facility_returns_404(client, db_session):
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/does-not-exist/bookings",
        json={"resident_id": resident_id, "booking_date": FUTURE_DATE, "slot": SLOT},
    )

    assert response.status_code == 404
    assert "facility" in response.json()["detail"].lower()


def test_book_unknown_resident_returns_404(client, db_session):
    facility_id = seed_facility(db_session)

    response = client.post(
        f"{BASE}/{facility_id}/bookings",
        json={"resident_id": "does-not-exist", "booking_date": FUTURE_DATE, "slot": SLOT},
    )

    assert response.status_code == 404
    assert "resident" in response.json()["detail"].lower()


def test_cancel_unknown_booking_returns_404(client, db_session):
    response = client.post(f"{BASE}/bookings/does-not-exist/cancel")

    assert response.status_code == 404


# ── Validation ────────────────────────────────────────────────────────────────

def test_book_unknown_slot_returns_422(client, db_session):
    facility_id = seed_facility(db_session)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{facility_id}/bookings",
        json={"resident_id": resident_id, "booking_date": FUTURE_DATE, "slot": "23:00 - 00:00"},
    )

    assert response.status_code == 422


def test_book_past_date_returns_422(client, db_session):
    facility_id = seed_facility(db_session)
    resident_id = seed_resident(db_session)
    past = (datetime.now(timezone.utc).replace(tzinfo=None).date() - timedelta(days=1)).isoformat()

    response = client.post(
        f"{BASE}/{facility_id}/bookings",
        json={"resident_id": resident_id, "booking_date": past, "slot": SLOT},
    )

    assert response.status_code == 422


def test_book_missing_slot_returns_422(client, db_session):
    facility_id = seed_facility(db_session)
    resident_id = seed_resident(db_session)

    response = client.post(
        f"{BASE}/{facility_id}/bookings",
        json={"resident_id": resident_id, "booking_date": FUTURE_DATE},
    )

    assert response.status_code == 422


def test_create_facility_missing_name_returns_422(client, db_session):
    response = client.post(BASE, json={"capacity": 4})

    assert response.status_code == 422


# ── INT-37: a booking is one of the modules that raises a notification ────────

def _notifications(client, resident_id):
    resp = client.get("/api/v1/notifications", params={"resident_id": resident_id})
    assert resp.status_code == 200
    return resp.json()


def test_booking_a_facility_notifies_the_resident(client, db_session):
    resident_id = seed_resident(db_session)
    facility_id = seed_facility(db_session)
    assert _notifications(client, resident_id)["unread_count"] == 0

    resp = client.post(
        f"{BASE}/{facility_id}/bookings",
        json={"resident_id": resident_id, "booking_date": FUTURE_DATE, "slot": SLOT},
    )
    assert resp.status_code == 201

    data = _notifications(client, resident_id)
    assert data["unread_count"] == 1
    notif = data["notifications"][0]
    assert notif["source_module"] == "facilities"
    assert notif["title"] == "Booking confirmed"


def test_a_rejected_booking_raises_no_notification(client, db_session):
    """Nothing was booked, so there is nothing to tell the resident."""
    resident_id = seed_resident(db_session)
    facility_id = seed_facility(db_session, capacity=1)
    client.post(f"{BASE}/{facility_id}/bookings",
                json={"resident_id": resident_id, "booking_date": FUTURE_DATE, "slot": SLOT})

    clash = client.post(f"{BASE}/{facility_id}/bookings",
                        json={"resident_id": resident_id, "booking_date": FUTURE_DATE, "slot": SLOT})

    assert clash.status_code == 409
    assert _notifications(client, resident_id)["unread_count"] == 1
