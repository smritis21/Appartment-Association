"""
pytest tests for BE-36 — Reports & Analytics API.

Covers:
  - Summary: zeroed on an empty database, reflects seeded cross-module data
  - Payments: totals, average, by-status breakdown, range filtering
  - Residents: status counts, occupancy rate, block breakdown, move-ins-in-range
  - Visitors: counts, by-status/purpose breakdown, average per day
  - Maintenance: total/upcoming/past counts
  - Temple: booking/donation/signup aggregates, participation rate incl.
    the zero-active-residents divide-by-zero case
  - Community: activity/signup aggregates, participation rate
  - Range validation: date_from later than date_to returns 422

Fixtures (client, db_session) are defined in conftest.py.
"""

import json
from datetime import date, datetime, timedelta

from app.models.community import ActivitySignup, CommunityActivity
from app.models.maintenance import MaintenanceSchedule
from app.models.payment import Bill, Payment
from app.models.resident import Flat, Resident
from app.models.temple import TempleBooking, TempleDonation, TempleEvent, TempleEventSignup
from app.models.visitor import Visitor

BASE = "/api/v1/reports"
TODAY = date.today()


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_resident(db_session, **overrides) -> str:
    flat_defaults = {
        "block": "A", "floor": "1", "flat_number": "101",
        "ownership_type": "owned", "occupancy_status": "occupied",
    }
    flat_defaults.update({k: v for k, v in overrides.items() if k in flat_defaults})
    flat = Flat(**flat_defaults)
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)

    resident_defaults = {
        "flat_id": flat.flat_id, "name": "Test Resident", "phone": "9800000000", "status": "active",
    }
    resident_defaults.update({k: v for k, v in overrides.items() if k not in flat_defaults})
    resident = Resident(**resident_defaults)
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def seed_bill_and_payment(db_session, resident_id, **overrides) -> None:
    bill = Bill(
        resident_id=resident_id,
        billing_month="2026-08",
        total_amount=overrides.get("total_amount", 1000),
        due_date=overrides.get("due_date", TODAY),
        status=overrides.get("bill_status", "paid"),
    )
    db_session.add(bill)
    db_session.commit()
    db_session.refresh(bill)

    if overrides.get("with_payment", True):
        payment = Payment(
            bill_id=bill.bill_id,
            resident_id=resident_id,
            amount_paid=overrides.get("amount_paid", 1000),
            payment_method="upi",
            paid_on=overrides.get("paid_on", datetime.now()),
            receipt_no=f"RCPT-{bill.bill_id[:8]}",
            status="paid",
        )
        db_session.add(payment)
        db_session.commit()


def seed_visitor(db_session, **overrides) -> None:
    defaults = {
        "visitor_name": "Guest",
        "purpose": "Guest Visit",
        "status": "approved",
        "requested_at": datetime.now(),
    }
    defaults.update(overrides)
    db_session.add(Visitor(**defaults))
    db_session.commit()


def seed_maintenance(db_session, **overrides) -> None:
    defaults = {
        "title": "Lift Servicing",
        "scheduled_date": TODAY,
        "scheduled_time": datetime.now().time(),
        "affected_facilities": json.dumps(["Lift"]),
    }
    defaults.update(overrides)
    db_session.add(MaintenanceSchedule(**defaults))
    db_session.commit()


def seed_booking(db_session, resident_id, **overrides) -> None:
    defaults = {
        "resident_id": resident_id, "seva_type": "archana",
        "booking_date": TODAY, "amount": 101, "status": "confirmed",
    }
    defaults.update(overrides)
    db_session.add(TempleBooking(**defaults))
    db_session.commit()


def seed_donation(db_session, resident_id=None, **overrides) -> None:
    defaults = {"resident_id": resident_id, "donor_name": None, "amount": 500, "donated_at": datetime.now()}
    defaults.update(overrides)
    db_session.add(TempleDonation(**defaults))
    db_session.commit()


