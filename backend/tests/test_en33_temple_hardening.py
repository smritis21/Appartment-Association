"""
EN-33 — Harden Temple Management (additional tests beyond test_be33_temple_management.py).

Covers:
  - Reject double-booked seva slots
  - Reject zero or negative donation amounts
  - Reject bookings for past dates
  - Reject bookings/signups after event closure
  - Validate donation receipt/reference integrity
  - Donation with receipt_no stored and retrievable
"""

from datetime import date, datetime, timedelta

from app.models.resident import Flat, Resident
from app.models.temple import TempleBooking, TempleDonation, TempleEvent

BASE = "/api/v1/temple"


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_resident(db_session, name="Temple Resident", flat_number="701"):
    flat = Flat(block="G", floor="7", flat_number=flat_number,
                ownership_type="owned", occupancy_status="occupied")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    resident = Resident(flat_id=flat.flat_id, name=name,
                        phone="9555555555", status="active")
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def future_date(days=7):
    return (date.today() + timedelta(days=days)).isoformat()


def future_datetime(days=7):
    return (datetime.now() + timedelta(days=days)).isoformat()


def seed_event(db_session, status="upcoming", days_ahead=7):
    event = TempleEvent(
        title="Test Temple Event",
        event_date=datetime.now() + timedelta(days=days_ahead),
        status=status,
    )
    db_session.add(event)
    db_session.commit()
    db_session.refresh(event)
    return event.event_id


def book_seva(client, resident_id, seva_type="archana", booking_date=None,
              slot="morning", amount="101"):
    return client.post(f"{BASE}/sevas", json={
        "resident_id": resident_id,
        "seva_type": seva_type,
        "booking_date": booking_date or future_date(),
        "slot": slot,
        "amount": amount,
    })


# ── Double-booked seva slots ──────────────────────────────────────────────────

class TestDoubleBookedSevaSlots:

    def test_same_seva_type_date_slot_rejected_409(self, client, db_session):
        r1 = seed_resident(db_session, name="R1", flat_number="701")
        r2 = seed_resident(db_session, name="R2", flat_number="702")
        bd = future_date()

        first = book_seva(client, r1, booking_date=bd)
        assert first.status_code == 201

        second = book_seva(client, r2, booking_date=bd)
        assert second.status_code == 409
        assert "already confirmed" in second.json()["detail"].lower()

    def test_same_slot_different_seva_type_allowed(self, client, db_session):
        rid = seed_resident(db_session)
        bd = future_date()

        r1 = book_seva(client, rid, seva_type="archana", booking_date=bd)
        r2 = book_seva(client, rid, seva_type="abhishekam", booking_date=bd)
        assert r1.status_code == 201
        assert r2.status_code == 201

    def test_same_seva_type_different_date_allowed(self, client, db_session):
        rid = seed_resident(db_session)
        r1 = book_seva(client, rid, booking_date=future_date(1))
        r2 = book_seva(client, rid, booking_date=future_date(2))
        assert r1.status_code == 201
        assert r2.status_code == 201

    def test_cancelled_slot_can_be_rebooked(self, client, db_session):
        rid = seed_resident(db_session)
        bd = future_date()
        first = book_seva(client, rid, booking_date=bd)
        client.post(f"{BASE}/sevas/{first.json()['booking_id']}/cancel")

        second = book_seva(client, rid, booking_date=bd)
        assert second.status_code == 201


# ── Zero or negative donation amounts ────────────────────────────────────────

