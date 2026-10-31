"""
pytest tests for BE-10 — Resident Complaint History API.

Story: as a resident, I want to see every complaint I have ever raised, so
that I have a complete record of my requests.

Covers:
  - GET /residents/{id}/complaints returns the full history, newest first
  - Resolved and closed complaints remain visible (history is not filtered
    down to "active" complaints)
  - A resident with no complaints gets an empty list, not a 404
  - Complaints raised by other residents are excluded

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import datetime, timedelta

from app.models.complaint import Complaint
from app.models.resident import Flat, Resident


def history_url(resident_id: str) -> str:
    return f"/api/v1/residents/{resident_id}/complaints"


def seed_resident(db_session, name="Resident One") -> str:
    flat = Flat(block="A", flat_number="101")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)

    resident = Resident(name=name, flat_id=flat.flat_id, phone="9999999999")
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def seed_complaint(db_session, resident_id, **overrides) -> str:
    now = datetime.now()
    defaults = {
        "category": "Security",
        "description": "Test complaint",
        "location": "A-101",
        "raised_by": resident_id,
        "status": "submitted",
        "created_at": now,
        "updated_at": now,
    }
    defaults.update(overrides)
    complaint = Complaint(**defaults)
    db_session.add(complaint)
    db_session.commit()
    db_session.refresh(complaint)
    return complaint.complaint_id


def test_history_returns_full_records_newest_first(client, db_session):
    resident_id = seed_resident(db_session)
    now = datetime.now()
    old_id = seed_complaint(
        db_session,
        resident_id,
        description="Older complaint",
        status="resolved",
        created_at=now - timedelta(days=2),
    )
    new_id = seed_complaint(
        db_session,
        resident_id,
        description="Newer complaint",
        status="closed",
        image_reference="complaints/history.jpg",
        created_at=now,
    )

    response = client.get(history_url(resident_id))

    assert response.status_code == 200
    history = response.json()
    assert [item["complaint_id"] for item in history] == [new_id, old_id]
    assert history[0]["image_reference"] == "complaints/history.jpg"
    assert history[0]["status"] == "closed"
    assert history[1]["status"] == "resolved"
    assert "created_at" in history[0]


def test_resident_with_no_complaints_returns_empty_list(client, db_session):
    resident_id = seed_resident(db_session)
    response = client.get(history_url(resident_id))

    assert response.status_code == 200
    assert response.json() == []


def test_history_excludes_other_residents_complaints(client, db_session):
    resident_a = seed_resident(db_session, name="Resident A")
    resident_b = seed_resident(db_session, name="Resident B")
    seed_complaint(db_session, resident_a, description="A's complaint")
    seed_complaint(db_session, resident_b, description="B's complaint")

    response = client.get(history_url(resident_a))

    assert len(response.json()) == 1
    assert response.json()[0]["description"] == "A's complaint"
