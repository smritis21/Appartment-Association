"""
pytest tests for BE-14 — Complaint Reports API.

Covers:
  GET /api/v1/complaints/reports:
    - No filters (all complaints returned)
    - Filter by status
    - Filter by category
    - Filter by assigned_to
    - Filter by raised_by
    - Filter by date_from / date_to
    - Combined filters
    - Pagination (page / page_size)
    - Summary counts (by_status, by_category) scoped to filters
    - assigned_name resolved from staff FK
    - Empty result set
    - Invalid date format → 422
    - date_from after date_to → 422
    - Invalid page / page_size → 422

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import datetime, timedelta, timezone


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_staff(db_session, name: str = "Ravi Kumar", role: str = "plumber") -> str:
    from app.models.complaint import Staff
    staff = Staff(name=name, role=role, phone="9000000001", is_active="true")
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)
    return staff.staff_id


def seed_complaint(
    db_session,
    category: str = "plumbing",
    status: str = "submitted",
    assigned_to: str | None = None,
    raised_by: str | None = None,
    created_at: datetime | None = None,
) -> str:
    from app.models.complaint import Complaint
    c = Complaint(
        category=category,
        description=f"Issue with {category}",
        location="Block A",
        raised_by=raised_by,
        status=status,
        assigned_to=assigned_to,
    )
    if created_at:
        c.created_at = created_at
        c.updated_at = created_at
    db_session.add(c)
    db_session.commit()
    db_session.refresh(c)
    return c.complaint_id


def days_ago(n: int) -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=n)


def date_str(n_days_ago: int) -> str:
    return (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=n_days_ago)).strftime("%Y-%m-%d")


# ── GET /api/v1/complaints/reports — no filters ───────────────────────────────

class TestReportNoFilters:

    def test_empty_database(self, client, db_session):
        response = client.get("/api/v1/complaints/reports")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 0
        assert data["items"] == []
        assert data["page"] == 1
        assert data["pages"] == 1

    def test_returns_all_complaints(self, client, db_session):
        seed_complaint(db_session, category="plumbing")
        seed_complaint(db_session, category="electrical")
        seed_complaint(db_session, category="security")

        response = client.get("/api/v1/complaints/reports")
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["items"]) == 3

    def test_response_shape(self, client, db_session):
        seed_complaint(db_session)
        data = client.get("/api/v1/complaints/reports").json()
        item = data["items"][0]
        assert "complaint_id" in item
        assert "category" in item
        assert "description" in item
        assert "status" in item
        assert "created_at" in item
        assert "updated_at" in item
        assert "assigned_name" in item
        assert "pages" in data
        assert "by_status" in data
        assert "by_category" in data
        assert "generated_at" in data

    def test_ordered_newest_first(self, client, db_session):
        seed_complaint(db_session, created_at=days_ago(5))
        seed_complaint(db_session, created_at=days_ago(1))
        seed_complaint(db_session, created_at=days_ago(3))

        items = client.get("/api/v1/complaints/reports").json()["items"]
        dates = [item["created_at"] for item in items]
        assert dates == sorted(dates, reverse=True)


# ── Filter by status ──────────────────────────────────────────────────────────

class TestFilterByStatus:

    def test_filter_submitted(self, client, db_session):
        seed_complaint(db_session, status="submitted")
        seed_complaint(db_session, status="resolved")

        data = client.get("/api/v1/complaints/reports?status=submitted").json()
        assert data["total"] == 1
        assert data["items"][0]["status"] == "submitted"

    def test_filter_resolved(self, client, db_session):
        seed_complaint(db_session, status="submitted")
        seed_complaint(db_session, status="resolved")
        seed_complaint(db_session, status="closed")

        data = client.get("/api/v1/complaints/reports?status=resolved").json()
        assert data["total"] == 1

    def test_filter_returns_empty_when_no_match(self, client, db_session):
        seed_complaint(db_session, status="submitted")
        data = client.get("/api/v1/complaints/reports?status=closed").json()
        assert data["total"] == 0
        assert data["items"] == []


# ── Filter by category ────────────────────────────────────────────────────────

class TestFilterByCategory:

    def test_filter_category(self, client, db_session):
        seed_complaint(db_session, category="plumbing")
        seed_complaint(db_session, category="electrical")
        seed_complaint(db_session, category="plumbing")

        data = client.get("/api/v1/complaints/reports?category=plumbing").json()
        assert data["total"] == 2
        for item in data["items"]:
            assert item["category"] == "plumbing"

    def test_filter_category_no_match(self, client, db_session):
        seed_complaint(db_session, category="plumbing")
        data = client.get("/api/v1/complaints/reports?category=security").json()
        assert data["total"] == 0


# ── Filter by assigned_to ─────────────────────────────────────────────────────

class TestFilterByAssignedTo:

    def test_filter_assigned_to(self, client, db_session):
        staff_id = seed_staff(db_session)
        seed_complaint(db_session, assigned_to=staff_id, status="assigned")
        seed_complaint(db_session, status="submitted")

        data = client.get(f"/api/v1/complaints/reports?assigned_to={staff_id}").json()
        assert data["total"] == 1
        assert data["items"][0]["assigned_to"] == staff_id

    def test_assigned_name_resolved(self, client, db_session):
        staff_id = seed_staff(db_session, name="Ravi Kumar")
        seed_complaint(db_session, assigned_to=staff_id, status="assigned")

        data = client.get(f"/api/v1/complaints/reports?assigned_to={staff_id}").json()
        assert data["items"][0]["assigned_name"] == "Ravi Kumar"

    def test_unassigned_complaint_has_null_assigned_name(self, client, db_session):
        seed_complaint(db_session, status="submitted")
        data = client.get("/api/v1/complaints/reports").json()
        assert data["items"][0]["assigned_name"] is None


# ── Filter by raised_by ───────────────────────────────────────────────────────

class TestFilterByRaisedBy:

    def test_filter_raised_by(self, client, db_session):
        seed_complaint(db_session, raised_by="resident-001")
        seed_complaint(db_session, raised_by="resident-002")
        seed_complaint(db_session, raised_by="resident-001")

        data = client.get("/api/v1/complaints/reports?raised_by=resident-001").json()
        assert data["total"] == 2
        for item in data["items"]:
            assert item["raised_by"] == "resident-001"


# ── Filter by date range ──────────────────────────────────────────────────────

class TestFilterByDateRange:

    def test_date_from_filters_old_complaints(self, client, db_session):
        seed_complaint(db_session, created_at=days_ago(10))
        seed_complaint(db_session, created_at=days_ago(2))

        data = client.get(f"/api/v1/complaints/reports?date_from={date_str(5)}").json()
        assert data["total"] == 1

    def test_date_to_filters_future_complaints(self, client, db_session):
        seed_complaint(db_session, created_at=days_ago(1))
        seed_complaint(db_session, created_at=days_ago(10))

        data = client.get(f"/api/v1/complaints/reports?date_to={date_str(5)}").json()
        assert data["total"] == 1

    def test_date_range_both_bounds(self, client, db_session):
        seed_complaint(db_session, created_at=days_ago(15))  # outside
        seed_complaint(db_session, created_at=days_ago(7))   # inside
        seed_complaint(db_session, created_at=days_ago(3))   # inside
        seed_complaint(db_session, created_at=days_ago(1))   # outside

        data = client.get(
            f"/api/v1/complaints/reports?date_from={date_str(10)}&date_to={date_str(2)}"
        ).json()
        assert data["total"] == 2

    def test_invalid_date_format_422(self, client, db_session):
        response = client.get("/api/v1/complaints/reports?date_from=01-07-2026")
        assert response.status_code == 422

    def test_date_from_after_date_to_422(self, client, db_session):
        response = client.get(
            f"/api/v1/complaints/reports?date_from={date_str(1)}&date_to={date_str(5)}"
        )
        assert response.status_code == 422


# ── Combined filters ──────────────────────────────────────────────────────────

class TestCombinedFilters:

    def test_status_and_category(self, client, db_session):
        seed_complaint(db_session, category="plumbing", status="submitted")
        seed_complaint(db_session, category="plumbing", status="resolved")
        seed_complaint(db_session, category="electrical", status="submitted")

        data = client.get(
            "/api/v1/complaints/reports?status=submitted&category=plumbing"
        ).json()
        assert data["total"] == 1
        assert data["items"][0]["category"] == "plumbing"
        assert data["items"][0]["status"] == "submitted"

    def test_category_and_date_range(self, client, db_session):
        seed_complaint(db_session, category="plumbing", created_at=days_ago(2))
        seed_complaint(db_session, category="plumbing", created_at=days_ago(20))
        seed_complaint(db_session, category="electrical", created_at=days_ago(2))

        data = client.get(
            f"/api/v1/complaints/reports?category=plumbing&date_from={date_str(5)}"
        ).json()
        assert data["total"] == 1


# ── Pagination ────────────────────────────────────────────────────────────────

class TestPagination:

    def test_page_size(self, client, db_session):
        for _ in range(5):
            seed_complaint(db_session)

        data = client.get("/api/v1/complaints/reports?page=1&page_size=2").json()
        assert len(data["items"]) == 2
        assert data["total"] == 5
        assert data["pages"] == 3

    def test_second_page(self, client, db_session):
        for _ in range(5):
            seed_complaint(db_session)

        p1 = client.get("/api/v1/complaints/reports?page=1&page_size=3").json()
        p2 = client.get("/api/v1/complaints/reports?page=2&page_size=3").json()
        assert len(p1["items"]) == 3
        assert len(p2["items"]) == 2

        ids_p1 = {i["complaint_id"] for i in p1["items"]}
        ids_p2 = {i["complaint_id"] for i in p2["items"]}
        assert ids_p1.isdisjoint(ids_p2)

    def test_page_beyond_last_returns_empty(self, client, db_session):
        seed_complaint(db_session)
        data = client.get("/api/v1/complaints/reports?page=99&page_size=20").json()
        assert data["items"] == []
        assert data["total"] == 1

    def test_invalid_page_zero_422(self, client, db_session):
        response = client.get("/api/v1/complaints/reports?page=0")
        assert response.status_code == 422

    def test_invalid_page_size_zero_422(self, client, db_session):
        response = client.get("/api/v1/complaints/reports?page_size=0")
        assert response.status_code == 422

    def test_page_size_over_limit_422(self, client, db_session):
        response = client.get("/api/v1/complaints/reports?page_size=101")
        assert response.status_code == 422


# ── Summary counts ────────────────────────────────────────────────────────────

class TestSummaryCounts:

    def test_by_status_counts(self, client, db_session):
        seed_complaint(db_session, status="submitted")
        seed_complaint(db_session, status="submitted")
        seed_complaint(db_session, status="resolved")

        data = client.get("/api/v1/complaints/reports").json()
        assert data["by_status"]["submitted"] == 2
        assert data["by_status"]["resolved"] == 1
        assert data["by_status"]["assigned"] == 0

    def test_by_category_counts(self, client, db_session):
        seed_complaint(db_session, category="plumbing")
        seed_complaint(db_session, category="plumbing")
        seed_complaint(db_session, category="electrical")

        data = client.get("/api/v1/complaints/reports").json()
        cats = {c["category"]: c["count"] for c in data["by_category"]}
        assert cats["plumbing"] == 2
        assert cats["electrical"] == 1

    def test_summary_counts_scoped_to_filters(self, client, db_session):
        """by_status should reflect only the filtered subset, not all complaints."""
        seed_complaint(db_session, category="plumbing", status="submitted")
        seed_complaint(db_session, category="electrical", status="resolved")

        data = client.get("/api/v1/complaints/reports?category=plumbing").json()
        assert data["by_status"]["submitted"] == 1
        assert data["by_status"]["resolved"] == 0
        assert len(data["by_category"]) == 1
        assert data["by_category"][0]["category"] == "plumbing"

    def test_by_category_ordered_busiest_first(self, client, db_session):
        seed_complaint(db_session, category="electrical")
        seed_complaint(db_session, category="plumbing")
        seed_complaint(db_session, category="plumbing")
        seed_complaint(db_session, category="plumbing")

        data = client.get("/api/v1/complaints/reports").json()
        counts = [c["count"] for c in data["by_category"]]
        assert counts == sorted(counts, reverse=True)


# ── Existing endpoints not broken ─────────────────────────────────────────────

class TestExistingEndpointsUnchanged:

    def test_stats_endpoint_still_works(self, client, db_session):
        response = client.get("/api/v1/complaints/stats")
        assert response.status_code == 200
        data = response.json()
        assert "pending" in data
        assert "ongoing" in data
        assert "completed" in data
        assert "trend" in data

    def test_assign_endpoint_still_works(self, client, db_session):
        complaint_id = seed_complaint(db_session)
        staff_id = seed_staff(db_session)
        response = client.put(
            f"/api/v1/complaints/{complaint_id}/assign",
            json={"staff_id": staff_id},
        )
        assert response.status_code == 200
        assert response.json()["assigned_to"] == staff_id
