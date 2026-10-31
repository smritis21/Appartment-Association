"""
INT-11/12/28/29/30/31/33/34 — Frontend/Backend Integration Tests.

Validates the complete end-to-end API flows that the frontend service
files (paymentService, reminderService, forumService, marketplaceService,
eventsService, templeService, communityService) depend on.

Each test class mirrors one INT story and exercises the exact HTTP calls
the corresponding frontend service makes.
"""

from datetime import date, timedelta
import pytest

# ── Shared helpers ─────────────────────────────────────────────────────────────

def _future(days=10):
    return (date.today() + timedelta(days=days)).isoformat()


def _past(days=5):
    return (date.today() - timedelta(days=days)).isoformat()


def _seed_flat(db):
    from app.models.resident import Flat
    f = Flat(block="T", floor="1", flat_number="INT01",
             ownership_type="owned", occupancy_status="occupied")
    db.add(f); db.commit(); db.refresh(f)
    return f.flat_id


def _seed_resident(db):
    from app.models.resident import Resident
    r = Resident(flat_id=_seed_flat(db), name="INT Resident",
                 phone="9111111111", status="active")
    db.add(r); db.commit(); db.refresh(r)
    return r.resident_id


def _create_bill(client, resident_id, month="2025-06"):
    resp = client.post("/api/v1/bills", json={
        "resident_id": resident_id,
        "billing_month": month,
        "maintenance": 3500,
        "water": 400,
        "parking": 500,
        "due_date": _future(10),
    })
    assert resp.status_code == 201
    return resp.json()


def _pay_bill_exact(client, bill):
    """Pay the exact total_amount from the bill object so status → paid."""
    resp = client.post("/api/v1/payments", json={
        "bill_id": bill["bill_id"],
        "amount_paid": float(bill["total_amount"]),
        "payment_method": "upi",
        "gateway": {"mock_reference": "test@upi"},
    })
    return resp


# ── INT-11: Online Payment ─────────────────────────────────────────────────────

class TestINT11OnlinePayment:
    """Bills → Pay → Receipt → History flow."""

    def test_successful_payment_returns_receipt_fields(self, client, db_session):
        rid = _seed_resident(db_session)
        bill = _create_bill(client, rid)
        resp = _pay_bill_exact(client, bill)
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == "paid"
        assert data["receipt_no"] is not None
        assert data["transaction_ref"] is not None

    def test_payment_updates_bill_status_to_paid(self, client, db_session):
        rid = _seed_resident(db_session)
        bill = _create_bill(client, rid)
        _pay_bill_exact(client, bill)
        updated = client.get(f"/api/v1/bills/{bill['bill_id']}").json()
        assert updated["status"] == "paid"

    def test_gateway_failure_returns_402(self, client, db_session):
        rid = _seed_resident(db_session)
        bill = _create_bill(client, rid)
        resp = client.post("/api/v1/payments", json={
            "bill_id": bill["bill_id"],
            "amount_paid": float(bill["total_amount"]),
            "payment_method": "upi",
            "gateway": {"simulate_failure": True},
        })
        assert resp.status_code == 402

    def test_gateway_timeout_returns_402(self, client, db_session):
        rid = _seed_resident(db_session)
        bill = _create_bill(client, rid)
        resp = client.post("/api/v1/payments", json={
            "bill_id": bill["bill_id"],
            "amount_paid": float(bill["total_amount"]),
            "payment_method": "upi",
            "gateway": {"simulate_timeout": True},
        })
        assert resp.status_code == 402
        assert "timeout" in resp.json()["detail"].lower()

    def test_receipt_endpoint_returns_payment_details(self, client, db_session):
        rid = _seed_resident(db_session)
        bill = _create_bill(client, rid)
        payment = _pay_bill_exact(client, bill).json()
        pid = payment["payment_id"]
        resp = client.get(f"/api/v1/payments/{pid}/receipt")
        assert resp.status_code == 200
        data = resp.json()
        assert data["payment_id"] == pid

    def test_payment_history_includes_new_payment(self, client, db_session):
        rid = _seed_resident(db_session)
        bill = _create_bill(client, rid)
        payment = _pay_bill_exact(client, bill).json()
        history = client.get(f"/api/v1/payments/resident/{rid}").json()
        ids = [p["payment_id"] for p in history]
        assert payment["payment_id"] in ids


# ── INT-12: Payment Reminders ──────────────────────────────────────────────────

