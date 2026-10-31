"""
pytest tests for BE-01 — Complaint Submission API.

Story: as a resident, I want to submit a complaint with a category,
description, location and an optional image, so that the management
committee has a durable record of the problem.

Covers:
  - POST /complaints returns 201 with a generated complaint_id and every
    submitted field persisted, status defaults to "submitted"
  - image_reference is optional
  - Invalid category / missing required fields return 400 per BE-01's
    contract (not the default 422)

Fixtures (client, db_session) are defined in conftest.py.
"""

from uuid import UUID

from app.models.complaint import Complaint

COMPLAINTS_URL = "/api/v1/complaints"


def complaint_payload(**overrides) -> dict:
    defaults = {
        "category": "Plumbing",
        "description": "Kitchen tap is leaking continuously.",
        "location": "A-101 kitchen",
        "image_reference": "complaints/leaking-tap.jpg",
        "raised_by": "resident-001",
    }
    defaults.update(overrides)
    return defaults


def test_submit_complaint_returns_201_and_persists(client, db_session):
    response = client.post(COMPLAINTS_URL, json=complaint_payload())

    assert response.status_code == 201
    body = response.json()
    UUID(body["complaint_id"])
    assert body["status"] == "submitted"
    assert body["category"] == "Plumbing"
    assert body["image_reference"] == "complaints/leaking-tap.jpg"

    stored = db_session.get(Complaint, body["complaint_id"])
    assert stored is not None
    assert stored.description == "Kitchen tap is leaking continuously."
    assert stored.location == "A-101 kitchen"
    assert stored.raised_by == "resident-001"


def test_image_reference_is_optional(client):
    payload = complaint_payload()
    del payload["image_reference"]

    response = client.post(COMPLAINTS_URL, json=payload)

    assert response.status_code == 201
    assert response.json()["image_reference"] is None


def test_raised_by_is_optional(client):
    payload = complaint_payload()
    del payload["raised_by"]

    response = client.post(COMPLAINTS_URL, json=payload)

    assert response.status_code == 201
    assert response.json()["raised_by"] is None


def test_invalid_category_returns_400(client):
    response = client.post(COMPLAINTS_URL, json=complaint_payload(category="General"))
    assert response.status_code == 400


def test_missing_description_returns_400(client):
    payload = complaint_payload()
    del payload["description"]

    response = client.post(COMPLAINTS_URL, json=payload)
    assert response.status_code == 400


def test_missing_location_returns_400(client):
    payload = complaint_payload()
    del payload["location"]

    response = client.post(COMPLAINTS_URL, json=payload)
    assert response.status_code == 400


def test_new_complaint_starts_with_no_assignment(client):
    body = client.post(COMPLAINTS_URL, json=complaint_payload()).json()
    assert body["assigned_to"] is None
    assert body["assigned_at"] is None
    assert body["progress_logs"] == []


# ── INT-01: a reference a resident can actually read and quote ───────────────

def test_a_complaint_gets_a_readable_reference(client):
    resp = client.post("/api/v1/complaints", json={
        "category": "Plumbing", "description": "Tap drips", "location": "A-101"})

    assert resp.status_code == 201
    reference = resp.json()["reference"]
    assert reference.startswith("CMP-")
    assert reference.endswith("0001")


def test_references_run_in_sequence(client):
    def raise_one():
        return client.post("/api/v1/complaints", json={
            "category": "Plumbing", "description": "Tap drips", "location": "A-101"}).json()["reference"]

    first, second, third = raise_one(), raise_one(), raise_one()

    assert [first[-4:], second[-4:], third[-4:]] == ["0001", "0002", "0003"]


def test_the_reference_is_unique_per_complaint(client):
    made = {client.post("/api/v1/complaints", json={
        "category": "Security", "description": "Gate light out", "location": "Gate 1"}
    ).json()["reference"] for _ in range(5)}

    assert len(made) == 5
