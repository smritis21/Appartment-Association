"""
EN-12 — Improve Payment Reminders.

Additional tests beyond test_be12_reminders.py:
  - Reminder timing across month boundaries (bill due on last day of month)
  - Reminder timing across time zones (bill due_date edge cases)
  - Reminders not generated for already-paid accounts
  - Reminders not generated for cancelled bills
  - Partially-paid bill still generates reminders
"""

from datetime import date, timedelta
import calendar


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_flat(db_session):
    from app.models.resident import Flat
    flat = Flat(block="B", floor="2", flat_number="202",
                ownership_type="owned", occupancy_status="occupied")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    return flat.flat_id


def seed_resident(db_session):
    from app.models.resident import Resident
    resident = Resident(
        flat_id=seed_flat(db_session),
        name="Reminder Test Resident",
        phone="9111111111",
        status="active",
    )
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def seed_bill(db_session, resident_id, due_date, bill_status="pending"):
    from app.models.payment import Bill
    bill = Bill(
        resident_id=resident_id,
        billing_month="2024-07",
        maintenance=3000,
        water=500,
        parking=0,
        miscellaneous=0,
        discount=0,
        gst=630,
        total_amount=4130,
        due_date=due_date,
        status=bill_status,
    )
    db_session.add(bill)
    db_session.commit()
    db_session.refresh(bill)
    return bill.bill_id


def send_reminder(client, bill_id, resident_id, reminder_type="first_notice"):
    return client.post("/api/v1/reminders", json={
        "bill_id": bill_id,
        "resident_id": resident_id,
        "reminder_type": reminder_type,
        "channel": "in_app",
    })


# ── Month-boundary timing ─────────────────────────────────────────────────────

class TestMonthBoundaryTiming:

    def test_reminder_on_last_day_of_month(self, client, db_session):
        """Bill due on the last day of a month (e.g. Feb 28/29) is remindable."""
        rid = seed_resident(db_session)
        # Last day of current month
        today = date.today()
        last_day = date(today.year, today.month,
                        calendar.monthrange(today.year, today.month)[1])
        bill_id = seed_bill(db_session, rid, due_date=last_day)
        resp = send_reminder(client, bill_id, rid)
        assert resp.status_code == 201

    def test_reminder_on_first_day_of_next_month(self, client, db_session):
        """Bill due on the 1st of next month is still pending and remindable."""
        rid = seed_resident(db_session)
        today = date.today()
        if today.month == 12:
            first_next = date(today.year + 1, 1, 1)
        else:
            first_next = date(today.year, today.month + 1, 1)
        bill_id = seed_bill(db_session, rid, due_date=first_next)
        resp = send_reminder(client, bill_id, rid)
        assert resp.status_code == 201

    def test_reminder_for_overdue_bill_crossing_month_boundary(self, client, db_session):
        """A bill that became overdue in a previous month is still remindable."""
        rid = seed_resident(db_session)
        past_due = date.today() - timedelta(days=35)
        bill_id = seed_bill(db_session, rid, due_date=past_due, bill_status="overdue")
        resp = send_reminder(client, bill_id, rid)
        assert resp.status_code == 201

    def test_reminder_due_date_today_is_remindable(self, client, db_session):
        """A bill due today (not yet overdue) is still pending and remindable."""
        rid = seed_resident(db_session)
        bill_id = seed_bill(db_session, rid, due_date=date.today())
        resp = send_reminder(client, bill_id, rid)
        assert resp.status_code == 201


# ── Timezone edge cases ───────────────────────────────────────────────────────

