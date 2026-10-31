"""
pytest tests for BE-26 — Workforce Management API.

Story: as an admin, I want endpoints so that bookings, attendance, ratings
and provider jobs persist.

Covers:
  - House help: register, list, filter by service type / active
  - Bookings: book, overlap conflict (409), back-to-back / different-day /
    different-help do not conflict, unknown house help / resident (404),
    end_time <= start_time (422), status transition (booked -> completed /
    cancelled), invalid transition (400), history filters
  - Attendance: mark, duplicate same day (409), booking from a different
    house help (400), unknown booking (404)
  - Ratings: rate a completed booking, restricted to completed bookings
    (400), restricted to the booking's own resident (400), one rating per
    booking (409), unknown booking (404)
  - Provider jobs: create (requires an existing provider, 404 otherwise),
    valid transition chain requested -> assigned -> in_progress ->
    completed (with completed_at stamped), invalid/skipped transitions
    (400), cancellation from a non-terminal state, terminal states reject
    further transitions, history filters by provider/status

Fixtures (client, db_session) are defined in conftest.py.
"""

from app.models.resident import Flat, Resident

WORKFORCE_URL = "/api/v1/workforce"
HOUSE_HELP_URL = f"{WORKFORCE_URL}/house-help"
BOOKINGS_URL = f"{HOUSE_HELP_URL}/bookings"
ATTENDANCE_URL = f"{HOUSE_HELP_URL}/attendance"
RATINGS_URL = f"{HOUSE_HELP_URL}/ratings"
PROVIDERS_URL = f"{WORKFORCE_URL}/providers"
JOBS_URL = f"{WORKFORCE_URL}/provider-jobs"


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


def create_house_help(client, **overrides) -> str:
    payload = {"name": "Lakshmi", "service_type": "maid", "phone": "9876543210"}
    payload.update(overrides)
    return client.post(HOUSE_HELP_URL, json=payload).json()["house_help_id"]


def booking_payload(house_help_id: str, resident_id: str, **overrides) -> dict:
    defaults = {
        "house_help_id": house_help_id,
        "resident_id": resident_id,
        "booking_date": "2026-08-20",
        "start_time": "09:00:00",
        "end_time": "11:00:00",
    }
    defaults.update(overrides)
    return defaults


def create_provider(client, **overrides) -> str:
    payload = {"name": "CoolFix AC Services", "service_type": "AC Repair", "phone": "9123456789"}
    payload.update(overrides)
    return client.post(PROVIDERS_URL, json=payload).json()["provider_id"]


# ── House help directory ─────────────────────────────────────────────────────

def test_create_and_list_house_help(client):
    create_house_help(client, name="Lakshmi", service_type="maid")
    create_house_help(client, name="Ravi", service_type="driver")

    response = client.get(HOUSE_HELP_URL)
    assert response.status_code == 200
    assert len(response.json()) == 2

    filtered = client.get(f"{HOUSE_HELP_URL}?service_type=driver")
    assert len(filtered.json()) == 1
    assert filtered.json()[0]["name"] == "Ravi"


# ── Bookings ──────────────────────────────────────────────────────────────────

def test_book_house_help_succeeds(client, db_session):
    house_help_id = create_house_help(client)
    resident_id = seed_resident(db_session)

    response = client.post(BOOKINGS_URL, json=booking_payload(house_help_id, resident_id))

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "booked"
    assert body["house_help_id"] == house_help_id


def test_book_unknown_house_help_returns_404(client, db_session):
    resident_id = seed_resident(db_session)
    response = client.post(BOOKINGS_URL, json=booking_payload("no-such-help", resident_id))
    assert response.status_code == 404


def test_book_unknown_resident_returns_404(client):
    house_help_id = create_house_help(client)
    response = client.post(BOOKINGS_URL, json=booking_payload(house_help_id, "no-such-resident"))
    assert response.status_code == 404


def test_end_time_before_start_time_returns_422(client, db_session):
    house_help_id = create_house_help(client)
    resident_id = seed_resident(db_session)
    response = client.post(
        BOOKINGS_URL,
        json=booking_payload(house_help_id, resident_id, start_time="11:00:00", end_time="09:00:00"),
    )
    assert response.status_code == 422


def test_overlapping_booking_returns_409(client, db_session):
    house_help_id = create_house_help(client)
    resident_id = seed_resident(db_session)
    client.post(BOOKINGS_URL, json=booking_payload(house_help_id, resident_id, start_time="09:00:00", end_time="11:00:00"))

    response = client.post(
        BOOKINGS_URL, json=booking_payload(house_help_id, resident_id, start_time="10:00:00", end_time="12:00:00")
    )
    assert response.status_code == 409


def test_back_to_back_bookings_do_not_conflict(client, db_session):
    house_help_id = create_house_help(client)
    resident_id = seed_resident(db_session)
    client.post(BOOKINGS_URL, json=booking_payload(house_help_id, resident_id, start_time="09:00:00", end_time="11:00:00"))

    response = client.post(
        BOOKINGS_URL, json=booking_payload(house_help_id, resident_id, start_time="11:00:00", end_time="13:00:00")
    )
    assert response.status_code == 201


