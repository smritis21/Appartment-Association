"""
EN-11 — Harden Payment Flow.

Additional tests beyond test_payments.py:
  - Gateway timeout / interrupted payment (simulate_timeout)
  - Cancelled bill cannot be paid
  - Duplicate payment on same bill is blocked
  - Failed payment record is persisted for audit but bill stays unpaid
  - simulate_timeout flag wires through to 402
  - Duplicate bill for same resident+month is rejected (EN-28 guard in BE-11)
"""

from datetime import date, timedelta


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_flat(db_session):
    from app.models.resident import Flat
    flat = Flat(block="A", floor="1", flat_number="101",
                ownership_type="owned", occupancy_status="occupied")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    return flat.flat_id


def seed_resident(db_session):
    from app.models.resident import Resident
    resident = Resident(
        flat_id=seed_flat(db_session),
        name="Hardening Resident",
        phone="9000000099",
        status="active",
    )
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def future_date(days: int = 10) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def create_bill(client, resident_id, billing_month="2024-03"):
    resp = client.post("/api/v1/bills", json={
        "resident_id": resident_id,
        "billing_month": billing_month,
        "maintenance": 3000,
        "water": 500,
        "parking": 200,
        "miscellaneous": 100,
        "discount": 0,
        "due_date": future_date(),
    })
    assert resp.status_code == 201
    return resp.json()


def pay(client, bill_id, amount=4484.0, method="upi",
        simulate_failure=False, simulate_timeout=False):
    return client.post("/api/v1/payments", json={
        "bill_id": bill_id,
        "amount_paid": amount,
        "payment_method": method,
        "gateway": {
            "mock_reference": "resident@mockupi",
            "simulate_failure": simulate_failure,
            "simulate_timeout": simulate_timeout,
        },
    })


# ── Gateway timeout / interrupted payment ─────────────────────────────────────

class TestGatewayTimeout:

    def test_timeout_returns_402(self, client, db_session):
        rid = seed_resident(db_session)
        bill = create_bill(client, rid)
        resp = pay(client, bill["bill_id"], simulate_timeout=True)
        assert resp.status_code == 402
        assert "timeout" in resp.json()["detail"].lower()

    def test_timeout_leaves_bill_unpaid(self, client, db_session):
        rid = seed_resident(db_session)
        bill = create_bill(client, rid)
        pay(client, bill["bill_id"], simulate_timeout=True)
        updated = client.get(f"/api/v1/bills/{bill['bill_id']}").json()
        assert updated["status"] == "pending"

    def test_timeout_persists_failed_payment_for_audit(self, client, db_session):
        """A timed-out attempt must still be recorded so the audit trail is complete."""
        rid = seed_resident(db_session)
        bill = create_bill(client, rid)
        pay(client, bill["bill_id"], simulate_timeout=True)
        detail = client.get(f"/api/v1/bills/{bill['bill_id']}").json()
        assert len(detail["payments"]) == 1
        assert detail["payments"][0]["status"] == "failed"

    def test_interrupted_payment_then_retry_succeeds(self, client, db_session):
        """After a timeout the resident can retry and succeed."""
        rid = seed_resident(db_session)
        bill = create_bill(client, rid)
        pay(client, bill["bill_id"], simulate_timeout=True)
        resp = pay(client, bill["bill_id"])
        assert resp.status_code == 201
        assert resp.json()["status"] == "paid"


# ── Cancelled bill ────────────────────────────────────────────────────────────

class TestCancelledBill:

    def test_cancelled_bill_cannot_be_paid(self, client, db_session):
        from app.models.payment import Bill
        rid = seed_resident(db_session)
        bill = create_bill(client, rid)
        row = db_session.query(Bill).filter(Bill.bill_id == bill["bill_id"]).first()
        row.status = "cancelled"
        db_session.commit()

        resp = pay(client, bill["bill_id"])
        assert resp.status_code == 400
        assert "cancelled" in resp.json()["detail"].lower()


# ── Duplicate payment guard ───────────────────────────────────────────────────

class TestDuplicatePayment:

    def test_second_full_payment_on_paid_bill_rejected(self, client, db_session):
        rid = seed_resident(db_session)
        bill = create_bill(client, rid)
        pay(client, bill["bill_id"])
        resp = pay(client, bill["bill_id"])
        assert resp.status_code == 400
        assert "already been paid" in resp.json()["detail"].lower()

    def test_failed_payment_does_not_block_retry(self, client, db_session):
        rid = seed_resident(db_session)
        bill = create_bill(client, rid)
        pay(client, bill["bill_id"], simulate_failure=True)
        resp = pay(client, bill["bill_id"])
        assert resp.status_code == 201


# ── Duplicate bill for same period (EN-28 guard surfaced via BE-11) ───────────

class TestDuplicateBillPrevention:

    def test_duplicate_bill_same_resident_same_month_rejected(self, client, db_session):
        rid = seed_resident(db_session)
        r1 = client.post("/api/v1/bills", json={
            "resident_id": rid,
            "billing_month": "2024-05",
            "maintenance": 3000,
            "due_date": future_date(),
        })
        assert r1.status_code == 201

        r2 = client.post("/api/v1/bills", json={
            "resident_id": rid,
            "billing_month": "2024-05",
            "maintenance": 3000,
            "due_date": future_date(),
        })
        assert r2.status_code == 409
        assert "already exists" in r2.json()["detail"].lower()

    def test_same_month_different_resident_allowed(self, client, db_session):
        r1 = seed_resident(db_session)
        r2 = seed_resident(db_session)
        resp1 = client.post("/api/v1/bills", json={
            "resident_id": r1, "billing_month": "2024-05",
            "maintenance": 3000, "due_date": future_date(),
        })
        resp2 = client.post("/api/v1/bills", json={
            "resident_id": r2, "billing_month": "2024-05",
            "maintenance": 3000, "due_date": future_date(),
        })
        assert resp1.status_code == 201
        assert resp2.status_code == 201

    def test_same_resident_different_month_allowed(self, client, db_session):
        rid = seed_resident(db_session)
        resp1 = client.post("/api/v1/bills", json={
            "resident_id": rid, "billing_month": "2024-05",
            "maintenance": 3000, "due_date": future_date(),
        })
        resp2 = client.post("/api/v1/bills", json={
            "resident_id": rid, "billing_month": "2024-06",
            "maintenance": 3000, "due_date": future_date(),
        })
        assert resp1.status_code == 201
        assert resp2.status_code == 201


# ── Declined payment audit trail ──────────────────────────────────────────────

class TestDeclinedPayment:

    def test_declined_payment_stored_with_failed_status(self, client, db_session):
        rid = seed_resident(db_session)
        bill = create_bill(client, rid)
        pay(client, bill["bill_id"], simulate_failure=True)
        detail = client.get(f"/api/v1/bills/{bill['bill_id']}").json()
        assert len(detail["payments"]) == 1
        assert detail["payments"][0]["status"] == "failed"

    def test_declined_payment_does_not_change_bill_status(self, client, db_session):
        rid = seed_resident(db_session)
        bill = create_bill(client, rid)
        pay(client, bill["bill_id"], simulate_failure=True)
        detail = client.get(f"/api/v1/bills/{bill['bill_id']}").json()
        assert detail["status"] == "pending"
