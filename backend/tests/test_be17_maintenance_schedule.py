"""
pytest tests for BE-17 — Maintenance Scheduling API.

Covers:
  - Create stores date, time and affected facilities correctly
  - Data persists in the database (queried directly — affected_facilities
    is stored as JSON text, so this also checks the encode/decode round-trip)
  - List returns created events, sorted soonest-first
  - Get-by-id success and 404 for an unknown schedule
  - Validation: missing required fields, empty facilities list

Fixtures (client, db_session) are defined in conftest.py.
"""

import json

from app.models.maintenance import MaintenanceSchedule


def schedule_payload(**overrides) -> dict:
    payload = {
        "title": "Elevator servicing",
        "scheduled_date": "2026-09-15",
        "scheduled_time": "10:00:00",
        "affected_facilities": ["Elevator A", "Elevator B"],
        "notes": "Annual maintenance contract",
        "scheduled_by": "manager-1",
    }
    payload.update(overrides)
    return payload


# ── Create ────────────────────────────────────────────────────────────────────

def test_create_schedule_success(client, db_session):
    response = client.post("/api/v1/maintenance/schedule", json=schedule_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Elevator servicing"
    assert body["scheduled_date"] == "2026-09-15"
    assert body["scheduled_time"] == "10:00:00"
    assert body["affected_facilities"] == ["Elevator A", "Elevator B"]
    assert body["notes"] == "Annual maintenance contract"
    assert body["scheduled_by"] == "manager-1"
    assert "schedule_id" in body


def test_create_schedule_persists_in_db(client, db_session):
    response = client.post("/api/v1/maintenance/schedule", json=schedule_payload(title="Persisted test"))
    schedule_id = response.json()["schedule_id"]

    row = (
        db_session.query(MaintenanceSchedule)
        .filter(MaintenanceSchedule.schedule_id == schedule_id)
        .first()
    )
    assert row is not None
    assert row.title == "Persisted test"
    # stored as JSON text at the DB layer — confirm the round-trip is correct
    assert json.loads(row.affected_facilities) == ["Elevator A", "Elevator B"]


def test_create_schedule_without_optional_fields_succeeds(client, db_session):
    payload = schedule_payload()
    del payload["notes"]
    del payload["scheduled_by"]

    response = client.post("/api/v1/maintenance/schedule", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["notes"] is None
    assert body["scheduled_by"] is None


# ── List ──────────────────────────────────────────────────────────────────────

def test_list_schedules_empty(client, db_session):
    response = client.get("/api/v1/maintenance/schedule")

    assert response.status_code == 200
    assert response.json() == []


def test_list_schedules_returns_created(client, db_session):
    client.post("/api/v1/maintenance/schedule", json=schedule_payload(title="Event A"))
    client.post("/api/v1/maintenance/schedule", json=schedule_payload(title="Event B", scheduled_date="2026-09-20"))

    response = client.get("/api/v1/maintenance/schedule")

    assert response.status_code == 200
    titles = {row["title"] for row in response.json()}
    assert titles == {"Event A", "Event B"}


def test_list_schedules_sorted_soonest_first(client, db_session):
    client.post("/api/v1/maintenance/schedule", json=schedule_payload(title="Later", scheduled_date="2026-12-01"))
    client.post("/api/v1/maintenance/schedule", json=schedule_payload(title="Sooner", scheduled_date="2026-09-01"))
    client.post("/api/v1/maintenance/schedule", json=schedule_payload(title="Middle", scheduled_date="2026-10-15"))

    response = client.get("/api/v1/maintenance/schedule")

    titles = [row["title"] for row in response.json()]
    assert titles == ["Sooner", "Middle", "Later"]


# ── Get by id ─────────────────────────────────────────────────────────────────

def test_get_schedule_by_id_success(client, db_session):
    created = client.post("/api/v1/maintenance/schedule", json=schedule_payload()).json()

    response = client.get(f"/api/v1/maintenance/schedule/{created['schedule_id']}")

    assert response.status_code == 200
    assert response.json()["title"] == "Elevator servicing"


def test_get_schedule_unknown_returns_404(client, db_session):
    response = client.get("/api/v1/maintenance/schedule/does-not-exist")

    assert response.status_code == 404


# ── Validation ────────────────────────────────────────────────────────────────

def test_create_schedule_missing_title_returns_422(client, db_session):
    payload = schedule_payload()
    del payload["title"]

    response = client.post("/api/v1/maintenance/schedule", json=payload)

    assert response.status_code == 422


def test_create_schedule_empty_facilities_returns_422(client, db_session):
    response = client.post(
        "/api/v1/maintenance/schedule", json=schedule_payload(affected_facilities=[])
    )

    assert response.status_code == 422


def test_create_schedule_invalid_date_returns_422(client, db_session):
    response = client.post(
        "/api/v1/maintenance/schedule", json=schedule_payload(scheduled_date="not-a-date")
    )

    assert response.status_code == 422


def test_create_schedule_invalid_time_returns_422(client, db_session):
    response = client.post(
        "/api/v1/maintenance/schedule", json=schedule_payload(scheduled_time="not-a-time")
    )

    assert response.status_code == 422