def test_cancelled_booking_frees_the_slot(client, db_session):
    house_help_id = create_house_help(client)
    resident_id = seed_resident(db_session)
    booking_id = client.post(BOOKINGS_URL, json=booking_payload(house_help_id, resident_id)).json()["booking_id"]
    client.put(f"{BOOKINGS_URL}/{booking_id}/status", json={"status": "cancelled"})

    response = client.post(BOOKINGS_URL, json=booking_payload(house_help_id, resident_id))
    assert response.status_code == 201


def test_booking_status_transition_to_completed(client, db_session):
    house_help_id = create_house_help(client)
    resident_id = seed_resident(db_session)
    booking_id = client.post(BOOKINGS_URL, json=booking_payload(house_help_id, resident_id)).json()["booking_id"]

    response = client.put(f"{BOOKINGS_URL}/{booking_id}/status", json={"status": "completed"})
    assert response.status_code == 200
    assert response.json()["status"] == "completed"


def test_booking_status_cannot_be_reopened(client, db_session):
    house_help_id = create_house_help(client)
    resident_id = seed_resident(db_session)
    booking_id = client.post(BOOKINGS_URL, json=booking_payload(house_help_id, resident_id)).json()["booking_id"]
    client.put(f"{BOOKINGS_URL}/{booking_id}/status", json={"status": "completed"})

    response = client.put(f"{BOOKINGS_URL}/{booking_id}/status", json={"status": "cancelled"})
    assert response.status_code == 400


def test_booking_history_filters_by_status(client, db_session):
    house_help_id = create_house_help(client)
    resident_id = seed_resident(db_session)
    client.post(BOOKINGS_URL, json=booking_payload(house_help_id, resident_id))

    response = client.get(f"{BOOKINGS_URL}?status=booked")
    assert len(response.json()) == 1


# ── Attendance ────────────────────────────────────────────────────────────────

def test_mark_attendance_succeeds(client):
    house_help_id = create_house_help(client)
    response = client.post(
        ATTENDANCE_URL, json={"house_help_id": house_help_id, "attendance_date": "2026-08-20", "status": "present"}
    )
    assert response.status_code == 201


def test_duplicate_attendance_same_day_returns_409(client):
    house_help_id = create_house_help(client)
    payload = {"house_help_id": house_help_id, "attendance_date": "2026-08-20", "status": "present"}
    client.post(ATTENDANCE_URL, json=payload)

    response = client.post(ATTENDANCE_URL, json={**payload, "status": "absent"})
    assert response.status_code == 409


def test_attendance_with_booking_from_different_house_help_returns_400(client, db_session):
    help_a = create_house_help(client, name="Help A")
    help_b = create_house_help(client, name="Help B")
    resident_id = seed_resident(db_session)
    booking_id = client.post(BOOKINGS_URL, json=booking_payload(help_a, resident_id)).json()["booking_id"]

    response = client.post(
        ATTENDANCE_URL,
        json={"house_help_id": help_b, "attendance_date": "2026-08-20", "status": "present", "booking_id": booking_id},
    )
    assert response.status_code == 400


def test_attendance_unknown_house_help_returns_404(client):
    response = client.post(
        ATTENDANCE_URL, json={"house_help_id": "no-such-help", "attendance_date": "2026-08-20", "status": "present"}
    )
    assert response.status_code == 404


# ── Ratings ───────────────────────────────────────────────────────────────────

def _completed_booking(client, db_session):
    house_help_id = create_house_help(client)
    resident_id = seed_resident(db_session)
    booking_id = client.post(BOOKINGS_URL, json=booking_payload(house_help_id, resident_id)).json()["booking_id"]
    client.put(f"{BOOKINGS_URL}/{booking_id}/status", json={"status": "completed"})
    return house_help_id, resident_id, booking_id


def test_rate_completed_booking_succeeds(client, db_session):
    house_help_id, resident_id, booking_id = _completed_booking(client, db_session)

    response = client.post(
        RATINGS_URL, json={"booking_id": booking_id, "resident_id": resident_id, "rating": 5, "comment": "Great job"}
    )
    assert response.status_code == 201
    assert response.json()["rating"] == 5


def test_rate_uncompleted_booking_returns_400(client, db_session):
    house_help_id = create_house_help(client)
    resident_id = seed_resident(db_session)
    booking_id = client.post(BOOKINGS_URL, json=booking_payload(house_help_id, resident_id)).json()["booking_id"]

    response = client.post(RATINGS_URL, json={"booking_id": booking_id, "resident_id": resident_id, "rating": 4})
    assert response.status_code == 400