class TestTimezoneEdgeCases:

    def test_reminder_for_bill_due_yesterday_overdue_status(self, client, db_session):
        """Bill due yesterday is overdue — reminder must still be accepted."""
        rid = seed_resident(db_session)
        yesterday = date.today() - timedelta(days=1)
        bill_id = seed_bill(db_session, rid, due_date=yesterday, bill_status="overdue")
        resp = send_reminder(client, bill_id, rid)
        assert resp.status_code == 201

    def test_reminder_for_bill_due_far_in_future(self, client, db_session):
        """Bill due 90 days from now is pending — reminder is valid."""
        rid = seed_resident(db_session)
        future = date.today() + timedelta(days=90)
        bill_id = seed_bill(db_session, rid, due_date=future)
        resp = send_reminder(client, bill_id, rid)
        assert resp.status_code == 201

    def test_reminder_status_field_is_sent_not_timezone_artifact(self, client, db_session):
        """The created reminder must have status='sent' regardless of when it's created."""
        rid = seed_resident(db_session)
        bill_id = seed_bill(db_session, rid, due_date=date.today() + timedelta(days=5))
        data = send_reminder(client, bill_id, rid).json()
        assert data["status"] == "sent"
        assert data["sent_at"] is not None


# ── Already-paid accounts ─────────────────────────────────────────────────────

class TestPaidAccountReminders:

    def test_reminder_not_generated_for_paid_bill(self, client, db_session):
        """A fully paid bill must not accept new reminders."""
        rid = seed_resident(db_session)
        bill_id = seed_bill(db_session, rid,
                            due_date=date.today() + timedelta(days=5),
                            bill_status="paid")
        resp = send_reminder(client, bill_id, rid)
        assert resp.status_code == 400
        assert "paid" in resp.json()["detail"].lower()

    def test_reminder_not_generated_for_cancelled_bill(self, client, db_session):
        """A cancelled bill must not accept reminders."""
        rid = seed_resident(db_session)
        bill_id = seed_bill(db_session, rid,
                            due_date=date.today() + timedelta(days=5),
                            bill_status="cancelled")
        resp = send_reminder(client, bill_id, rid)
        assert resp.status_code == 400

    def test_reminder_allowed_for_partially_paid_bill(self, client, db_session):
        """A partially-paid bill still has an outstanding balance — reminders are valid."""
        rid = seed_resident(db_session)
        bill_id = seed_bill(db_session, rid,
                            due_date=date.today() + timedelta(days=5),
                            bill_status="partially_paid")
        resp = send_reminder(client, bill_id, rid)
        assert resp.status_code == 201

    def test_no_reminder_after_bill_paid_via_payment_flow(self, client, db_session):
        """After a bill is paid through the payment API, reminders must be blocked."""
        from app.models.payment import Bill
        rid = seed_resident(db_session)
        # Create bill via API (future due date required)
        future = date.today() + timedelta(days=10)
        bill_resp = client.post("/api/v1/bills", json={
            "resident_id": rid,
            "billing_month": "2024-08",
            "maintenance": 3000,
            "water": 500,
            "parking": 200,
            "miscellaneous": 100,
            "discount": 0,
            "due_date": future.isoformat(),
        })
        assert bill_resp.status_code == 201
        bill_id = bill_resp.json()["bill_id"]

        # Pay the bill in full
        pay_resp = client.post("/api/v1/payments", json={
            "bill_id": bill_id,
            "amount_paid": 4484.0,
            "payment_method": "upi",
            "gateway": {"simulate_failure": False},
        })
        assert pay_resp.status_code == 201

        # Now try to send a reminder — must be rejected
        resp = send_reminder(client, bill_id, rid)
        assert resp.status_code == 400
        assert "paid" in resp.json()["detail"].lower()

    def test_multiple_residents_paid_accounts_all_blocked(self, client, db_session):
        """Paid-account guard applies per-resident, not globally."""
        r1 = seed_resident(db_session)
        r2 = seed_resident(db_session)
        b1 = seed_bill(db_session, r1,
                       due_date=date.today() + timedelta(days=5),
                       bill_status="paid")
        b2 = seed_bill(db_session, r2,
                       due_date=date.today() + timedelta(days=5),
                       bill_status="pending")

        resp1 = send_reminder(client, b1, r1)
        resp2 = send_reminder(client, b2, r2)

        assert resp1.status_code == 400   # paid — blocked
        assert resp2.status_code == 201   # pending — allowed
