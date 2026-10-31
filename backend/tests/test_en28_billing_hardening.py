"""
EN-28 — Harden Billing (additional tests beyond test_be28_billing.py).

Covers:
  - Duplicate bill prevention for same resident + billing period
  - Prorated calculation boundary validation
  - Late-fee boundary: exactly at grace period end
  - Zero-balance and already-paid account handling
  - Receipt rejected for unpaid/failed bills
  - Billing history pagination ordering (newest due_date first)
  - Billing amounts validation (negative components rejected)
"""

from datetime import date, timedelta
from decimal import Decimal


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_flat(db_session, flat_number="401"):
    from app.models.resident import Flat
    flat = Flat(block="D", floor="4", flat_number=flat_number,
                ownership_type="owned", occupancy_status="occupied")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    return flat.flat_id


def seed_resident(db_session, flat_number="401"):
    from app.models.resident import Resident
    resident = Resident(
        flat_id=seed_flat(db_session, flat_number),
        name="Billing Hardening Resident",
        phone="9222222222",
        status="active",
    )
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def seed_bill(db_session, resident_id, due_days_ago=0,
              billing_month="2024-09", status="pending",
              maintenance=3000, water=500, parking=200,
              miscellaneous=100, discount=0):
    from app.models.payment import Bill
    subtotal = maintenance + water + parking + miscellaneous - discount
    gst = round(subtotal * 0.18, 2)
    bill = Bill(
        resident_id=resident_id,
        billing_month=billing_month,
        maintenance=maintenance,
        water=water,
        parking=parking,
        miscellaneous=miscellaneous,
        discount=discount,
        gst=gst,
        total_amount=round(subtotal + gst, 2),
        due_date=date.today() - timedelta(days=due_days_ago),
        status=status,
    )
    db_session.add(bill)
    db_session.commit()
    db_session.refresh(bill)
    return bill


def seed_payment(db_session, bill, amount, status="paid", receipt_suffix="X"):
    from datetime import datetime, timezone
    from app.models.payment import Payment
    payment = Payment(
        bill_id=bill.bill_id,
        resident_id=bill.resident_id,
        amount_paid=amount,
        payment_method="upi",
        paid_on=datetime.now(timezone.utc).replace(tzinfo=None),
        receipt_no=f"PAY-EN28-{receipt_suffix}",
        transaction_ref=f"TXN-EN28-{receipt_suffix}",
        status=status,
        gateway_message="ok",
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)
    return payment


def future_date(days=10):
    return (date.today() + timedelta(days=days)).isoformat()


# ── Duplicate bill prevention ─────────────────────────────────────────────────

class TestDuplicateBillPrevention:

    def test_duplicate_bill_same_period_rejected_409(self, client, db_session):
        rid = seed_resident(db_session)
        r1 = client.post("/api/v1/bills", json={
            "resident_id": rid, "billing_month": "2024-09",
            "maintenance": 3000, "due_date": future_date(),
        })
        assert r1.status_code == 201

        r2 = client.post("/api/v1/bills", json={
            "resident_id": rid, "billing_month": "2024-09",
            "maintenance": 3000, "due_date": future_date(),
        })
        assert r2.status_code == 409
        assert "already exists" in r2.json()["detail"].lower()

    def test_duplicate_bill_error_includes_existing_bill_id(self, client, db_session):
        rid = seed_resident(db_session)
        first = client.post("/api/v1/bills", json={
            "resident_id": rid, "billing_month": "2024-10",
            "maintenance": 3000, "due_date": future_date(),
        }).json()
        second = client.post("/api/v1/bills", json={
            "resident_id": rid, "billing_month": "2024-10",
            "maintenance": 3000, "due_date": future_date(),
        })
        assert second.status_code == 409
        assert first["bill_id"] in second.json()["detail"]

    def test_different_residents_same_month_both_succeed(self, client, db_session):
        r1 = seed_resident(db_session, flat_number="401")
        r2 = seed_resident(db_session, flat_number="402")
        resp1 = client.post("/api/v1/bills", json={
            "resident_id": r1, "billing_month": "2024-11",
            "maintenance": 3000, "due_date": future_date(),
        })
        resp2 = client.post("/api/v1/bills", json={
            "resident_id": r2, "billing_month": "2024-11",
            "maintenance": 3000, "due_date": future_date(),
        })
        assert resp1.status_code == 201
        assert resp2.status_code == 201


