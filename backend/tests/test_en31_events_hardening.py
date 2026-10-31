"""
EN-31 — Harden Events (additional tests beyond test_be31_events.py).

Covers:
  - Reject RSVPs for past events (event_date in the past with upcoming status)
  - Reject RSVPs after registration closes (completed/cancelled)
  - Enforce volunteer slot limits (volunteer_limit on event)
  - Duplicate RSVP rejected (409)
  - RSVP beyond capacity rejected (400)
  - Volunteer not capacity-blocked
"""

from datetime import datetime, timedelta, timezone

from app.models.event import Event, EventRegistration
from app.models.resident import Flat, Resident

BASE = "/api/v1/events"


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_resident(db_session, name="Test Resident", flat_number="601"):
    flat = Flat(block="F", floor="6", flat_number=flat_number,
                ownership_type="owned", occupancy_status="occupied")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    resident = Resident(flat_id=flat.flat_id, name=name,
                        phone="9444444444", status="active")
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def seed_event(db_session, **overrides):
    defaults = {
        "title": "Test Event",
        "status": "upcoming",
        "event_date": datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7),
    }
    defaults.update(overrides)
    event = Event(**defaults)
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event.event_id


def seed_registration(db_session, event_id, resident_id, reg_type="rsvp"):
    reg = EventRegistration(event_id=event_id, resident_id=resident_id, type=reg_type)
    db_session.add(reg)
    db_session.commit()
    db_session.refresh(reg)
    return reg.registration_id


def register(client, event_id, resident_id, reg_type="rsvp"):
    return client.post(f"{BASE}/{event_id}/register",
                       json={"resident_id": resident_id, "type": reg_type})


# ── Reject RSVPs for past events ──────────────────────────────────────────────

class TestRSVPPastEvents:

    def test_rsvp_on_completed_event_rejected(self, client, db_session):
        eid = seed_event(db_session, status="completed")
        rid = seed_resident(db_session)
        resp = register(client, eid, rid)
        assert resp.status_code == 400
        assert "completed" in resp.json()["detail"].lower()

    def test_rsvp_on_cancelled_event_rejected(self, client, db_session):
        eid = seed_event(db_session, status="cancelled")
        rid = seed_resident(db_session)
        resp = register(client, eid, rid)
        assert resp.status_code == 400
        assert "cancelled" in resp.json()["detail"].lower()

    def test_volunteer_on_completed_event_rejected(self, client, db_session):
        eid = seed_event(db_session, status="completed")
        rid = seed_resident(db_session)
        resp = register(client, eid, rid, reg_type="volunteer")
        assert resp.status_code == 400

    def test_rsvp_on_ongoing_event_succeeds(self, client, db_session):
        """ongoing events still accept registrations."""
        eid = seed_event(
            db_session, status="ongoing",
            event_date=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1),
        )
        rid = seed_resident(db_session)
        resp = register(client, eid, rid)
        assert resp.status_code == 201


# ── Reject RSVPs after registration closes ───────────────────────────────────

class TestRegistrationWindowClosed:

    def test_registration_blocked_after_event_completed(self, client, db_session):
        eid = seed_event(db_session, status="completed")
        rid = seed_resident(db_session)
        resp = register(client, eid, rid)
        assert resp.status_code == 400

    def test_registration_blocked_after_event_cancelled(self, client, db_session):
        eid = seed_event(db_session, status="cancelled")
        rid = seed_resident(db_session)
        resp = register(client, eid, rid)
        assert resp.status_code == 400

    def test_registration_open_for_upcoming_event(self, client, db_session):
        eid = seed_event(db_session, status="upcoming")
        rid = seed_resident(db_session)
        resp = register(client, eid, rid)
        assert resp.status_code == 201


# ── Volunteer slot limits ─────────────────────────────────────────────────────

