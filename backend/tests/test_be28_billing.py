"""
pytest tests for BE-28 — Resident Billing API.

Covers:
  Bills:
    - Bill statement (line items, GST, payments, outstanding, resident block)
    - Statement not found, statement with `as_of`
    - Resident bill list (all, by status, by month, due-date range, unpaid_only,
      pagination, totals)

  Receipts:
    - Receipt for a successful payment (fields, balance after payment)
    - Receipt for a failed payment → 409
    - Receipt not found
    - Balance is a snapshot: it does not move when a later payment is made

  Payment history:
    - Filter by method, status, bill, date range, amount range
    - Sorting, pagination, total vs page totals
    - total_amount counts only successful payments
    - Invalid filter ranges → 422

  Late fees:
    - No fee before due date, no fee inside the grace period
    - Fee starts the day after grace ends
    - Daily proration vs monthly proration
    - Cap applied via late_fee_max_percent
    - Part payment shrinks the principal the fee is charged on
    - Fully paid bill never accrues
    - Rules read from apartment_config, defaults when unset
    - Accrual persists the snapshot and flips pending → overdue
    - Accrual is idempotent; accruing a paid bill → 409
    - Bulk accrual summary

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

DEFAULT_GRACE_DAYS = 7
DEFAULT_RATE_PERCENT = Decimal("2.0")
DEFAULT_MAX_PERCENT = Decimal("20.0")


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_flat(db_session, flat_number: str = "301"):
    from app.models.resident import Flat
    flat = Flat(block="C", floor="3", flat_number=flat_number,
                ownership_type="owned", occupancy_status="occupied")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    return flat.flat_id


def seed_resident(db_session, name: str = "Arun Prakash", flat_number: str = "301"):
    from app.models.resident import Resident
    resident = Resident(
        flat_id=seed_flat(db_session, flat_number),
        name=name,
        phone="9800011122",
        status="active",
    )
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def seed_bill(
    db_session,
    resident_id: str,
    due_days_ago: int = 30,
    billing_month: str = "2024-06",
    maintenance: float = 3000,
    water: float = 500,
    parking: float = 200,
    miscellaneous: float = 100,
    discount: float = 0,
    status: str = "pending",
    late_fee: float = 0,
):
    """
    Seed a bill directly.

    Bills are seeded through the ORM rather than POST /bills because BE-11
    rejects a past `due_date` — and an overdue bill is exactly what a late-fee
    test needs.
    """
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
        late_fee=late_fee,
    )
    db_session.add(bill)
    db_session.commit()
    db_session.refresh(bill)
    return bill


def seed_payment(
    db_session,
    bill,
    amount: float,
    method: str = "upi",
    status: str = "paid",
    days_ago: int = 1,
    receipt_no: str | None = None,
):
    from app.models.payment import Payment
    suffix = receipt_no or f"PAY-TEST-{datetime.now(timezone.utc).replace(tzinfo=None).timestamp():.6f}".replace(".", "")
    payment = Payment(
        bill_id=bill.bill_id,
        resident_id=bill.resident_id,
        amount_paid=amount,
        payment_method=method,
        paid_on=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days_ago),
        receipt_no=suffix,
        transaction_ref=f"TXN-{suffix}",
        status=status,
        gateway_message="Payment processed successfully." if status == "paid" else "Gateway declined.",
    )
    db_session.add(payment)
    db_session.commit()
    db_session.refresh(payment)
    return payment


def set_config(db_session, key: str, value: str):
    from app.models.settings import ApartmentConfig
    row = db_session.query(ApartmentConfig).filter(ApartmentConfig.key == key).first()
    if row:
        row.value = value
    else:
        db_session.add(ApartmentConfig(key=key, value=value))
    db_session.commit()


def expected_daily_fee(principal: Decimal, rate: Decimal, chargeable_days: int) -> Decimal:
    """Mirror of the documented formula, kept independent of the service code."""
    return (principal * rate / Decimal("100") * Decimal(chargeable_days) / Decimal("30")).quantize(
        Decimal("0.01")
    )


# ── GET /api/v1/bills/{bill_id}/statement ─────────────────────────────────────

class TestBillStatement:

    def test_statement_returns_line_items_and_totals(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=0)

        response = client.get(f"/api/v1/bills/{bill.bill_id}/statement")

        assert response.status_code == 200
        data = response.json()
        assert data["bill_id"] == bill.bill_id
        assert data["resident_name"] == "Arun Prakash"
        assert data["flat_number"] == "301"
        assert data["billing_month"] == "2024-06"

        items = data["line_items"]
        assert float(items["maintenance"]) == 3000.0
        assert float(items["taxable_subtotal"]) == 3800.0
        assert float(items["gst"]) == 684.0
        assert float(items["total_amount"]) == 4484.0

        assert float(data["amount_paid"]) == 0.0
        assert float(data["late_fee"]) == 0.0
        assert float(data["outstanding"]) == 4484.0
        assert data["payments"] == []

    def test_statement_includes_payments_and_reduces_outstanding(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=0, status="partially_paid")
        seed_payment(db_session, bill, amount=1484.0)

        data = client.get(f"/api/v1/bills/{bill.bill_id}/statement").json()

        assert len(data["payments"]) == 1
        assert float(data["amount_paid"]) == 1484.0
        assert float(data["outstanding"]) == 3000.0

    def test_statement_ignores_failed_payments(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=0)
        seed_payment(db_session, bill, amount=4484.0, status="failed")

        data = client.get(f"/api/v1/bills/{bill.bill_id}/statement").json()

        # The failed row is still visible for audit, but must not reduce the balance.
        assert len(data["payments"]) == 1
        assert float(data["amount_paid"]) == 0.0
        assert float(data["outstanding"]) == 4484.0

    def test_statement_as_of_applies_late_fee(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=0)
        as_of = (date.today() + timedelta(days=37)).isoformat()

        data = client.get(
            f"/api/v1/bills/{bill.bill_id}/statement", params={"as_of": as_of}
        ).json()

        # 37 days overdue − 7 grace = 30 chargeable days = exactly one month at 2%
        assert float(data["late_fee"]) == 89.68
        assert float(data["outstanding"]) == 4573.68

    def test_statement_not_found(self, client, db_session):
        response = client.get("/api/v1/bills/does-not-exist/statement")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()


# ── GET /api/v1/residents/{resident_id}/bills ─────────────────────────────────

class TestResidentBillList:

    def test_list_returns_bills_with_live_late_fee(self, client, db_session):
        resident_id = seed_resident(db_session)
        seed_bill(db_session, resident_id, due_days_ago=0, billing_month="2024-06")
        seed_bill(db_session, resident_id, due_days_ago=37, billing_month="2024-05")

        data = client.get(f"/api/v1/residents/{resident_id}/bills").json()

        assert data["total"] == 2
        assert len(data["items"]) == 2
        by_month = {row["billing_month"]: row for row in data["items"]}
        assert float(by_month["2024-06"]["late_fee"]) == 0.0
        assert float(by_month["2024-05"]["late_fee"]) == 89.68
        assert by_month["2024-05"]["days_overdue"] == 37
        assert float(data["total_outstanding"]) == 4484.0 + 4573.68

    def test_filter_by_status(self, client, db_session):
        resident_id = seed_resident(db_session)
        seed_bill(db_session, resident_id, due_days_ago=0, billing_month="2024-06")
        seed_bill(db_session, resident_id, due_days_ago=40, billing_month="2024-05", status="paid")

        data = client.get(
            f"/api/v1/residents/{resident_id}/bills", params={"status": "paid"}
        ).json()

        assert data["total"] == 1
        assert data["items"][0]["billing_month"] == "2024-05"

    def test_filter_by_billing_month(self, client, db_session):
        resident_id = seed_resident(db_session)
        seed_bill(db_session, resident_id, billing_month="2024-06")
        seed_bill(db_session, resident_id, billing_month="2024-05")

        data = client.get(
            f"/api/v1/residents/{resident_id}/bills", params={"billing_month": "2024-05"}
        ).json()

        assert data["total"] == 1
        assert data["items"][0]["billing_month"] == "2024-05"

    def test_filter_by_due_date_range(self, client, db_session):
        resident_id = seed_resident(db_session)
        seed_bill(db_session, resident_id, due_days_ago=5, billing_month="2024-06")
        seed_bill(db_session, resident_id, due_days_ago=60, billing_month="2024-04")

        data = client.get(
            f"/api/v1/residents/{resident_id}/bills",
            params={"due_from": (date.today() - timedelta(days=10)).isoformat()},
        ).json()

        assert data["total"] == 1
        assert data["items"][0]["billing_month"] == "2024-06"

    def test_unpaid_only_excludes_paid_bills(self, client, db_session):
        resident_id = seed_resident(db_session)
        seed_bill(db_session, resident_id, billing_month="2024-06", status="paid")
        seed_bill(db_session, resident_id, billing_month="2024-05", status="overdue")

        data = client.get(
            f"/api/v1/residents/{resident_id}/bills", params={"unpaid_only": True}
        ).json()

        assert data["total"] == 1
        assert data["items"][0]["status"] == "overdue"

    def test_pagination_keeps_total_stable(self, client, db_session):
        resident_id = seed_resident(db_session)
        for month in ("2024-01", "2024-02", "2024-03"):
            seed_bill(db_session, resident_id, billing_month=month)

        data = client.get(
            f"/api/v1/residents/{resident_id}/bills", params={"skip": 1, "limit": 1}
        ).json()

        assert data["total"] == 3
        assert len(data["items"]) == 1

    def test_invalid_billing_month_format_rejected(self, client, db_session):
        resident_id = seed_resident(db_session)
        response = client.get(
            f"/api/v1/residents/{resident_id}/bills", params={"billing_month": "2024-13"}
        )
        assert response.status_code == 422

    def test_unknown_resident_returns_empty_page(self, client, db_session):
        data = client.get("/api/v1/residents/no-such-resident/bills").json()
        assert data["total"] == 0
        assert data["items"] == []


# ── GET /api/v1/payments/{payment_id}/receipt ─────────────────────────────────

class TestReceipt:

    def test_receipt_contains_issuer_payer_and_bill(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=0, status="paid")
        payment = seed_payment(db_session, bill, amount=4484.0)

        response = client.get(f"/api/v1/payments/{payment.payment_id}/receipt")

        assert response.status_code == 200
        data = response.json()
        assert data["receipt_no"] == payment.receipt_no
        assert data["payment_id"] == payment.payment_id
        assert data["status"] == "paid"
        assert data["payment_method"] == "upi"
        assert float(data["amount_paid"]) == 4484.0
        assert data["payer"]["name"] == "Arun Prakash"
        assert data["payer"]["flat_number"] == "301"
        assert data["bill"]["bill_id"] == bill.bill_id
        assert data["bill"]["billing_month"] == "2024-06"
        assert float(data["balance_after_payment"]) == 0.0
        assert data["society"]["name"] == "Jains Kences Retreat"

    def test_receipt_uses_configured_society_name(self, client, db_session):
        set_config(db_session, "society_name", "JKR Owners Association")
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, status="paid")
        payment = seed_payment(db_session, bill, amount=4484.0)

        data = client.get(f"/api/v1/payments/{payment.payment_id}/receipt").json()
        assert data["society"]["name"] == "JKR Owners Association"

    def test_receipt_balance_after_partial_payment(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, status="partially_paid")
        payment = seed_payment(db_session, bill, amount=2000.0)

        data = client.get(f"/api/v1/payments/{payment.payment_id}/receipt").json()
        assert float(data["balance_after_payment"]) == 2484.0

    def test_receipt_balance_is_a_snapshot_not_a_live_figure(self, client, db_session):
        """A receipt records a moment — a later payment must not rewrite it."""
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, status="partially_paid")
        first = seed_payment(db_session, bill, amount=2000.0, days_ago=5, receipt_no="PAY-FIRST")
        seed_payment(db_session, bill, amount=2484.0, days_ago=1, receipt_no="PAY-SECOND")

        data = client.get(f"/api/v1/payments/{first.payment_id}/receipt").json()
        assert float(data["balance_after_payment"]) == 2484.0

    def test_receipt_for_failed_payment_returns_409(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id)
        payment = seed_payment(db_session, bill, amount=4484.0, status="failed")

        response = client.get(f"/api/v1/payments/{payment.payment_id}/receipt")

        assert response.status_code == 409
        assert "successful payment" in response.json()["detail"]

    def test_receipt_not_found(self, client, db_session):
        response = client.get("/api/v1/payments/no-such-payment/receipt")
        assert response.status_code == 404

    def test_receipt_generated_end_to_end_from_a_real_payment(self, client, db_session):
        """The BE-11 payment flow must produce a payment BE-28 can issue a receipt for."""
        resident_id = seed_resident(db_session)
        created = client.post(
            "/api/v1/bills",
            json={
                "resident_id": resident_id,
                "billing_month": "2024-07",
                "maintenance": 3000,
                "water": 500,
                "parking": 200,
                "miscellaneous": 100,
                "discount": 0,
                "due_date": (date.today() + timedelta(days=10)).isoformat(),
            },
        ).json()

        receipt_source = client.post(
            "/api/v1/payments",
            json={
                "bill_id": created["bill_id"],
                "amount_paid": 4484.0,
                "payment_method": "upi",
                "gateway": {"mock_reference": "resident@mockupi", "simulate_failure": False},
            },
        ).json()

        data = client.get(f"/api/v1/payments/{receipt_source['payment_id']}/receipt").json()

        assert data["receipt_no"].startswith("PAY-")
        assert float(data["amount_paid"]) == 4484.0
        assert float(data["balance_after_payment"]) == 0.0


# ── GET /api/v1/residents/{resident_id}/payments ──────────────────────────────

class TestPaymentHistory:

    @pytest.fixture
    def history(self, db_session):
        resident_id = seed_resident(db_session)
        bill_a = seed_bill(db_session, resident_id, billing_month="2024-05")
        bill_b = seed_bill(db_session, resident_id, billing_month="2024-06")
        seed_payment(db_session, bill_a, amount=1000.0, method="upi", days_ago=40, receipt_no="R1")
        seed_payment(db_session, bill_a, amount=2000.0, method="cash", days_ago=20, receipt_no="R2")
        seed_payment(db_session, bill_b, amount=3000.0, method="cheque", days_ago=2, receipt_no="R3")
        seed_payment(db_session, bill_b, amount=500.0, method="upi", days_ago=1,
                     status="failed", receipt_no="R4")
        return {"resident_id": resident_id, "bill_a": bill_a, "bill_b": bill_b}

    def test_returns_all_payments_for_resident(self, client, history):
        data = client.get(f"/api/v1/residents/{history['resident_id']}/payments").json()

        assert data["total"] == 4
        assert len(data["items"]) == 4
        # 1000 + 2000 + 3000; the failed 500 must not be counted
        assert float(data["total_amount"]) == 6000.0

    def test_filter_by_method(self, client, history):
        data = client.get(
            f"/api/v1/residents/{history['resident_id']}/payments",
            params={"payment_method": "upi"},
        ).json()

        assert data["total"] == 2
        assert {row["payment_method"] for row in data["items"]} == {"upi"}

    def test_filter_by_status(self, client, history):
        data = client.get(
            f"/api/v1/residents/{history['resident_id']}/payments",
            params={"status": "failed"},
        ).json()

        assert data["total"] == 1
        assert data["items"][0]["status"] == "failed"
        assert float(data["total_amount"]) == 0.0

    def test_filter_by_bill(self, client, history):
        data = client.get(
            f"/api/v1/residents/{history['resident_id']}/payments",
            params={"bill_id": history["bill_a"].bill_id},
        ).json()

        assert data["total"] == 2
        assert {row["bill_id"] for row in data["items"]} == {history["bill_a"].bill_id}

    def test_filter_by_date_range(self, client, history):
        data = client.get(
            f"/api/v1/residents/{history['resident_id']}/payments",
            params={"date_from": (date.today() - timedelta(days=25)).isoformat()},
        ).json()

        # The 40-days-ago payment falls outside the window
        assert data["total"] == 3

    def test_date_to_includes_payments_made_later_that_day(self, client, db_session):
        """date_to is a calendar date but paid_on is a timestamp — the whole day counts."""
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id)
        seed_payment(db_session, bill, amount=1000.0, days_ago=0, receipt_no="R-TODAY")

        data = client.get(
            f"/api/v1/residents/{resident_id}/payments",
            params={"date_to": date.today().isoformat()},
        ).json()

        assert data["total"] == 1

    def test_filter_by_amount_range(self, client, history):
        data = client.get(
            f"/api/v1/residents/{history['resident_id']}/payments",
            params={"min_amount": 1000, "max_amount": 2000},
        ).json()

        assert data["total"] == 2
        assert all(1000 <= float(row["amount_paid"]) <= 2000 for row in data["items"])

    def test_sort_by_amount_ascending(self, client, history):
        data = client.get(
            f"/api/v1/residents/{history['resident_id']}/payments",
            params={"sort": "amount_asc"},
        ).json()

        amounts = [float(row["amount_paid"]) for row in data["items"]]
        assert amounts == sorted(amounts)

    def test_default_sort_is_newest_first(self, client, history):
        data = client.get(f"/api/v1/residents/{history['resident_id']}/payments").json()
        dates = [row["paid_on"] for row in data["items"]]
        assert dates == sorted(dates, reverse=True)

    def test_pagination_keeps_totals_for_whole_result_set(self, client, history):
        data = client.get(
            f"/api/v1/residents/{history['resident_id']}/payments",
            params={"skip": 2, "limit": 2},
        ).json()

        assert data["total"] == 4
        assert len(data["items"]) == 2
        assert float(data["total_amount"]) == 6000.0

    def test_filters_are_echoed_back(self, client, history):
        data = client.get(
            f"/api/v1/residents/{history['resident_id']}/payments",
            params={"payment_method": "cash", "sort": "amount_desc"},
        ).json()

        assert data["filters"]["resident_id"] == history["resident_id"]
        assert data["filters"]["payment_method"] == "cash"
        assert data["filters"]["sort"] == "amount_desc"

    def test_reversed_date_range_returns_422(self, client, history):
        response = client.get(
            f"/api/v1/residents/{history['resident_id']}/payments",
            params={
                "date_from": date.today().isoformat(),
                "date_to": (date.today() - timedelta(days=5)).isoformat(),
            },
        )
        assert response.status_code == 422

    def test_reversed_amount_range_returns_422(self, client, history):
        response = client.get(
            f"/api/v1/residents/{history['resident_id']}/payments",
            params={"min_amount": 5000, "max_amount": 100},
        )
        assert response.status_code == 422

    def test_society_wide_history_spans_residents(self, client, db_session):
        first = seed_resident(db_session, name="Arun", flat_number="301")
        second = seed_resident(db_session, name="Divya", flat_number="302")
        bill_one = seed_bill(db_session, first)
        bill_two = seed_bill(db_session, second)
        seed_payment(db_session, bill_one, amount=1000.0, receipt_no="S1")
        seed_payment(db_session, bill_two, amount=2000.0, receipt_no="S2")

        data = client.get("/api/v1/billing/payments").json()
        assert data["total"] == 2
        assert float(data["total_amount"]) == 3000.0

        scoped = client.get("/api/v1/billing/payments", params={"resident_id": second}).json()
        assert scoped["total"] == 1


# ── GET /api/v1/bills/{bill_id}/late-fee ──────────────────────────────────────

class TestLateFeeComputation:

    def test_no_fee_before_due_date(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=-5)  # due in 5 days

        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()

        assert data["days_overdue"] == 0
        assert data["chargeable_days"] == 0
        assert data["within_grace"] is False
        assert float(data["late_fee"]) == 0.0

    def test_no_fee_inside_grace_period(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=DEFAULT_GRACE_DAYS)

        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()

        assert data["days_overdue"] == DEFAULT_GRACE_DAYS
        assert data["chargeable_days"] == 0
        assert data["within_grace"] is True
        assert float(data["late_fee"]) == 0.0

    def test_fee_starts_the_day_after_grace_ends(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=DEFAULT_GRACE_DAYS + 1)

        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()

        assert data["chargeable_days"] == 1
        assert data["within_grace"] is False
        expected = expected_daily_fee(Decimal("4484.00"), DEFAULT_RATE_PERCENT, 1)
        assert float(data["late_fee"]) == float(expected)
        assert float(data["late_fee"]) > 0

    def test_daily_proration_matches_the_documented_formula(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=52)  # 45 chargeable days

        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()

        assert data["chargeable_days"] == 45
        assert data["rules"]["proration"] == "daily"
        expected = expected_daily_fee(Decimal("4484.00"), DEFAULT_RATE_PERCENT, 45)
        assert float(data["late_fee"]) == float(expected)   # 1.5 months at 2% = 134.52

    def test_monthly_proration_charges_a_part_month_in_full(self, client, db_session):
        set_config(db_session, "late_fee_proration", "monthly")
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=52)  # 45 chargeable days

        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()

        assert data["rules"]["proration"] == "monthly"
        # 45 days rounds up to 2 whole months: 4484 × 2% × 2 = 179.36
        assert float(data["late_fee"]) == 179.36

    def test_proration_bases_agree_on_an_exact_month(self, client, db_session):
        """At exactly 30 chargeable days both bases must produce the same fee."""
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=DEFAULT_GRACE_DAYS + 30)

        daily = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()["late_fee"]
        set_config(db_session, "late_fee_proration", "monthly")
        monthly = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()["late_fee"]

        assert float(daily) == float(monthly) == 89.68

    def test_cap_limits_the_fee(self, client, db_session):
        set_config(db_session, "late_fee_max_percent", "5")
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=400)

        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()

        assert data["capped"] is True
        assert float(data["cap_amount"]) == 224.20     # 5% of 4484
        assert float(data["late_fee"]) == 224.20
        assert float(data["uncapped_late_fee"]) > 224.20

    def test_default_cap_applies_when_unset(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=2000)

        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()

        assert float(data["rules"]["max_percent"]) == float(DEFAULT_MAX_PERCENT)
        assert float(data["late_fee"]) == 896.80       # 20% of 4484
        assert data["capped"] is True

    def test_part_payment_shrinks_the_principal_the_fee_is_charged_on(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=37, status="partially_paid")
        seed_payment(db_session, bill, amount=2484.0)

        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()

        assert float(data["principal_outstanding"]) == 2000.0
        assert float(data["late_fee"]) == 40.0         # 2000 × 2% × 30/30
        assert float(data["total_payable"]) == 2040.0

    def test_fully_paid_bill_never_accrues(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=200, status="paid")
        seed_payment(db_session, bill, amount=4484.0, days_ago=150)

        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()

        assert float(data["principal_outstanding"]) == 0.0
        assert float(data["late_fee"]) == 0.0

    def test_fee_does_not_compound_on_an_existing_snapshot(self, client, db_session):
        """The fee is charged on the principal only — never on a previous fee."""
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=37, late_fee=500.0)

        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()

        assert float(data["principal_outstanding"]) == 4484.0
        assert float(data["late_fee"]) == 89.68

    def test_rules_are_read_from_apartment_config(self, client, db_session):
        set_config(db_session, "late_fee_grace_days", "0")
        set_config(db_session, "late_fee_rate_percent", "3")
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=30)

        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()

        assert data["rules"]["grace_days"] == 0
        assert float(data["rules"]["rate_percent"]) == 3.0
        assert data["chargeable_days"] == 30
        assert float(data["late_fee"]) == 134.52       # 4484 × 3% × 30/30

    def test_defaults_used_when_config_is_unset(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=10)

        rules = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()["rules"]

        assert rules["grace_days"] == DEFAULT_GRACE_DAYS
        assert float(rules["rate_percent"]) == float(DEFAULT_RATE_PERCENT)
        assert rules["proration"] == "daily"

    def test_zero_rate_produces_no_fee(self, client, db_session):
        set_config(db_session, "late_fee_rate_percent", "0")
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=90)

        data = client.get(f"/api/v1/bills/{bill.bill_id}/late-fee").json()
        assert float(data["late_fee"]) == 0.0

    def test_as_of_in_the_future_projects_the_fee(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=0)
        as_of = (date.today() + timedelta(days=67)).isoformat()

        data = client.get(
            f"/api/v1/bills/{bill.bill_id}/late-fee", params={"as_of": as_of}
        ).json()

        assert data["chargeable_days"] == 60
        assert float(data["late_fee"]) == 179.36       # two months at 2%

    def test_late_fee_bill_not_found(self, client, db_session):
        response = client.get("/api/v1/bills/does-not-exist/late-fee")
        assert response.status_code == 404


# ── POST /api/v1/bills/{bill_id}/late-fee/accrue ──────────────────────────────

class TestLateFeeAccrual:

    def test_accrual_persists_the_snapshot_and_marks_overdue(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=37)

        response = client.post(f"/api/v1/bills/{bill.bill_id}/late-fee/accrue")

        assert response.status_code == 200
        data = response.json()
        assert float(data["previous_late_fee"]) == 0.0
        assert float(data["late_fee"]) == 89.68
        assert data["late_fee_accrued_till"] == date.today().isoformat()
        assert data["status"] == "overdue"

        db_session.expire_all()
        from app.models.payment import Bill
        stored = db_session.query(Bill).filter(Bill.bill_id == bill.bill_id).first()
        assert float(stored.late_fee) == 89.68
        assert stored.status == "overdue"

    def test_accrual_records_the_rules_that_were_in_force(self, client, db_session):
        set_config(db_session, "late_fee_grace_days", "3")
        set_config(db_session, "late_fee_rate_percent", "1.5")
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=33)

        client.post(f"/api/v1/bills/{bill.bill_id}/late-fee/accrue")

        db_session.expire_all()
        from app.models.payment import Bill
        stored = db_session.query(Bill).filter(Bill.bill_id == bill.bill_id).first()
        assert stored.late_fee_grace_days == 3
        assert float(stored.late_fee_rate_percent) == 1.5

    def test_accrual_is_idempotent_on_the_same_date(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=37)

        first = client.post(f"/api/v1/bills/{bill.bill_id}/late-fee/accrue").json()
        second = client.post(f"/api/v1/bills/{bill.bill_id}/late-fee/accrue").json()

        assert float(first["late_fee"]) == float(second["late_fee"])
        assert float(second["previous_late_fee"]) == float(first["late_fee"])

    def test_accrual_inside_grace_writes_zero_and_leaves_status_pending(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=3)

        data = client.post(f"/api/v1/bills/{bill.bill_id}/late-fee/accrue").json()

        assert float(data["late_fee"]) == 0.0
        assert data["status"] == "pending"

    def test_accrual_keeps_partially_paid_status(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=37, status="partially_paid")
        seed_payment(db_session, bill, amount=1000.0)

        data = client.post(f"/api/v1/bills/{bill.bill_id}/late-fee/accrue").json()

        assert data["status"] == "partially_paid"
        assert float(data["late_fee"]) == 69.68       # 3484 × 2% × 30/30

    def test_accrual_on_a_paid_bill_returns_409(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=90, status="paid")

        response = client.post(f"/api/v1/bills/{bill.bill_id}/late-fee/accrue")

        assert response.status_code == 409
        assert "already paid" in response.json()["detail"]

    def test_accrual_bill_not_found(self, client, db_session):
        response = client.post("/api/v1/bills/does-not-exist/late-fee/accrue")
        assert response.status_code == 404

    def test_accrual_with_as_of(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=0)
        as_of = (date.today() + timedelta(days=37)).isoformat()

        data = client.post(
            f"/api/v1/bills/{bill.bill_id}/late-fee/accrue", params={"as_of": as_of}
        ).json()

        assert data["late_fee_accrued_till"] == as_of
        assert float(data["late_fee"]) == 89.68


# ── POST /api/v1/bills/late-fee/accrue (bulk) ─────────────────────────────────

class TestBulkLateFeeAccrual:

    def test_bulk_accrual_covers_every_outstanding_bill(self, client, db_session):
        resident_id = seed_resident(db_session)
        seed_bill(db_session, resident_id, due_days_ago=37, billing_month="2024-05")
        seed_bill(db_session, resident_id, due_days_ago=67, billing_month="2024-04")
        seed_bill(db_session, resident_id, due_days_ago=3, billing_month="2024-06")
        seed_bill(db_session, resident_id, due_days_ago=90, billing_month="2024-03", status="paid")

        response = client.post("/api/v1/bills/late-fee/accrue")

        assert response.status_code == 200
        data = response.json()
        assert data["bills_evaluated"] == 3            # the paid bill is not evaluated
        assert data["bills_updated"] == 3              # all three get an accrued_till date
        assert data["bills_marked_overdue"] == 2       # the in-grace bill stays pending
        assert float(data["total_late_fee_added"]) == 89.68 + 179.36
        assert data["as_of"] == date.today().isoformat()

    def test_bulk_accrual_is_idempotent(self, client, db_session):
        resident_id = seed_resident(db_session)
        seed_bill(db_session, resident_id, due_days_ago=37)

        client.post("/api/v1/bills/late-fee/accrue")
        second = client.post("/api/v1/bills/late-fee/accrue").json()

        assert second["bills_evaluated"] == 1
        assert second["bills_updated"] == 0
        assert float(second["total_late_fee_added"]) == 0.0

    def test_bulk_accrual_with_no_bills(self, client, db_session):
        data = client.post("/api/v1/bills/late-fee/accrue").json()
        assert data["bills_evaluated"] == 0
        assert data["bills_updated"] == 0
        assert float(data["total_late_fee_added"]) == 0.0

    def test_bulk_accrual_reflected_in_the_statement(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = seed_bill(db_session, resident_id, due_days_ago=37)

        client.post("/api/v1/bills/late-fee/accrue")
        data = client.get(f"/api/v1/bills/{bill.bill_id}/statement").json()

        assert data["late_fee_accrued_till"] == date.today().isoformat()
        assert float(data["late_fee"]) == 89.68
        assert float(data["outstanding"]) == 4573.68
        assert data["status"] == "overdue"


# ── Late-fee config validation (BE-40 keys used by BE-28) ─────────────────────

class TestLateFeeConfigValidation:

    @pytest.mark.parametrize(
        "key,value",
        [
            ("late_fee_grace_days", "7"),
            ("late_fee_rate_percent", "2.5"),
            ("late_fee_max_percent", "15"),
            ("late_fee_proration", "monthly"),
        ],
    )
    def test_valid_values_accepted(self, db_session, key, value):
        from app.services import settings_service
        settings_service.ALLOWED_CONFIG_KEYS[key](value)   # must not raise

    @pytest.mark.parametrize(
        "key,value",
        [
            ("late_fee_grace_days", "-1"),
            ("late_fee_grace_days", "91"),
            ("late_fee_grace_days", "seven"),
            ("late_fee_rate_percent", "-2"),
            ("late_fee_rate_percent", "11"),
            ("late_fee_max_percent", "101"),
            ("late_fee_proration", "weekly"),
        ],
    )
    def test_invalid_values_rejected(self, db_session, key, value):
        from app.services import settings_service
        with pytest.raises(ValueError):
            settings_service.ALLOWED_CONFIG_KEYS[key](value)

    def test_corrupt_config_value_falls_back_to_defaults(self, db_session):
        """A bad row written directly to the DB must not take the billing API down."""
        from app.services import billing_service
        set_config(db_session, "late_fee_grace_days", "not-a-number")
        set_config(db_session, "late_fee_proration", "weekly")

        rules = billing_service.resolve_late_fee_rules(db_session)

        assert rules.grace_days == DEFAULT_GRACE_DAYS
        assert rules.proration.value == "daily"
