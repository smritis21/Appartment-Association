"""
pytest tests for BE-11 — Payment API.

Covers:
  Bills:
    - Create bill (success, resident not found, past due date, validation)
    - Get bill (success, not found)
    - List bills (all, by resident, by status, pagination)

  Payments:
    - Process payment (success, gateway failure, bill not found)
    - Bill already paid, overpayment, partial payment
    - Receipt fields (receipt_no, transaction_ref format)
    - Get payment (success, not found)
    - Payment history by resident

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import date, timedelta
from decimal import Decimal


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_flat(db_session):
    from app.models.resident import Flat
    flat = Flat(block="B", floor="2", flat_number="202",
                ownership_type="owned", occupancy_status="vacant")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    return flat.flat_id


def seed_resident(db_session):
    from app.models.resident import Resident
    flat_id = seed_flat(db_session)
    resident = Resident(
        flat_id=flat_id,
        name="Meera Nair",
        phone="9123456789",
        status="active",
    )
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def future_date(days: int = 10) -> str:
    return (date.today() + timedelta(days=days)).isoformat()


def past_date(days: int = 5) -> str:
    return (date.today() - timedelta(days=days)).isoformat()


def bill_payload(resident_id: str, **overrides) -> dict:
    payload = {
        "resident_id":   resident_id,
        "billing_month": "2024-03",
        "maintenance":   3000,
        "water":         500,
        "parking":       200,
        "miscellaneous": 100,
        "discount":      0,
        "due_date":      future_date(10),
    }
    payload.update(overrides)
    return payload


def payment_payload(bill_id: str, amount: float = 4484.0, **overrides) -> dict:
    payload = {
        "bill_id":        bill_id,
        "amount_paid":    amount,
        "payment_method": "upi",
        "gateway": {
            "mock_reference":   "resident@mockupi",
            "simulate_failure": False,
        },
    }
    payload.update(overrides)
    return payload


# ── POST /api/v1/bills ────────────────────────────────────────────────────────

class TestCreateBill:

    def test_create_bill_success(self, client, db_session):
        resident_id = seed_resident(db_session)
        response = client.post("/api/v1/bills", json=bill_payload(resident_id))

        assert response.status_code == 201
        data = response.json()
        assert data["resident_id"] == resident_id
        assert data["billing_month"] == "2024-03"
        assert data["status"] == "pending"
        assert "bill_id" in data
        # GST = 18% of (3000+500+200+100-0) = 18% of 3800 = 684
        assert float(data["gst"]) == 684.0
        assert float(data["total_amount"]) == 4484.0

    def test_create_bill_resident_not_found(self, client, db_session):
        response = client.post("/api/v1/bills", json=bill_payload("non-existent-resident"))
        assert response.status_code == 404
        assert "Resident" in response.json()["detail"]

    def test_create_bill_past_due_date(self, client, db_session):
        resident_id = seed_resident(db_session)
        response = client.post(
            "/api/v1/bills",
            json=bill_payload(resident_id, due_date=past_date(5)),
        )
        assert response.status_code == 422

    def test_create_bill_invalid_billing_month_format(self, client, db_session):
        resident_id = seed_resident(db_session)
        response = client.post(
            "/api/v1/bills",
            json=bill_payload(resident_id, billing_month="March-2024"),
        )
        assert response.status_code == 422

    def test_create_bill_negative_amount(self, client, db_session):
        resident_id = seed_resident(db_session)
        response = client.post(
            "/api/v1/bills",
            json=bill_payload(resident_id, maintenance=-100),
        )
        assert response.status_code == 422

    def test_create_bill_gst_calculated_correctly(self, client, db_session):
        """GST = 18% of subtotal after discount."""
        resident_id = seed_resident(db_session)
        response = client.post(
            "/api/v1/bills",
            json=bill_payload(resident_id, maintenance=1000, water=0,
                              parking=0, miscellaneous=0, discount=100),
        )
        assert response.status_code == 201
        data = response.json()
        # subtotal = 1000 - 100 = 900; GST = 162; total = 1062
        assert float(data["gst"]) == 162.0
        assert float(data["total_amount"]) == 1062.0


# ── GET /api/v1/bills ─────────────────────────────────────────────────────────

class TestGetBill:

    def test_get_bill_success(self, client, db_session):
        resident_id = seed_resident(db_session)
        created = client.post("/api/v1/bills", json=bill_payload(resident_id)).json()
        bill_id = created["bill_id"]

        response = client.get(f"/api/v1/bills/{bill_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["bill_id"] == bill_id
        assert data["payments"] == []

    def test_get_bill_not_found(self, client, db_session):
        response = client.get("/api/v1/bills/does-not-exist")
        assert response.status_code == 404

    def test_list_bills_all(self, client, db_session):
        resident_id = seed_resident(db_session)
        client.post("/api/v1/bills", json=bill_payload(resident_id, billing_month="2024-01"))
        client.post("/api/v1/bills", json=bill_payload(resident_id, billing_month="2024-02"))

        response = client.get("/api/v1/bills")
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_list_bills_by_resident(self, client, db_session):
        r1 = seed_resident(db_session)
        r2 = seed_resident(db_session)
        client.post("/api/v1/bills", json=bill_payload(r1))
        client.post("/api/v1/bills", json=bill_payload(r2))

        response = client.get(f"/api/v1/bills?resident_id={r1}")
        assert response.status_code == 200
        results = response.json()
        assert len(results) == 1
        assert results[0]["resident_id"] == r1

    def test_list_bills_by_status(self, client, db_session):
        resident_id = seed_resident(db_session)
        client.post("/api/v1/bills", json=bill_payload(resident_id))

        pending = client.get("/api/v1/bills?status=pending").json()
        paid    = client.get("/api/v1/bills?status=paid").json()

        assert len(pending) == 1
        assert len(paid) == 0

    def test_list_bills_pagination(self, client, db_session):
        resident_id = seed_resident(db_session)
        months = ["2024-01", "2024-02", "2024-03", "2024-04", "2024-05"]
        for m in months:
            client.post("/api/v1/bills", json=bill_payload(resident_id, billing_month=m))

        page1 = client.get("/api/v1/bills?skip=0&limit=3").json()
        page2 = client.get("/api/v1/bills?skip=3&limit=3").json()
        assert len(page1) == 3
        assert len(page2) == 2


# ── POST /api/v1/payments ─────────────────────────────────────────────────────

class TestProcessPayment:

    def test_payment_success_upi(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = client.post("/api/v1/bills", json=bill_payload(resident_id)).json()

        response = client.post("/api/v1/payments", json=payment_payload(bill["bill_id"]))
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "paid"
        assert data["receipt_no"].startswith("PAY-")
        assert data["transaction_ref"] != ""
        assert data["billing_month"] == "2024-03"
        assert float(data["amount_paid"]) == 4484.0

    def test_payment_success_cash(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = client.post("/api/v1/bills", json=bill_payload(resident_id)).json()

        response = client.post(
            "/api/v1/payments",
            json=payment_payload(bill["bill_id"], payment_method="cash"),
        )
        assert response.status_code == 201
        assert response.json()["status"] == "paid"

    def test_payment_updates_bill_status_to_paid(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = client.post("/api/v1/bills", json=bill_payload(resident_id)).json()
        client.post("/api/v1/payments", json=payment_payload(bill["bill_id"]))

        updated_bill = client.get(f"/api/v1/bills/{bill['bill_id']}").json()
        assert updated_bill["status"] == "paid"

    def test_payment_partial_updates_bill_status(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = client.post("/api/v1/bills", json=bill_payload(resident_id)).json()

        # Pay less than the total
        response = client.post(
            "/api/v1/payments",
            json=payment_payload(bill["bill_id"], amount=2000.0),
        )
        assert response.status_code == 201

        updated_bill = client.get(f"/api/v1/bills/{bill['bill_id']}").json()
        assert updated_bill["status"] == "partially_paid"

    def test_payment_gateway_failure(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = client.post("/api/v1/bills", json=bill_payload(resident_id)).json()

        payload = payment_payload(bill["bill_id"])
        payload["gateway"]["simulate_failure"] = True

        response = client.post("/api/v1/payments", json=payload)
        assert response.status_code == 402
        assert "declined" in response.json()["detail"].lower()

    def test_payment_bill_not_found(self, client, db_session):
        response = client.post(
            "/api/v1/payments",
            json=payment_payload("non-existent-bill-id"),
        )
        assert response.status_code == 404

    def test_payment_bill_already_paid(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = client.post("/api/v1/bills", json=bill_payload(resident_id)).json()
        # First payment — succeeds
        client.post("/api/v1/payments", json=payment_payload(bill["bill_id"]))
        # Second payment — should fail
        response = client.post("/api/v1/payments", json=payment_payload(bill["bill_id"]))
        assert response.status_code == 400
        assert "already been paid" in response.json()["detail"].lower()

    def test_payment_overpayment_rejected(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = client.post("/api/v1/bills", json=bill_payload(resident_id)).json()

        response = client.post(
            "/api/v1/payments",
            json=payment_payload(bill["bill_id"], amount=99999.0),
        )
        assert response.status_code == 400
        assert "exceeds" in response.json()["detail"].lower()

    def test_payment_zero_amount_rejected(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = client.post("/api/v1/bills", json=bill_payload(resident_id)).json()

        response = client.post(
            "/api/v1/payments",
            json=payment_payload(bill["bill_id"], amount=0),
        )
        assert response.status_code == 422

    def test_payment_invalid_method_rejected(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = client.post("/api/v1/bills", json=bill_payload(resident_id)).json()

        payload = payment_payload(bill["bill_id"])
        payload["payment_method"] = "bitcoin"
        response = client.post("/api/v1/payments", json=payload)
        assert response.status_code == 422

    def test_receipt_no_format(self, client, db_session):
        """Receipt number must follow PAY-YYYYMMDD-XXXXXXXX format."""
        import re
        resident_id = seed_resident(db_session)
        bill = client.post("/api/v1/bills", json=bill_payload(resident_id)).json()
        receipt = client.post("/api/v1/payments", json=payment_payload(bill["bill_id"])).json()

        assert re.match(r"^PAY-\d{8}-[A-F0-9]{8}$", receipt["receipt_no"])

    def test_each_payment_gets_unique_receipt_no(self, client, db_session):
        """Two payments on different bills must have different receipt numbers."""
        r1 = seed_resident(db_session)
        r2 = seed_resident(db_session)
        b1 = client.post("/api/v1/bills", json=bill_payload(r1, billing_month="2024-01")).json()
        b2 = client.post("/api/v1/bills", json=bill_payload(r2, billing_month="2024-02")).json()

        p1 = client.post("/api/v1/payments", json=payment_payload(b1["bill_id"])).json()
        p2 = client.post("/api/v1/payments", json=payment_payload(b2["bill_id"])).json()

        assert p1["receipt_no"] != p2["receipt_no"]


# ── GET /api/v1/payments ──────────────────────────────────────────────────────

class TestGetPayment:

    def test_get_payment_success(self, client, db_session):
        resident_id = seed_resident(db_session)
        bill = client.post("/api/v1/bills", json=bill_payload(resident_id)).json()
        receipt = client.post("/api/v1/payments", json=payment_payload(bill["bill_id"])).json()

        response = client.get(f"/api/v1/payments/{receipt['payment_id']}")
        assert response.status_code == 200
        data = response.json()
        assert data["payment_id"] == receipt["payment_id"]
        assert data["receipt_no"] == receipt["receipt_no"]

    def test_get_payment_not_found(self, client, db_session):
        response = client.get("/api/v1/payments/does-not-exist")
        assert response.status_code == 404

    def test_payment_history_by_resident(self, client, db_session):
        resident_id = seed_resident(db_session)
        b1 = client.post("/api/v1/bills", json=bill_payload(resident_id, billing_month="2024-01")).json()
        b2 = client.post("/api/v1/bills", json=bill_payload(resident_id, billing_month="2024-02")).json()
        client.post("/api/v1/payments", json=payment_payload(b1["bill_id"]))
        client.post("/api/v1/payments", json=payment_payload(b2["bill_id"]))

        response = client.get(f"/api/v1/payments/resident/{resident_id}")
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_payment_history_empty_for_new_resident(self, client, db_session):
        resident_id = seed_resident(db_session)
        response = client.get(f"/api/v1/payments/resident/{resident_id}")
        assert response.status_code == 200
        assert response.json() == []