class TestDonationAmountValidation:

    def test_zero_donation_rejected(self, client, db_session):
        resp = client.post(f"{BASE}/donations",
                           json={"donor_name": "Someone", "amount": "0"})
        assert resp.status_code == 422

    def test_negative_donation_rejected(self, client, db_session):
        resp = client.post(f"{BASE}/donations",
                           json={"donor_name": "Someone", "amount": "-100"})
        assert resp.status_code == 422

    def test_very_small_positive_donation_accepted(self, client, db_session):
        resp = client.post(f"{BASE}/donations",
                           json={"donor_name": "Someone", "amount": "0.01"})
        assert resp.status_code == 201

    def test_large_donation_accepted(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.post(f"{BASE}/donations",
                           json={"resident_id": rid, "amount": "100000"})
        assert resp.status_code == 201


# ── Bookings for past dates ───────────────────────────────────────────────────

class TestPastDateBookings:

    def test_past_booking_date_rejected_422(self, client, db_session):
        rid = seed_resident(db_session)
        yesterday = (date.today() - timedelta(days=1)).isoformat()
        resp = book_seva(client, rid, booking_date=yesterday)
        assert resp.status_code == 422

    def test_today_booking_date_accepted(self, client, db_session):
        rid = seed_resident(db_session)
        resp = book_seva(client, rid, booking_date=date.today().isoformat())
        assert resp.status_code == 201

    def test_future_booking_date_accepted(self, client, db_session):
        rid = seed_resident(db_session)
        resp = book_seva(client, rid, booking_date=future_date(30))
        assert resp.status_code == 201


# ── Bookings/signups after event closure ─────────────────────────────────────

class TestSignupAfterEventClosure:

    def test_signup_on_completed_event_rejected(self, client, db_session):
        eid = seed_event(db_session, status="completed")
        rid = seed_resident(db_session)
        resp = client.post(f"{BASE}/events/{eid}/signup",
                           json={"resident_id": rid, "type": "rsvp"})
        assert resp.status_code == 400
        assert "completed" in resp.json()["detail"].lower()

    def test_signup_on_cancelled_event_rejected(self, client, db_session):
        eid = seed_event(db_session, status="cancelled")
        rid = seed_resident(db_session)
        resp = client.post(f"{BASE}/events/{eid}/signup",
                           json={"resident_id": rid, "type": "rsvp"})
        assert resp.status_code == 400

    def test_signup_on_past_dated_upcoming_event_rejected(self, client, db_session):
        eid = seed_event(db_session, status="upcoming", days_ahead=-1)
        rid = seed_resident(db_session)
        resp = client.post(f"{BASE}/events/{eid}/signup",
                           json={"resident_id": rid, "type": "rsvp"})
        assert resp.status_code == 400
        assert "already took place" in resp.json()["detail"].lower()

    def test_signup_on_upcoming_future_event_succeeds(self, client, db_session):
        eid = seed_event(db_session, status="upcoming", days_ahead=7)
        rid = seed_resident(db_session)
        resp = client.post(f"{BASE}/events/{eid}/signup",
                           json={"resident_id": rid, "type": "rsvp"})
        assert resp.status_code == 201


# ── Donation receipt/reference integrity ─────────────────────────────────────

class TestDonationReceiptIntegrity:

    def test_donation_with_receipt_no_stored(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.post(f"{BASE}/donations", json={
            "resident_id": rid,
            "amount": "501",
            "receipt_no": "RCPT-2024-001",
        })
        assert resp.status_code == 201
        assert resp.json()["receipt_no"] == "RCPT-2024-001"

    def test_donation_receipt_retrievable_by_id(self, client, db_session):
        rid = seed_resident(db_session)
        created = client.post(f"{BASE}/donations", json={
            "resident_id": rid,
            "amount": "501",
            "receipt_no": "RCPT-2024-002",
        }).json()
        donation_id = created["donation_id"]

        resp = client.get(f"{BASE}/donations/{donation_id}")
        assert resp.status_code == 200
        assert resp.json()["receipt_no"] == "RCPT-2024-002"

    def test_donation_without_receipt_no_accepted(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.post(f"{BASE}/donations", json={
            "resident_id": rid, "amount": "101",
        })
        assert resp.status_code == 201

    def test_anonymous_donation_with_receipt_no(self, client, db_session):
        resp = client.post(f"{BASE}/donations", json={
            "donor_name": "Anonymous",
            "amount": "1001",
            "receipt_no": "RCPT-ANON-001",
        })
        assert resp.status_code == 201
        assert resp.json()["receipt_no"] == "RCPT-ANON-001"

    def test_donation_list_filterable_by_resident(self, client, db_session):
        r1 = seed_resident(db_session, name="R1", flat_number="701")
        r2 = seed_resident(db_session, name="R2", flat_number="702")
        client.post(f"{BASE}/donations", json={"resident_id": r1, "amount": "101"})
        client.post(f"{BASE}/donations", json={"resident_id": r2, "amount": "201"})

        resp = client.get(f"{BASE}/donations?resident_id={r1}")
        assert resp.status_code == 200
        donations = resp.json()
        assert all(d["resident_id"] == r1 for d in donations)
        assert len(donations) == 1

    def test_unknown_donation_returns_404(self, client, db_session):
        resp = client.get(f"{BASE}/donations/does-not-exist")
        assert resp.status_code == 404