# ── Prorated calculation boundaries ──────────────────────────────────────────

class TestProratedCalculationBoundaries:

    def test_zero_maintenance_bill_has_zero_gst(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.post("/api/v1/bills", json={
            "resident_id": rid, "billing_month": "2024-09",
            "maintenance": 0, "water": 0, "parking": 0,
            "miscellaneous": 0, "discount": 0,
            "due_date": future_date(),
        })
        assert resp.status_code == 201
        data = resp.json()
        assert float(data["gst"]) == 0.0
        assert float(data["total_amount"]) == 0.0

    def test_discount_exceeding_subtotal_clamps_to_zero(self, client, db_session):
        """When discount > subtotal the taxable base is clamped to 0, not negative."""
        rid = seed_resident(db_session)
        resp = client.post("/api/v1/bills", json={
            "resident_id": rid, "billing_month": "2024-09",
            "maintenance": 100, "water": 0, "parking": 0,
            "miscellaneous": 0, "discount": 500,
            "due_date": future_date(),
        })
        assert resp.status_code == 201
        data = resp.json()
        assert float(data["gst"]) == 0.0
        assert float(data["total_amount"]) == 0.0

    def test_gst_rounds_half_up(self, client, db_session):
        """GST on 1001 = 180.18 (18% of 1001)."""
        rid = seed_resident(db_session)
        resp = client.post("/api/v1/bills", json={
            "resident_id": rid, "billing_month": "2024-09",
            "maintenance": 1001, "water": 0, "parking": 0,
            "miscellaneous": 0, "discount": 0,
            "due_date": future_date(),
        })
        assert resp.status_code == 201
        data = resp.json()
        assert float(data["gst"]) == 180.18
        assert float(data["total_amount"]) == 1181.18

    def test_negative_maintenance_rejected(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.post("/api/v1/bills", json={
            "resident_id": rid, "billing_month": "2024-09",
            "maintenance": -100, "due_date": future_date(),
        })
        assert resp.status_code == 422

    def test_negative_discount_rejected(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.post("/api/v1/bills", json={
            "resident_id": rid, "billing_month": "2024-09",
            "maintenance": 3000, "discount": -50,
            "due_date": future_date(),
        })
        assert resp.status_code == 422


# ── Late-fee boundary: exactly at grace period end ────────────────────────────

class TestLateFeeBoundary:

    def test_fee_is_zero_on_last_day_of_grace(self, client, db_session):
        """On the last day of the grace period (day == grace_days) fee is still 0."""
        rid = seed_resident(db_session)
        bill = seed_bill(db_session, rid, due_days_ago=7)  # default grace = 7
        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()
        assert data["chargeable_days"] == 0
        assert float(data["late_fee"]) == 0.0
        assert data["within_grace"] is True

    def test_fee_starts_one_day_after_grace(self, client, db_session):
        rid = seed_resident(db_session)
        bill = seed_bill(db_session, rid, due_days_ago=8)  # 1 chargeable day
        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()
        assert data["chargeable_days"] == 1
        assert float(data["late_fee"]) > 0.0


# ── Zero-balance and already-paid accounts ────────────────────────────────────

class TestZeroBalanceAndPaidAccounts:

    def test_zero_total_bill_has_zero_late_fee(self, client, db_session):
        rid = seed_resident(db_session)
        bill = seed_bill(db_session, rid, due_days_ago=30,
                         maintenance=0, water=0, parking=0,
                         miscellaneous=0, discount=0)
        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()
        assert float(data["late_fee"]) == 0.0
        assert float(data["principal_outstanding"]) == 0.0

    def test_paid_bill_late_fee_is_zero(self, client, db_session):
        rid = seed_resident(db_session)
        bill = seed_bill(db_session, rid, due_days_ago=200, status="paid")
        seed_payment(db_session, bill, amount=4484.0, receipt_suffix="PAID1")
        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()
        assert float(data["late_fee"]) == 0.0
        assert float(data["principal_outstanding"]) == 0.0

    def test_paid_bill_statement_shows_zero_outstanding(self, client, db_session):
        rid = seed_resident(db_session)
        bill = seed_bill(db_session, rid, due_days_ago=0, status="paid")
        seed_payment(db_session, bill, amount=4484.0, receipt_suffix="PAID2")
        data = client.get(f"/api/v1/bills/{bill.bill_id}/statement").json()
        assert float(data["outstanding"]) == 0.0


# ── Receipt rejected for unpaid/failed bills ──────────────────────────────────

class TestReceiptRejection:

    def test_receipt_for_failed_payment_returns_409(self, client, db_session):
        rid = seed_resident(db_session)
        bill = seed_bill(db_session, rid, due_days_ago=0)
        payment = seed_payment(db_session, bill, amount=4484.0,
                               status="failed", receipt_suffix="FAIL1")
        resp = client.get(f"/api/v1/payments/{payment.payment_id}/receipt")
        assert resp.status_code == 409

    def test_receipt_for_pending_payment_returns_409(self, client, db_session):
        rid = seed_resident(db_session)
        bill = seed_bill(db_session, rid, due_days_ago=0)
        payment = seed_payment(db_session, bill, amount=4484.0,
                               status="pending", receipt_suffix="PEND1")
        resp = client.get(f"/api/v1/payments/{payment.payment_id}/receipt")
        assert resp.status_code == 409

    def test_receipt_for_paid_payment_succeeds(self, client, db_session):
        rid = seed_resident(db_session)
        bill = seed_bill(db_session, rid, due_days_ago=0, status="paid")
        payment = seed_payment(db_session, bill, amount=4484.0,
                               status="paid", receipt_suffix="OK1")
        resp = client.get(f"/api/v1/payments/{payment.payment_id}/receipt")
        assert resp.status_code == 200


# ── Billing history pagination and ordering ───────────────────────────────────

class TestBillingHistoryPaginationOrdering:

    def test_bills_ordered_newest_due_date_first(self, client, db_session):
        rid = seed_resident(db_session)
        seed_bill(db_session, rid, due_days_ago=60, billing_month="2024-04")
        seed_bill(db_session, rid, due_days_ago=30, billing_month="2024-05")
        seed_bill(db_session, rid, due_days_ago=0,  billing_month="2024-06")

        data = client.get(f"/api/v1/residents/{rid}/bills").json()
        months = [item["billing_month"] for item in data["items"]]
        assert months == ["2024-06", "2024-05", "2024-04"]

    def test_pagination_skip_and_limit(self, client, db_session):
        rid = seed_resident(db_session)
        for i, m in enumerate(["2024-01", "2024-02", "2024-03", "2024-04", "2024-05"]):
            seed_bill(db_session, rid, due_days_ago=i * 10, billing_month=m)

        page1 = client.get(f"/api/v1/residents/{rid}/bills?skip=0&limit=2").json()
        page2 = client.get(f"/api/v1/residents/{rid}/bills?skip=2&limit=2").json()
        page3 = client.get(f"/api/v1/residents/{rid}/bills?skip=4&limit=2").json()

        assert len(page1["items"]) == 2
        assert len(page2["items"]) == 2
        assert len(page3["items"]) == 1
        assert page1["total"] == page2["total"] == page3["total"] == 5

    def test_large_pagination_limit_capped_at_100(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.get(f"/api/v1/residents/{rid}/bills?limit=200")
        assert resp.status_code == 422

    def test_negative_skip_rejected(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.get(f"/api/v1/residents/{rid}/bills?skip=-1")
        assert resp.status_code == 422