def seed_activity_and_signup(db_session, resident_id, **overrides) -> None:
    activity = CommunityActivity(
        corner=overrides.get("corner", "kids"), title="Camp", status="upcoming",
        activity_date=overrides.get("activity_date", TODAY),
    )
    db_session.add(activity)
    db_session.commit()
    db_session.refresh(activity)
    db_session.add(
        ActivitySignup(
            activity_id=activity.activity_id,
            resident_id=resident_id,
            signed_up_at=overrides.get("signed_up_at", datetime.now()),
        )
    )
    db_session.commit()


# ── Summary ───────────────────────────────────────────────────────────────────

def test_summary_empty_db_is_zeroed(client, db_session):
    response = client.get(f"{BASE}/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["active_residents"] == 0
    assert body["outstanding_bills_count"] == 0
    assert body["payments_collected_count"] == 0
    assert body["visitors_count"] == 0
    assert body["temple_bookings_count"] == 0
    assert body["community_signups_count"] == 0


def test_summary_reflects_seeded_data(client, db_session):
    resident_id = seed_resident(db_session)
    seed_bill_and_payment(db_session, resident_id, amount_paid=1000)
    seed_visitor(db_session)
    seed_booking(db_session, resident_id)
    seed_donation(db_session, resident_id)
    seed_activity_and_signup(db_session, resident_id)

    response = client.get(f"{BASE}/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["active_residents"] == 1
    assert body["payments_collected_count"] == 1
    assert float(body["payments_collected_amount"]) == 1000.0
    assert body["visitors_count"] == 1
    assert body["temple_bookings_count"] == 1
    assert body["community_signups_count"] == 1


# ── Payments ──────────────────────────────────────────────────────────────────

def test_payments_report_totals(client, db_session):
    r1 = seed_resident(db_session)
    seed_bill_and_payment(db_session, r1, total_amount=1000, amount_paid=1000, bill_status="paid")
    r2 = seed_resident(db_session)
    seed_bill_and_payment(db_session, r2, total_amount=500, with_payment=False, bill_status="pending")

    response = client.get(f"{BASE}/payments")

    assert response.status_code == 200
    body = response.json()
    assert float(body["total_billed"]) == 1500.0
    assert float(body["total_collected"]) == 1000.0
    assert float(body["total_outstanding"]) == 500.0
    assert body["bill_count"] == 2
    assert float(body["average_bill_amount"]) == 750.0


def test_payments_report_date_range_excludes_out_of_range_bills(client, db_session):
    resident_id = seed_resident(db_session)
    seed_bill_and_payment(db_session, resident_id, due_date=TODAY - timedelta(days=100))

    response = client.get(f"{BASE}/payments?date_from={TODAY.isoformat()}&date_to={TODAY.isoformat()}")

    assert response.status_code == 200
    assert response.json()["bill_count"] == 0


# ── Residents ─────────────────────────────────────────────────────────────────

def test_residents_report_status_and_occupancy(client, db_session):
    seed_resident(db_session, status="active")
    seed_resident(db_session, status="active")
    seed_resident(db_session, status="moved_out")

    response = client.get(f"{BASE}/residents")

    assert response.status_code == 200
    body = response.json()
    assert body["total_residents"] == 3
    by_status = {row["label"]: row["count"] for row in body["by_status"]}
    assert by_status["active"] == 2
    assert by_status["moved_out"] == 1
    assert body["occupancy_rate"] == 1.0  # all 3 flats seeded as occupied


def test_residents_report_new_move_ins_respects_range(client, db_session):
    seed_resident(db_session, move_in_date=TODAY)
    seed_resident(db_session, move_in_date=TODAY - timedelta(days=100))

    response = client.get(f"{BASE}/residents?date_from={TODAY.isoformat()}&date_to={TODAY.isoformat()}")

    assert response.status_code == 200
    assert response.json()["new_move_ins"] == 1


# ── Visitors ──────────────────────────────────────────────────────────────────

def test_visitors_report_counts_and_breakdowns(client, db_session):
    seed_visitor(db_session, status="approved", purpose="Guest Visit")
    seed_visitor(db_session, status="rejected", purpose="Delivery")

    response = client.get(f"{BASE}/visitors")

    assert response.status_code == 200
    body = response.json()
    assert body["total_visitors"] == 2
    by_status = {row["label"]: row["count"] for row in body["by_status"]}
    assert by_status["approved"] == 1
    assert by_status["rejected"] == 1


def test_visitors_report_date_range_excludes_out_of_range(client, db_session):
    seed_visitor(db_session, requested_at=datetime.now() - timedelta(days=100))

    response = client.get(f"{BASE}/visitors?date_from={TODAY.isoformat()}&date_to={TODAY.isoformat()}")

    assert response.status_code == 200
    assert response.json()["total_visitors"] == 0


# ── Maintenance ───────────────────────────────────────────────────────────────

def test_maintenance_report_upcoming_and_past(client, db_session):
    seed_maintenance(db_session, scheduled_date=TODAY + timedelta(days=5))
    seed_maintenance(db_session, scheduled_date=TODAY - timedelta(days=5))

    response = client.get(
        f"{BASE}/maintenance?date_from={(TODAY - timedelta(days=10)).isoformat()}"
        f"&date_to={(TODAY + timedelta(days=10)).isoformat()}"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["total_scheduled"] == 2
    assert body["upcoming_count"] == 1
    assert body["past_count"] == 1


# ── Temple ────────────────────────────────────────────────────────────────────

def test_temple_report_aggregates(client, db_session):
    resident_id = seed_resident(db_session)
    seed_booking(db_session, resident_id, seva_type="archana")
    seed_booking(db_session, resident_id, seva_type="abhishekam", slot="evening")
    seed_donation(db_session, resident_id, amount=300)
    seed_donation(db_session, resident_id, amount=700)

    response = client.get(f"{BASE}/temple")

    assert response.status_code == 200
    body = response.json()
    assert body["bookings_total"] == 2
    assert body["donations_count"] == 2
    assert float(body["donations_total"]) == 1000.0
    assert float(body["donations_average"]) == 500.0
    assert 0 < body["participation_rate"] <= 1.0


def test_temple_report_participation_rate_zero_when_no_active_residents(client, db_session):
    """Divide-by-zero guard: no active residents at all."""
    seed_donation(db_session, resident_id=None, donor_name="Anonymous", amount=100)

    response = client.get(f"{BASE}/temple")

    assert response.status_code == 200
    assert response.json()["participation_rate"] == 0.0


# ── Community ─────────────────────────────────────────────────────────────────

def test_community_report_aggregates(client, db_session):
    resident_id = seed_resident(db_session)
    seed_activity_and_signup(db_session, resident_id, corner="kids")

    response = client.get(f"{BASE}/community")

    assert response.status_code == 200
    body = response.json()
    assert body["activities_count"] == 1
    assert body["signups_count"] == 1
    assert body["average_signups_per_activity"] == 1.0
    assert body["participation_rate"] == 1.0
    by_corner = {row["label"]: row["count"] for row in body["by_corner"]}
    assert by_corner["kids"] == 1


def test_community_report_empty_db_is_zeroed(client, db_session):
    response = client.get(f"{BASE}/community")

    assert response.status_code == 200
    body = response.json()
    assert body["activities_count"] == 0
    assert body["average_signups_per_activity"] == 0.0
    assert body["participation_rate"] == 0.0


# ── Range validation ──────────────────────────────────────────────────────────

def test_date_from_after_date_to_returns_422(client, db_session):
    response = client.get(
        f"{BASE}/summary?date_from={TODAY.isoformat()}&date_to={(TODAY - timedelta(days=1)).isoformat()}"
    )

    assert response.status_code == 422


def test_malformed_date_returns_422(client, db_session):
    response = client.get(f"{BASE}/payments?date_from=not-a-date")

    assert response.status_code == 422


def test_default_range_used_when_omitted(client, db_session):
    response = client.get(f"{BASE}/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["date_to"] == TODAY.isoformat()
    assert body["date_from"] == (TODAY - timedelta(days=30)).isoformat()