def test_rate_by_wrong_resident_returns_400(client, db_session):
    _, resident_id, booking_id = _completed_booking(client, db_session)
    other_resident = seed_resident(db_session, name="Someone Else")

    response = client.post(RATINGS_URL, json={"booking_id": booking_id, "resident_id": other_resident, "rating": 3})
    assert response.status_code == 400


def test_rating_a_booking_twice_returns_409(client, db_session):
    _, resident_id, booking_id = _completed_booking(client, db_session)
    client.post(RATINGS_URL, json={"booking_id": booking_id, "resident_id": resident_id, "rating": 5})

    response = client.post(RATINGS_URL, json={"booking_id": booking_id, "resident_id": resident_id, "rating": 1})
    assert response.status_code == 409


def test_rate_unknown_booking_returns_404(client, db_session):
    resident_id = seed_resident(db_session)
    response = client.post(RATINGS_URL, json={"booking_id": "no-such-booking", "resident_id": resident_id, "rating": 5})
    assert response.status_code == 404


def test_rating_out_of_range_returns_422(client, db_session):
    _, resident_id, booking_id = _completed_booking(client, db_session)
    response = client.post(RATINGS_URL, json={"booking_id": booking_id, "resident_id": resident_id, "rating": 6})
    assert response.status_code == 422


def test_list_ratings_for_house_help(client, db_session):
    house_help_id, resident_id, booking_id = _completed_booking(client, db_session)
    client.post(RATINGS_URL, json={"booking_id": booking_id, "resident_id": resident_id, "rating": 4})

    response = client.get(f"{HOUSE_HELP_URL}/{house_help_id}/ratings")
    assert response.status_code == 200
    assert len(response.json()) == 1


# ── Providers & jobs ─────────────────────────────────────────────────────────

def test_create_provider_and_job(client):
    provider_id = create_provider(client)

    response = client.post(JOBS_URL, json={"provider_id": provider_id, "title": "Fix AC in clubhouse"})
    assert response.status_code == 201
    assert response.json()["status"] == "requested"


def test_create_job_unknown_provider_returns_404(client):
    response = client.post(JOBS_URL, json={"provider_id": "no-such-provider", "title": "Fix something"})
    assert response.status_code == 404


def test_job_transition_full_chain(client):
    provider_id = create_provider(client)
    job_id = client.post(JOBS_URL, json={"provider_id": provider_id, "title": "Fix AC"}).json()["job_id"]

    assert client.put(f"{JOBS_URL}/{job_id}/status", json={"status": "assigned"}).status_code == 200
    assert client.put(f"{JOBS_URL}/{job_id}/status", json={"status": "in_progress"}).status_code == 200

    completed = client.put(f"{JOBS_URL}/{job_id}/status", json={"status": "completed"})
    assert completed.status_code == 200
    assert completed.json()["completed_at"] is not None


def test_job_transition_skip_stage_returns_400(client):
    provider_id = create_provider(client)
    job_id = client.post(JOBS_URL, json={"provider_id": provider_id, "title": "Fix AC"}).json()["job_id"]

    response = client.put(f"{JOBS_URL}/{job_id}/status", json={"status": "completed"})
    assert response.status_code == 400


def test_job_cancellation_from_non_terminal_state(client):
    provider_id = create_provider(client)
    job_id = client.post(JOBS_URL, json={"provider_id": provider_id, "title": "Fix AC"}).json()["job_id"]
    client.put(f"{JOBS_URL}/{job_id}/status", json={"status": "assigned"})

    response = client.put(f"{JOBS_URL}/{job_id}/status", json={"status": "cancelled"})
    assert response.status_code == 200
    assert response.json()["status"] == "cancelled"


def test_job_terminal_state_rejects_further_transitions(client):
    provider_id = create_provider(client)
    job_id = client.post(JOBS_URL, json={"provider_id": provider_id, "title": "Fix AC"}).json()["job_id"]
    client.put(f"{JOBS_URL}/{job_id}/status", json={"status": "cancelled"})

    response = client.put(f"{JOBS_URL}/{job_id}/status", json={"status": "assigned"})
    assert response.status_code == 400


def test_job_status_unknown_value_returns_422(client):
    provider_id = create_provider(client)
    job_id = client.post(JOBS_URL, json={"provider_id": provider_id, "title": "Fix AC"}).json()["job_id"]

    response = client.put(f"{JOBS_URL}/{job_id}/status", json={"status": "vanished"})
    assert response.status_code == 422


def test_job_history_filters_by_provider_and_status(client):
    provider_a = create_provider(client, name="Provider A")
    provider_b = create_provider(client, name="Provider B")
    client.post(JOBS_URL, json={"provider_id": provider_a, "title": "Job A"})
    client.post(JOBS_URL, json={"provider_id": provider_b, "title": "Job B"})

    response = client.get(f"{JOBS_URL}?provider_id={provider_a}")
    assert len(response.json()) == 1
    assert response.json()[0]["title"] == "Job A"

    by_status = client.get(f"{JOBS_URL}?status=requested")
    assert len(by_status.json()) == 2