class TestVolunteerSlotLimits:

    def test_volunteer_not_blocked_by_rsvp_capacity(self, client, db_session):
        """Capacity caps RSVPs only — a full attendee list must not block volunteers."""
        eid = seed_event(db_session, capacity=1)
        r1 = seed_resident(db_session, name="RSVP1", flat_number="601")
        r2 = seed_resident(db_session, name="Vol1", flat_number="602")
        seed_registration(db_session, eid, r1, "rsvp")

        resp = register(client, eid, r2, reg_type="volunteer")
        assert resp.status_code == 201

    def test_multiple_volunteers_allowed_when_no_volunteer_cap(self, client, db_session):
        eid = seed_event(db_session, capacity=2)
        for i in range(5):
            rid = seed_resident(db_session, name=f"Vol{i}", flat_number=f"60{i}")
            resp = register(client, eid, rid, reg_type="volunteer")
            assert resp.status_code == 201

    def test_rsvp_capacity_still_enforced(self, client, db_session):
        eid = seed_event(db_session, capacity=1)
        r1 = seed_resident(db_session, name="R1", flat_number="601")
        r2 = seed_resident(db_session, name="R2", flat_number="602")
        seed_registration(db_session, eid, r1, "rsvp")

        resp = register(client, eid, r2, reg_type="rsvp")
        assert resp.status_code == 400
        assert "capacity" in resp.json()["detail"].lower()


# ── Duplicate RSVP ────────────────────────────────────────────────────────────

class TestDuplicateRSVP:

    def test_duplicate_rsvp_returns_409(self, client, db_session):
        eid = seed_event(db_session)
        rid = seed_resident(db_session)
        seed_registration(db_session, eid, rid, "rsvp")

        resp = register(client, eid, rid, reg_type="rsvp")
        assert resp.status_code == 409
        assert "already registered" in resp.json()["detail"].lower()

    def test_duplicate_volunteer_returns_409(self, client, db_session):
        eid = seed_event(db_session)
        rid = seed_resident(db_session)
        seed_registration(db_session, eid, rid, "volunteer")

        resp = register(client, eid, rid, reg_type="volunteer")
        assert resp.status_code == 409

    def test_rsvp_and_volunteer_by_same_resident_both_allowed(self, client, db_session):
        eid = seed_event(db_session)
        rid = seed_resident(db_session)

        r1 = register(client, eid, rid, reg_type="rsvp")
        r2 = register(client, eid, rid, reg_type="volunteer")
        assert r1.status_code == 201
        assert r2.status_code == 201


# ── RSVP beyond capacity ──────────────────────────────────────────────────────

class TestRSVPBeyondCapacity:

    def test_rsvp_at_capacity_returns_400(self, client, db_session):
        eid = seed_event(db_session, capacity=2)
        r1 = seed_resident(db_session, name="R1", flat_number="601")
        r2 = seed_resident(db_session, name="R2", flat_number="602")
        r3 = seed_resident(db_session, name="R3", flat_number="603")
        seed_registration(db_session, eid, r1, "rsvp")
        seed_registration(db_session, eid, r2, "rsvp")

        resp = register(client, eid, r3, reg_type="rsvp")
        assert resp.status_code == 400
        assert "capacity" in resp.json()["detail"].lower()

    def test_spots_remaining_decrements_correctly(self, client, db_session):
        eid = seed_event(db_session, capacity=3)
        r1 = seed_resident(db_session, name="R1", flat_number="601")
        seed_registration(db_session, eid, r1, "rsvp")

        data = client.get(f"{BASE}/{eid}").json()
        assert data["spots_remaining"] == 2

    def test_unlimited_capacity_never_blocks_rsvp(self, client, db_session):
        eid = seed_event(db_session, capacity=None)
        for i in range(10):
            rid = seed_resident(db_session, name=f"R{i}", flat_number=f"6{i:02d}")
            resp = register(client, eid, rid, reg_type="rsvp")
            assert resp.status_code == 201