class TestINT12PaymentReminders:
    """Reminder generation, listing, and dismissal."""

    def test_send_reminder_persists(self, client, db_session):
        rid = _seed_resident(db_session)
        bill = _create_bill(client, rid)
        resp = client.post("/api/v1/reminders", json={
            "bill_id": bill["bill_id"],
            "resident_id": rid,
            "reminder_type": "first_notice",
            "channel": "in_app",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["reminder_id"] is not None
        assert data["status"] == "sent"

    def test_reminders_list_returns_sent_reminder(self, client, db_session):
        rid = _seed_resident(db_session)
        bill = _create_bill(client, rid)
        client.post("/api/v1/reminders", json={
            "bill_id": bill["bill_id"],
            "resident_id": rid,
            "reminder_type": "second_notice",
            "channel": "in_app",
        })
        resp = client.get(f"/api/v1/reminders?resident_id={rid}")
        assert resp.status_code == 200
        items = resp.json().get("items", resp.json())
        assert len(items) >= 1

    def test_dismiss_reminder(self, client, db_session):
        rid = _seed_resident(db_session)
        bill = _create_bill(client, rid)
        reminder = client.post("/api/v1/reminders", json={
            "bill_id": bill["bill_id"],
            "resident_id": rid,
            "reminder_type": "final_notice",
            "channel": "in_app",
        }).json()
        resp = client.put(f"/api/v1/reminders/{reminder['reminder_id']}/dismiss")
        assert resp.status_code == 200
        assert resp.json()["status"] == "dismissed"

    def test_reminder_stats_endpoint(self, client, db_session):
        resp = client.get("/api/v1/reminders/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data


# ── INT-28: Billing ────────────────────────────────────────────────────────────

class TestINT28Billing:
    """Bills list, late fee, statement, pay → history flow."""

    def test_bills_list_endpoint(self, client, db_session):
        rid = _seed_resident(db_session)
        _create_bill(client, rid, month="2025-07")
        resp = client.get("/api/v1/bills")
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_late_fee_endpoint_for_overdue_bill(self, client, db_session):
        from app.models.payment import Bill
        rid = _seed_resident(db_session)
        # Create with future due_date (past date → 422), then force overdue via DB
        bill = _create_bill(client, rid, month="2025-08")
        row = db_session.query(Bill).filter(Bill.bill_id == bill["bill_id"]).first()
        row.status = "overdue"
        row.due_date = date.today() - timedelta(days=5)
        db_session.commit()
        resp = client.get(f"/api/v1/bills/{bill['bill_id']}/late-fee")
        assert resp.status_code == 200
        data = resp.json()
        assert "late_fee" in data

    def test_bill_statement_endpoint(self, client, db_session):
        rid = _seed_resident(db_session)
        bill = _create_bill(client, rid, month="2025-09")
        resp = client.get(f"/api/v1/bills/{bill['bill_id']}/statement")
        assert resp.status_code == 200

    def test_pay_bill_updates_status_immediately(self, client, db_session):
        rid = _seed_resident(db_session)
        bill = _create_bill(client, rid, month="2025-10")
        _pay_bill_exact(client, bill)
        updated = client.get(f"/api/v1/bills/{bill['bill_id']}").json()
        assert updated["status"] == "paid"

    def test_api_error_on_nonexistent_bill(self, client):
        resp = client.get("/api/v1/bills/BILL-NONEXISTENT-999")
        assert resp.status_code == 404


# ── INT-29: Forum ──────────────────────────────────────────────────────────────

class TestINT29Forum:
    """Post → Comment → list flow."""

    def test_create_post_persists(self, client):
        resp = client.post("/api/v1/forum/posts", json={
            "title": "INT-29 Test Post",
            "body": "Integration test body.",
            "category": "general",
            "author_id": "int-resident",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["post_id"] is not None
        assert data["title"] == "INT-29 Test Post"

    def test_post_appears_in_list(self, client):
        client.post("/api/v1/forum/posts", json={
            "title": "Listable Post INT29",
            "body": "Body.",
            "category": "general",
        })
        resp = client.get("/api/v1/forum/posts")
        assert resp.status_code == 200
        titles = [p["title"] for p in resp.json()["posts"]]
        assert "Listable Post INT29" in titles

    def test_create_comment_persists(self, client):
        post = client.post("/api/v1/forum/posts", json={
            "title": "Comment Target",
            "body": "Body.",
            "category": "general",
        }).json()
        resp = client.post(f"/api/v1/forum/posts/{post['post_id']}/comments", json={
            "body": "INT-29 comment",
            "author_id": "commenter",
        })
        assert resp.status_code == 201
        assert resp.json()["body"] == "INT-29 comment"

    def test_comments_list_includes_new_comment(self, client):
        post = client.post("/api/v1/forum/posts", json={
            "title": "Comment List Target",
            "body": "Body.",
            "category": "general",
        }).json()
        client.post(f"/api/v1/forum/posts/{post['post_id']}/comments", json={
            "body": "Persisted comment",
        })
        resp = client.get(f"/api/v1/forum/posts/{post['post_id']}/comments")
        assert resp.status_code == 200
        bodies = [c["body"] for c in resp.json()["comments"]]
        assert "Persisted comment" in bodies

    def test_invalid_category_returns_422(self, client):
        resp = client.post("/api/v1/forum/posts", json={
            "title": "Bad Cat",
            "body": "Body.",
            "category": "invalid_category",
        })
        assert resp.status_code == 422


# ── INT-30: Marketplace ────────────────────────────────────────────────────────

class TestINT30Marketplace:
    """Listing → Browse → Wishlist → Sold flow."""

    def test_create_listing_persists(self, client, db_session):
        rid = _seed_resident(db_session)
        resp = client.post("/api/v1/marketplace/listings", json={
            "resident_id": rid,
            "title": "INT-30 Test Item",
            "price": 500,
            "category": "Furniture",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["listing_id"] is not None
        assert data["status"] == "available"

    def test_listing_appears_in_browse(self, client, db_session):
        rid = _seed_resident(db_session)
        client.post("/api/v1/marketplace/listings", json={
            "resident_id": rid,
            "title": "Browsable Item INT30",
            "price": 200,
            "category": "Electronics",
        })
        resp = client.get("/api/v1/marketplace/listings")
        assert resp.status_code == 200
        titles = [l["title"] for l in resp.json()]
        assert "Browsable Item INT30" in titles

    def test_add_to_wishlist_persists(self, client, db_session):
        rid = _seed_resident(db_session)
        listing = client.post("/api/v1/marketplace/listings", json={
            "resident_id": rid,
            "title": "Wishlist Item",
            "price": 100,
            "category": "Books",
        }).json()
        # Use a different resident for wishlist (can't wishlist own listing)
        rid2 = _seed_resident(db_session)
        resp = client.post(
            f"/api/v1/marketplace/listings/{listing['listing_id']}/wishlist",
            json={"resident_id": rid2},
        )
        assert resp.status_code in (200, 201)

    def test_mark_sold_removes_from_active(self, client, db_session):
        rid = _seed_resident(db_session)
        listing = client.post("/api/v1/marketplace/listings", json={
            "resident_id": rid,
            "title": "Sold Item INT30",
            "price": 300,
            "category": "Other",
        }).json()
        resp = client.put(
            f"/api/v1/marketplace/listings/{listing['listing_id']}/sold",
            json={"resident_id": rid},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "sold"

    def test_sold_item_filtered_from_available_browse(self, client, db_session):
        rid = _seed_resident(db_session)
        listing = client.post("/api/v1/marketplace/listings", json={
            "resident_id": rid,
            "title": "Filter Sold INT30",
            "price": 150,
            "category": "Other",
        }).json()
        client.put(
            f"/api/v1/marketplace/listings/{listing['listing_id']}/sold",
            json={"resident_id": rid},
        )
        resp = client.get("/api/v1/marketplace/listings?status=available")
        titles = [l["title"] for l in resp.json()]
        assert "Filter Sold INT30" not in titles


# ── INT-31: Events ─────────────────────────────────────────────────────────────

class TestINT31Events:
    """View → RSVP → Volunteer flow."""

    def _create_event(self, client, title="INT-31 Event", capacity=50):
        resp = client.post("/api/v1/events", json={
            "title": title,
            "description": "Integration test event.",
            "event_date": _future(7),
            "venue": "Community Hall",
            "capacity": capacity,
            "created_by": "admin",
        })
        assert resp.status_code == 201
        return resp.json()

    def test_events_list_endpoint(self, client):
        self._create_event(client, "Listed Event INT31")
        resp = client.get("/api/v1/events")
        assert resp.status_code == 200
        titles = [e["title"] for e in resp.json()]
        assert "Listed Event INT31" in titles

    def test_rsvp_increments_count(self, client, db_session):
        rid = _seed_resident(db_session)
        event = self._create_event(client)
        before = event["rsvp_count"]
        client.post(f"/api/v1/events/{event['event_id']}/register", json={
            "resident_id": rid,
            "type": "rsvp",
        })
        updated = client.get(f"/api/v1/events/{event['event_id']}").json()
        assert updated["rsvp_count"] == before + 1

    def test_volunteer_registration_persists(self, client, db_session):
        rid = _seed_resident(db_session)
        event = self._create_event(client)
        resp = client.post(f"/api/v1/events/{event['event_id']}/register", json={
            "resident_id": rid,
            "type": "volunteer",
        })
        assert resp.status_code == 201
        assert resp.json()["type"] == "volunteer"

    def test_capacity_full_blocks_rsvp(self, client, db_session):
        rid1 = _seed_resident(db_session)
        rid2 = _seed_resident(db_session)
        event = self._create_event(client, capacity=1)
        client.post(f"/api/v1/events/{event['event_id']}/register", json={
            "resident_id": rid1, "type": "rsvp",
        })
        resp = client.post(f"/api/v1/events/{event['event_id']}/register", json={
            "resident_id": rid2, "type": "rsvp",
        })
        assert resp.status_code in (400, 409)

    def test_registrations_list_endpoint(self, client, db_session):
        rid = _seed_resident(db_session)
        event = self._create_event(client)
        client.post(f"/api/v1/events/{event['event_id']}/register", json={
            "resident_id": rid, "type": "rsvp",
        })
        resp = client.get(f"/api/v1/events/{event['event_id']}/registrations")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


# ── INT-33: Temple Management ──────────────────────────────────────────────────

class TestINT33TempleManagement:
    """Book → Donate → Event signup flow."""

    def test_seva_booking_persists(self, client, db_session):
        rid = _seed_resident(db_session)
        resp = client.post("/api/v1/temple/sevas", json={
            "resident_id": rid,
            "seva_type": "archana",
            "booking_date": _future(3),
            "slot": "06:30 AM",
            "amount": "101",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["booking_id"] is not None
        assert data["seva_type"] == "archana"

    def test_seva_bookings_list(self, client, db_session):
        rid = _seed_resident(db_session)
        client.post("/api/v1/temple/sevas", json={
            "resident_id": rid,
            "seva_type": "abhishekam",
            "booking_date": _future(4),
            "amount": "501",
        })
        resp = client.get(f"/api/v1/temple/sevas?resident_id={rid}")
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_donation_generates_receipt(self, client, db_session):
        rid = _seed_resident(db_session)
        resp = client.post("/api/v1/temple/donations", json={
            "resident_id": rid,
            "donor_name": "INT Donor",
            "purpose": "general",
            "amount": "1001",
            "payment_mode": "upi",
            "receipt_no": "RCPT-INT-001",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["donation_id"] is not None
        assert data["receipt_no"] == "RCPT-INT-001"

    def test_temple_event_signup_persists(self, client, db_session):
        rid = _seed_resident(db_session)
        event_resp = client.post("/api/v1/temple/events", json={
            "title": "INT-33 Temple Event",
            "description": "Test.",
            "event_date": _future(5),
            "venue": "Temple Hall",
            "volunteers_needed": 10,
        })
        assert event_resp.status_code == 201
        eid = event_resp.json()["event_id"]
        resp = client.post(f"/api/v1/temple/events/{eid}/signup", json={
            "resident_id": rid,
            "type": "volunteer",
        })
        assert resp.status_code == 201

    def test_duplicate_seva_slot_conflict(self, client, db_session):
        rid1 = _seed_resident(db_session)
        rid2 = _seed_resident(db_session)
        slot_date = _future(6)
        client.post("/api/v1/temple/sevas", json={
            "resident_id": rid1,
            "seva_type": "archana",
            "booking_date": slot_date,
            "slot": "07:30 AM",
            "amount": "101",
        })
        resp = client.post("/api/v1/temple/sevas", json={
            "resident_id": rid2,
            "seva_type": "archana",
            "booking_date": slot_date,
            "slot": "07:30 AM",
            "amount": "101",
        })
        assert resp.status_code in (400, 409)


# ── INT-34: Community Corners ──────────────────────────────────────────────────

class TestINT34CommunityCorners:
    """Browse → Signup flow across two corners."""

    def _seed_activity(self, db, corner="kids", title="INT-34 Activity", capacity=20):
        from app.models.community import CommunityActivity
        a = CommunityActivity(
            corner=corner,
            title=title,
            status="upcoming",
            activity_date=date.today() + timedelta(days=7),
            capacity=capacity,
        )
        db.add(a); db.commit(); db.refresh(a)
        return a

    def test_activities_list_endpoint(self, client, db_session):
        self._seed_activity(db_session, corner="kids", title="Kids Activity INT34")
        resp = client.get("/api/v1/community/activities")
        assert resp.status_code == 200
        titles = [a["title"] for a in resp.json()]
        assert "Kids Activity INT34" in titles

    def test_signup_persists_kids_corner(self, client, db_session):
        rid = _seed_resident(db_session)
        activity = self._seed_activity(db_session, corner="kids", title="Kids Signup INT34")
        resp = client.post(
            f"/api/v1/community/activities/{activity.activity_id}/signup",
            json={"resident_id": rid},
        )
        assert resp.status_code == 201
        assert resp.json()["signup_id"] is not None

    def test_signup_persists_senior_corner(self, client, db_session):
        rid = _seed_resident(db_session)
        activity = self._seed_activity(db_session, corner="senior", title="Senior Signup INT34")
        resp = client.post(
            f"/api/v1/community/activities/{activity.activity_id}/signup",
            json={"resident_id": rid},
        )
        assert resp.status_code == 201

    def test_signup_count_updates_immediately(self, client, db_session):
        rid = _seed_resident(db_session)
        activity = self._seed_activity(db_session, corner="recreational", title="Count Test INT34")
        before = client.get(f"/api/v1/community/activities/{activity.activity_id}").json().get("signup_count", 0)
        client.post(
            f"/api/v1/community/activities/{activity.activity_id}/signup",
            json={"resident_id": rid},
        )
        updated = client.get(f"/api/v1/community/activities/{activity.activity_id}").json()
        assert updated["signup_count"] == before + 1

    def test_capacity_full_blocks_signup(self, client, db_session):
        rid1 = _seed_resident(db_session)
        rid2 = _seed_resident(db_session)
        activity = self._seed_activity(db_session, corner="social", title="Full Activity INT34", capacity=1)
        client.post(
            f"/api/v1/community/activities/{activity.activity_id}/signup",
            json={"resident_id": rid1},
        )
        resp = client.post(
            f"/api/v1/community/activities/{activity.activity_id}/signup",
            json={"resident_id": rid2},
        )
        assert resp.status_code in (400, 409)

    def test_corner_filter_returns_correct_activities(self, client, db_session):
        self._seed_activity(db_session, corner="kids",   title="Kids Filter INT34")
        self._seed_activity(db_session, corner="senior", title="Senior Filter INT34")
        resp = client.get("/api/v1/community/activities?corner=kids")
        assert resp.status_code == 200
        corners = [a["corner"] for a in resp.json()]
        assert all(c == "kids" for c in corners)


class TestINT06ComplaintAssignment:
    """
    Complaint Assignment desk (FE-06) end-to-end.

    Exercises the exact HTTP calls the frontend's assignment screen makes via
    complaintService/useAssignmentDesk:

      1. GET  /staff/workload            — the assignable-staff dropdown source
      2. GET  /complaints/reports        — the open-complaints list
      3. PUT  /complaints/{id}/assign    — allocate to a staff member
      4. GET  /complaints/reports        — re-fetch: the assignment persists and
                                           re-displays (staff + timestamp)

    This is the "allocations persist to the backend and re-display" flow the
    story asks to be validated end to end.
    """

    def _seed_staff(self, db, name="Raju Kumar", role="maintenance"):
        from app.models.complaint import Staff
        s = Staff(name=name, role=role, phone="9876500001")
        db.add(s); db.commit(); db.refresh(s)
        return s.staff_id

    def _raise_complaint(self, client, category="Plumbing"):
        resp = client.post("/api/v1/complaints", json={
            "category": category,
            "description": "Kitchen tap leaking continuously.",
            "location": "A-101",
            "raised_by": "resident-int06",
        })
        assert resp.status_code == 201
        return resp.json()["complaint_id"]

    def _open_report_item(self, client, complaint_id):
        report = client.get("/api/v1/complaints/reports?page_size=100").json()
        return next((i for i in report["items"] if i["complaint_id"] == complaint_id), None)

    # ── The dropdown source ──────────────────────────────────────────────────

    def test_staff_workload_lists_the_assignable_staff(self, client, db_session):
        staff_id = self._seed_staff(db_session, name="Selvam R")
        rows = client.get("/api/v1/staff/workload").json()
        listed = {r["staff_id"]: r for r in rows}
        assert staff_id in listed
        assert listed[staff_id]["name"] == "Selvam R"

    # ── Assign persists and re-displays ──────────────────────────────────────

    def test_assignment_persists_and_redisplays(self, client, db_session):
        staff_id = self._seed_staff(db_session)
        complaint_id = self._raise_complaint(client)

        # Before: the complaint is open and unassigned in the report list.
        before = self._open_report_item(client, complaint_id)
        assert before is not None
        assert before["status"] == "submitted"
        assert before["assigned_to"] is None

        # Assign it (the exact call the assign dropdown makes).
        resp = client.put(f"/api/v1/complaints/{complaint_id}/assign",
                          json={"staff_id": staff_id, "assigned_by": "president-int06"})
        assert resp.status_code == 200
        body = resp.json()
        assert body["assigned_to"] == staff_id
        assert body["assigned_at"] is not None
        assert body["assigned_staff"]["name"] == "Raju Kumar"
        assert body["status"] == "assigned"

        # Re-fetch the report: the assignment is persisted and re-displays with
        # the staff name and timestamp the screen shows.
        after = self._open_report_item(client, complaint_id)
        assert after["assigned_to"] == staff_id
        assert after["assigned_name"] == "Raju Kumar"
        assert after["assigned_at"] is not None
        assert after["status"] == "assigned"

    def test_assignment_survives_a_fresh_list_call(self, client, db_session):
        """A reload of the desk (a brand-new report request) still shows it."""
        staff_id = self._seed_staff(db_session)
        complaint_id = self._raise_complaint(client)
        client.put(f"/api/v1/complaints/{complaint_id}/assign", json={"staff_id": staff_id})

        # Two independent GETs — nothing is cached client-side in the flow.
        first = self._open_report_item(client, complaint_id)
        second = self._open_report_item(client, complaint_id)
        assert first["assigned_to"] == staff_id
        assert second["assigned_to"] == staff_id
        assert first["assigned_at"] == second["assigned_at"]  # stable timestamp

    # ── Reassignment ─────────────────────────────────────────────────────────

    def test_reassignment_redisplays_the_new_staff(self, client, db_session):
        alice = self._seed_staff(db_session, name="Alice")
        bob = self._seed_staff(db_session, name="Bob")
        complaint_id = self._raise_complaint(client)

        client.put(f"/api/v1/complaints/{complaint_id}/assign", json={"staff_id": alice})
        client.put(f"/api/v1/complaints/{complaint_id}/assign", json={"staff_id": bob})

        after = self._open_report_item(client, complaint_id)
        assert after["assigned_to"] == bob
        assert after["assigned_name"] == "Bob"

    # ── Negative: the screen surfaces backend rejections ─────────────────────

    def test_assign_to_unknown_staff_is_rejected(self, client, db_session):
        complaint_id = self._raise_complaint(client)
        resp = client.put(f"/api/v1/complaints/{complaint_id}/assign",
                          json={"staff_id": "no-such-staff"})
        assert resp.status_code == 404
        # The complaint stays open and unassigned.
        item = self._open_report_item(client, complaint_id)
        assert item["assigned_to"] is None


# ── INT-13: Complaint Categorization ────────────────────────────────────────────

class TestINT13Categorization:
    """
    Complaint categorization (FE-13) wired end-to-end.

    Exercises the exact HTTP calls the submission screen makes via
    complaintService (fetchComplaintCategories + createComplaint):

      1. GET  /complaints/categories   — the source the category selector loads
      2. POST /complaints              — submit carrying the chosen category
      3. GET  /complaints/reports      — the stored category re-displays downstream
      4. GET  /complaints/stats        — and is counted in the category breakdown

    The story's guarantee is that "the stored complaint carries the right
    category": every value the selector can offer is one submission accepts, and
    what comes back out is exactly what went in.
    """

    CATEGORIES_URL = "/api/v1/complaints/categories"
    COMPLAINTS_URL = "/api/v1/complaints"

    def _raise(self, client, category):
        return client.post(self.COMPLAINTS_URL, json={
            "category": category,
            "description": "Kitchen tap leaking continuously.",
            "location": "A-101",
            "raised_by": "resident-int13",
        })

    # ── The selector's option source ─────────────────────────────────────────

    def test_categories_endpoint_feeds_the_selector(self, client):
        body = client.get(self.CATEGORIES_URL).json()
        assert body["count"] == len(body["categories"])
        assert "Plumbing" in body["categories"]

    # ── Every offered category is sent and stored unchanged ──────────────────

    def test_each_offered_category_is_sent_and_stored(self, client, db_session):
        for category in client.get(self.CATEGORIES_URL).json()["categories"]:
            resp = self._raise(client, category)
            assert resp.status_code == 201, category
            assert resp.json()["category"] == category

    # ── The stored category re-displays downstream ───────────────────────────

    def test_stored_category_shows_in_reports_and_stats(self, client, db_session):
        self._raise(client, "Electrical")

        report = client.get(f"{self.COMPLAINTS_URL}/reports").json()
        assert report["items"][0]["category"] == "Electrical"
        assert any(c["category"] == "Electrical" for c in report["by_category"])

        stats = client.get(f"{self.COMPLAINTS_URL}/stats").json()
        assert any(row["category"] == "Electrical" for row in stats["by_category"])

    # ── The selector cannot drift from what the API accepts ──────────────────

    def test_a_value_off_the_list_is_rejected(self, client):
        resp = self._raise(client, "Gardening")
        assert resp.status_code == 400

    def test_selector_list_and_accept_set_stay_in_lockstep(self, client, db_session):
        offered = set(client.get(self.CATEGORIES_URL).json()["categories"])
        for category in offered:
            assert self._raise(client, category).status_code == 201
        stats = client.get(f"{self.COMPLAINTS_URL}/stats").json()
        assert {row["category"] for row in stats["by_category"]} == offered


# ── INT-14: Complaint Reports ───────────────────────────────────────────────────

class TestINT14ComplaintReports:
    """
    Complaint Reports screen (FE-14) wired to the live report API.

    Exercises the exact HTTP calls the reports screen makes via
    complaintReportService.fetchComplaintReport — including the date-range
    round-trip the month selector performs on every change:

      1. GET /complaints/reports                       — the screen loads
      2. GET /complaints/reports?date_from=&date_to=   — a month's range
      3. by_category / by_status / items               — the real volume and
                                                          resolution stats the
                                                          charts render

    Validates the story end to end: analytics reflect real data, and the volume
    and resolution figures are scoped correctly across a date range.
    """

    REPORTS_URL = "/api/v1/complaints/reports"

    def _seed(self, db, category="Plumbing", status="submitted", created_at=None):
        from app.models.complaint import Complaint
        c = Complaint(
            category=category,
            description=f"Issue with {category}",
            location="Block A",
            status=status,
        )
        if created_at:
            c.created_at = created_at
            c.updated_at = created_at
        db.add(c); db.commit(); db.refresh(c)
        return c

    # ── The screen loads from the live API ───────────────────────────────────

    def test_reports_screen_loads(self, client, db_session):
        self._seed(db_session, category="Plumbing")
        self._seed(db_session, category="Electrical")
        data = client.get(self.REPORTS_URL).json()
        assert data["total"] == 2
        assert {"by_status", "by_category", "items"} <= set(data.keys())

    # ── Charts render real volume ────────────────────────────────────────────

    def test_category_breakdown_reflects_real_volume(self, client, db_session):
        self._seed(db_session, category="Plumbing")
        self._seed(db_session, category="Plumbing")
        self._seed(db_session, category="Electrical")
        by_cat = {c["category"]: c["count"]
                  for c in client.get(self.REPORTS_URL).json()["by_category"]}
        assert by_cat["Plumbing"] == 2
        assert by_cat["Electrical"] == 1

    # ── Charts render real resolution stats ──────────────────────────────────

    def test_resolution_stats_reflect_real_data(self, client, db_session):
        from datetime import datetime, timezone
        created = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=3)
        c = self._seed(db_session, status="resolved", created_at=created)

        data = client.get(self.REPORTS_URL).json()
        item = next(i for i in data["items"] if i["complaint_id"] == c.complaint_id)
        # The screen measures turnaround from created_at -> updated_at, so both
        # must be present for a resolved complaint.
        assert item["status"] == "resolved"
        assert item["created_at"] is not None
        assert item["updated_at"] is not None
        assert data["by_status"]["resolved"] == 1

    # ── End-to-end across a date range (the month selector) ──────────────────

    def test_report_scopes_to_the_selected_date_range(self, client, db_session):
        from datetime import datetime, timezone

        def days_ago(n):
            return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=n)

        def date_str(n):
            return days_ago(n).strftime("%Y-%m-%d")

        self._seed(db_session, category="Plumbing",   created_at=days_ago(20))  # outside
        self._seed(db_session, category="Plumbing",   created_at=days_ago(7))   # inside
        self._seed(db_session, category="Electrical", created_at=days_ago(3))   # inside

        data = client.get(
            f"{self.REPORTS_URL}?date_from={date_str(10)}&date_to={date_str(1)}"
        ).json()
        assert data["total"] == 2
        # Summary counts are scoped to the range, not the whole table.
        by_cat = {c["category"]: c["count"] for c in data["by_category"]}
        assert by_cat == {"Plumbing": 1, "Electrical": 1}

    def test_changing_the_range_changes_the_numbers(self, client, db_session):
        from datetime import datetime, timezone

        def days_ago(n):
            return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=n)

        self._seed(db_session, created_at=days_ago(2))
        self._seed(db_session, created_at=days_ago(40))

        recent = client.get(
            f"{self.REPORTS_URL}?date_from={days_ago(5).strftime('%Y-%m-%d')}"
        ).json()["total"]
        everything = client.get(self.REPORTS_URL).json()["total"]
        assert recent == 1
        assert everything == 2


# ── INT-16: Complaint Progress Updates ──────────────────────────────────────────

class TestINT16ProgressUpdates:
    """
    Complaint progress updates (FE-16) wired end-to-end.

    Exercises the exact HTTP calls the progress desk makes via
    complaintService.updateComplaintProgress, and confirms the change reaches the
    resident's tracking screen (INT-02) together with the audit trail:

      1. PUT /complaints/{id}/progress      — record a status change (BE-16),
                                               attributed to the assignee
      2. GET /complaints/{id}/status        — the stage the tracking stepper reads
      3. GET /residents/{rid}/complaints    — the resident's list, carrying the
                                               progress log the activity feed shows

    Validates the story end to end: a staff update propagates to the resident,
    and every accepted update is written to the audit trail in order.
    """

    COMPLAINTS_URL = "/api/v1/complaints"

    def _seed_staff(self, db, name="Raju Kumar", is_active="true"):
        from app.models.complaint import Staff
        s = Staff(name=name, role="maintenance", phone="9876500001", is_active=is_active)
        db.add(s); db.commit(); db.refresh(s)
        return s.staff_id

    def _seed_assigned_complaint(self, db, staff_id, raised_by=None):
        from app.models.complaint import Complaint
        c = Complaint(
            category="Plumbing",
            description="Kitchen tap leaking continuously.",
            location="A-101",
            raised_by=raised_by,
            status="assigned",
            assigned_to=staff_id,
        )
        db.add(c); db.commit(); db.refresh(c)
        return c.complaint_id

    def _progress(self, client, complaint_id, status, employee_id, notes=None):
        body = {"status": status, "employee_id": employee_id}
        if notes:
            body["notes"] = notes
        return client.put(f"{self.COMPLAINTS_URL}/{complaint_id}/progress", json=body)

    # ── The desk calls the live update API ───────────────────────────────────

    def test_progress_update_records_the_change(self, client, db_session):
        staff_id = self._seed_staff(db_session)
        cid = self._seed_assigned_complaint(db_session, staff_id)

        resp = self._progress(client, cid, "in_progress", staff_id, "Parts procured")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "in_progress"
        last = body["progress_logs"][-1]
        assert last["status"] == "in_progress"
        assert last["employee_id"] == staff_id
        assert last["notes"] == "Parts procured"

    # ── The update propagates to resident status tracking ────────────────────

    def test_update_appears_on_resident_tracking(self, client, db_session):
        resident_id = _seed_resident(db_session)
        staff_id = self._seed_staff(db_session)
        cid = self._seed_assigned_complaint(db_session, staff_id, raised_by=resident_id)

        self._progress(client, cid, "in_progress", staff_id, "Work started")

        # The stepper reads the current stage from the status endpoint.
        stage = client.get(f"{self.COMPLAINTS_URL}/{cid}/status").json()
        assert stage["status"] == "in_progress"

        # The tracking/activity screen reads the resident's list, which carries
        # the progress log the staff member just wrote.
        rows = client.get(f"/api/v1/residents/{resident_id}/complaints").json()
        mine = next(c for c in rows if c["complaint_id"] == cid)
        assert mine["status"] == "in_progress"
        assert "Work started" in [log["notes"] for log in mine["progress_logs"]]
        assert mine["progress_logs"][-1]["employee"]["name"] == "Raju Kumar"

    # ── The full flow, validated including the audit trail ───────────────────

    def test_lifecycle_builds_the_audit_trail_in_order(self, client, db_session):
        staff_id = self._seed_staff(db_session)
        cid = self._seed_assigned_complaint(db_session, staff_id)

        self._progress(client, cid, "in_progress", staff_id, "Started")
        body = self._progress(client, cid, "resolved", staff_id, "Fixed").json()

        logs = body["progress_logs"]
        assert [entry["status"] for entry in logs] == ["in_progress", "resolved"]
        assert all(entry["employee_id"] == staff_id for entry in logs)
        # Timestamps never go backwards along the trail.
        stamps = [entry["updated_at"] for entry in logs]
        assert stamps == sorted(stamps)

    # ── A rejected update changes nothing and is not recorded ─────────────────

    def test_invalid_transition_is_rejected_and_unrecorded(self, client, db_session):
        staff_id = self._seed_staff(db_session)
        cid = self._seed_assigned_complaint(db_session, staff_id)  # status: assigned

        # assigned -> resolved skips the required in_progress step.
        resp = self._progress(client, cid, "resolved", staff_id)
        assert resp.status_code == 400

        stage = client.get(f"{self.COMPLAINTS_URL}/{cid}/status").json()
        assert stage["status"] == "assigned"

    def test_unknown_employee_is_rejected(self, client, db_session):
        staff_id = self._seed_staff(db_session)
        cid = self._seed_assigned_complaint(db_session, staff_id)

        resp = self._progress(client, cid, "in_progress", "no-such-staff")
        assert resp.status_code == 404
