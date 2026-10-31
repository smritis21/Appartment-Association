"""
pytest tests for BE-24 — Work Orders API.

Covers:
  POST /api/v1/maintenance/work-orders          — create
  GET  /api/v1/maintenance/work-orders/stats    — board stats
  GET  /api/v1/maintenance/work-orders          — list + filters
  GET  /api/v1/maintenance/work-orders/{id}     — get single
  PUT  /api/v1/maintenance/work-orders/{id}/assign  — assign
  PUT  /api/v1/maintenance/work-orders/{id}/status  — status transitions
  GET  /api/v1/maintenance/assets/{id}/history  — asset history
"""

import pytest
from app.models.complaint import Staff
from app.models.user import User


# ── Helpers ───────────────────────────────────────────────────────────────────

def _register_activate(client, db_session, email, role="admin") -> str:
    resp = client.post("/api/v1/auth/register", json={
        "email": email, "password": "password123",
        "full_name": "Test User", "role": role,
    })
    assert resp.status_code == 201
    uid = resp.json()["user_id"]
    user = db_session.query(User).filter(User.user_id == uid).first()
    user.account_status = "active"
    db_session.commit()
    return uid


def _login(client, email, password="password123") -> dict:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _make_staff(db_session, name="Ravi Kumar", role="electrician") -> Staff:
    s = Staff(name=name, role=role, phone="9000000001", is_active="true")
    db_session.add(s)
    db_session.flush()
    return s


def _wo_payload(**overrides) -> dict:
    payload = {
        "title": "Elevator servicing",
        "description": "Annual inspection",
        "asset_id": "AST-ELV-A",
        "type": "preventive",
        "priority": "medium",
        "due_date": "2099-12-31",
    }
    payload.update(overrides)
    return payload


# ── POST /api/v1/maintenance/work-orders ─────────────────────────────────────

class TestCreateWorkOrder:

    def test_requires_auth(self, client, db_session):
        assert client.post("/api/v1/maintenance/work-orders", json=_wo_payload()).status_code == 401

    def test_requires_management_role(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com", role="owner")
        headers = _login(client, "owner@jkr.com")
        assert client.post("/api/v1/maintenance/work-orders", json=_wo_payload(), headers=headers).status_code == 403

    def test_create_success_returns_201(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        resp = client.post("/api/v1/maintenance/work-orders", json=_wo_payload(), headers=headers)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Elevator servicing"
        assert data["status"] == "open"
        assert data["type"] == "preventive"
        assert data["priority"] == "medium"
        assert data["is_overdue"] is False
        assert "work_order_id" in data

    def test_create_with_assignee_starts_assigned(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        staff = _make_staff(db_session)
        db_session.commit()
        resp = client.post("/api/v1/maintenance/work-orders",
                           json=_wo_payload(assigned_to=staff.staff_id), headers=headers)
        assert resp.status_code == 201
        assert resp.json()["status"] == "assigned"
        assert resp.json()["assigned_to"] == staff.staff_id

    def test_create_unknown_staff_returns_404(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        resp = client.post("/api/v1/maintenance/work-orders",
                           json=_wo_payload(assigned_to="00000000-0000-0000-0000-000000000000"),
                           headers=headers)
        assert resp.status_code == 404

    def test_create_missing_title_returns_422(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        payload = _wo_payload()
        del payload["title"]
        assert client.post("/api/v1/maintenance/work-orders", json=payload, headers=headers).status_code == 422

    def test_president_can_create(self, client, db_session):
        _register_activate(client, db_session, "pres@jkr.com", role="president")
        headers = _login(client, "pres@jkr.com")
        resp = client.post("/api/v1/maintenance/work-orders", json=_wo_payload(), headers=headers)
        assert resp.status_code == 201

    def test_secretary_can_create(self, client, db_session):
        _register_activate(client, db_session, "sec@jkr.com", role="secretary")
        headers = _login(client, "sec@jkr.com")
        resp = client.post("/api/v1/maintenance/work-orders", json=_wo_payload(), headers=headers)
        assert resp.status_code == 201

    def test_overdue_flag_set_for_past_due_date(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        resp = client.post("/api/v1/maintenance/work-orders",
                           json=_wo_payload(due_date="2000-01-01"), headers=headers)
        assert resp.status_code == 201
        assert resp.json()["is_overdue"] is True


# ── GET /api/v1/maintenance/work-orders/stats ─────────────────────────────────

class TestBoardStats:

    def test_requires_auth(self, client, db_session):
        assert client.get("/api/v1/maintenance/work-orders/stats").status_code == 401

    def test_empty_db_zeroed(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        resp = client.get("/api/v1/maintenance/work-orders/stats", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 0
        assert data["open"] == 0
        assert data["overdue"] == 0
        assert data["completed"] == 0

    def test_stats_reflect_created_orders(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        client.post("/api/v1/maintenance/work-orders", json=_wo_payload(title="WO1"), headers=headers)
        client.post("/api/v1/maintenance/work-orders", json=_wo_payload(title="WO2", due_date="2000-01-01"), headers=headers)
        resp = client.get("/api/v1/maintenance/work-orders/stats", headers=headers)
        data = resp.json()
        assert data["total"] == 2
        assert data["open"] == 2
        assert data["overdue"] == 1


# ── GET /api/v1/maintenance/work-orders ──────────────────────────────────────

class TestListWorkOrders:

    def test_requires_auth(self, client, db_session):
        assert client.get("/api/v1/maintenance/work-orders").status_code == 401

    def test_returns_created_orders(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        client.post("/api/v1/maintenance/work-orders", json=_wo_payload(title="WO-A"), headers=headers)
        client.post("/api/v1/maintenance/work-orders", json=_wo_payload(title="WO-B"), headers=headers)
        resp = client.get("/api/v1/maintenance/work-orders", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_filter_by_status(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        client.post("/api/v1/maintenance/work-orders", json=_wo_payload(title="Open"), headers=headers)
        resp = client.get("/api/v1/maintenance/work-orders?status=open", headers=headers)
        assert all(w["status"] == "open" for w in resp.json())

    def test_filter_by_type(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        client.post("/api/v1/maintenance/work-orders", json=_wo_payload(type="reactive"), headers=headers)
        client.post("/api/v1/maintenance/work-orders", json=_wo_payload(type="preventive"), headers=headers)
        resp = client.get("/api/v1/maintenance/work-orders?type=reactive", headers=headers)
        assert all(w["type"] == "reactive" for w in resp.json())

    def test_filter_by_priority(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        client.post("/api/v1/maintenance/work-orders", json=_wo_payload(priority="critical"), headers=headers)
        client.post("/api/v1/maintenance/work-orders", json=_wo_payload(priority="low"), headers=headers)
        resp = client.get("/api/v1/maintenance/work-orders?priority=critical", headers=headers)
        assert all(w["priority"] == "critical" for w in resp.json())

    def test_filter_by_assigned_to(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        staff = _make_staff(db_session)
        db_session.commit()
        client.post("/api/v1/maintenance/work-orders",
                    json=_wo_payload(assigned_to=staff.staff_id), headers=headers)
        client.post("/api/v1/maintenance/work-orders", json=_wo_payload(), headers=headers)
        resp = client.get(f"/api/v1/maintenance/work-orders?assigned_to={staff.staff_id}", headers=headers)
        assert len(resp.json()) == 1
        assert resp.json()[0]["assigned_to"] == staff.staff_id

    def test_pagination(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        for i in range(5):
            client.post("/api/v1/maintenance/work-orders", json=_wo_payload(title=f"WO-{i}"), headers=headers)
        resp = client.get("/api/v1/maintenance/work-orders?skip=0&limit=3", headers=headers)
        assert len(resp.json()) == 3


# ── GET /api/v1/maintenance/work-orders/{id} ─────────────────────────────────

class TestGetWorkOrder:

    def test_requires_auth(self, client, db_session):
        assert client.get("/api/v1/maintenance/work-orders/fake-id").status_code == 401

    def test_404_unknown(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        assert client.get("/api/v1/maintenance/work-orders/00000000-0000-0000-0000-000000000000",
                          headers=headers).status_code == 404

    def test_returns_correct_order(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        created = client.post("/api/v1/maintenance/work-orders",
                              json=_wo_payload(title="Specific WO"), headers=headers).json()
        resp = client.get(f"/api/v1/maintenance/work-orders/{created['work_order_id']}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["title"] == "Specific WO"


# ── PUT /api/v1/maintenance/work-orders/{id}/assign ──────────────────────────

class TestAssignWorkOrder:

    def test_requires_auth(self, client, db_session):
        assert client.put("/api/v1/maintenance/work-orders/fake/assign",
                          json={"staff_id": "x"}).status_code == 401

    def test_requires_management_role(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com", role="owner")
        headers = _login(client, "owner@jkr.com")
        assert client.put("/api/v1/maintenance/work-orders/fake/assign",
                          json={"staff_id": "x"}, headers=headers).status_code == 403

    def test_assign_success(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        staff = _make_staff(db_session)
        db_session.commit()
        wo = client.post("/api/v1/maintenance/work-orders", json=_wo_payload(), headers=headers).json()
        resp = client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/assign",
                          json={"staff_id": staff.staff_id}, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["assigned_to"] == staff.staff_id
        assert data["status"] == "assigned"

    def test_assign_unknown_wo_returns_404(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        staff = _make_staff(db_session)
        db_session.commit()
        resp = client.put("/api/v1/maintenance/work-orders/00000000-0000-0000-0000-000000000000/assign",
                          json={"staff_id": staff.staff_id}, headers=headers)
        assert resp.status_code == 404

    def test_assign_unknown_staff_returns_404(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        wo = client.post("/api/v1/maintenance/work-orders", json=_wo_payload(), headers=headers).json()
        resp = client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/assign",
                          json={"staff_id": "00000000-0000-0000-0000-000000000000"}, headers=headers)
        assert resp.status_code == 404

    def test_assign_in_progress_order_does_not_regress_status(self, client, db_session):
        """Assigning an already-in-progress order should not change its status."""
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        staff = _make_staff(db_session)
        staff2 = _make_staff(db_session, name="Other Staff")
        db_session.commit()
        wo = client.post("/api/v1/maintenance/work-orders",
                         json=_wo_payload(assigned_to=staff.staff_id), headers=headers).json()
        # advance to in_progress
        client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                   json={"status": "in_progress"}, headers=headers)
        # re-assign
        resp = client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/assign",
                          json={"staff_id": staff2.staff_id}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"  # not regressed


# ── PUT /api/v1/maintenance/work-orders/{id}/status ──────────────────────────

class TestUpdateWorkOrderStatus:

    def _create_wo(self, client, headers, **overrides):
        return client.post("/api/v1/maintenance/work-orders",
                           json=_wo_payload(**overrides), headers=headers).json()

    def test_requires_auth(self, client, db_session):
        assert client.put("/api/v1/maintenance/work-orders/fake/status",
                          json={"status": "assigned"}).status_code == 401

    def test_open_to_assigned(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        wo = self._create_wo(client, headers)
        resp = client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                          json={"status": "assigned"}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "assigned"

    def test_assigned_to_in_progress(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        wo = self._create_wo(client, headers)
        client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                   json={"status": "assigned"}, headers=headers)
        resp = client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                          json={"status": "in_progress"}, headers=headers)
        assert resp.status_code == 200
        assert resp.json()["status"] == "in_progress"

    def test_in_progress_to_completed_with_outcome(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        wo = self._create_wo(client, headers)
        client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                   json={"status": "assigned"}, headers=headers)
        client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                   json={"status": "in_progress"}, headers=headers)
        resp = client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                          json={"status": "completed", "outcome": "Fixed and tested."}, headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "completed"
        assert data["outcome"] == "Fixed and tested."
        assert data["completed_at"] is not None
        assert data["is_overdue"] is False

    def test_complete_without_outcome_returns_400(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        wo = self._create_wo(client, headers)
        client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                   json={"status": "assigned"}, headers=headers)
        client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                   json={"status": "in_progress"}, headers=headers)
        resp = client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                          json={"status": "completed"}, headers=headers)
        assert resp.status_code == 400
        assert "outcome" in resp.json()["detail"].lower()

    def test_skip_ahead_transition_returns_400(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        wo = self._create_wo(client, headers)
        # open → in_progress (skipping assigned)
        resp = client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                          json={"status": "in_progress"}, headers=headers)
        assert resp.status_code == 400

    def test_backward_transition_returns_400(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        wo = self._create_wo(client, headers)
        client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                   json={"status": "assigned"}, headers=headers)
        # assigned → open (backward)
        resp = client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                          json={"status": "open"}, headers=headers)
        assert resp.status_code == 400

    def test_same_status_returns_400(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        wo = self._create_wo(client, headers)
        resp = client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                          json={"status": "open"}, headers=headers)
        assert resp.status_code == 400

    def test_404_unknown_wo(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        resp = client.put("/api/v1/maintenance/work-orders/00000000-0000-0000-0000-000000000000/status",
                          json={"status": "assigned"}, headers=headers)
        assert resp.status_code == 404

    def test_maintenance_staff_can_update_status(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        admin_h = _login(client, "admin@jkr.com")
        _register_activate(client, db_session, "maint@jkr.com", role="maintenance")
        maint_h = _login(client, "maint@jkr.com")
        wo = self._create_wo(client, admin_h)
        resp = client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                          json={"status": "assigned"}, headers=maint_h)
        assert resp.status_code == 200


# ── GET /api/v1/maintenance/assets/{id}/history ───────────────────────────────

class TestAssetHistory:

    def test_requires_auth(self, client, db_session):
        assert client.get("/api/v1/maintenance/assets/AST-ELV-A/history").status_code == 401

    def test_empty_history(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        resp = client.get("/api/v1/maintenance/assets/AST-ELV-A/history", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []

    def test_only_completed_orders_in_history(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        # Create and complete one order
        wo = client.post("/api/v1/maintenance/work-orders",
                         json=_wo_payload(asset_id="AST-ELV-A"), headers=headers).json()
        client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                   json={"status": "assigned"}, headers=headers)
        client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                   json={"status": "in_progress"}, headers=headers)
        client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                   json={"status": "completed", "outcome": "Done."}, headers=headers)
        # Create an open order for same asset
        client.post("/api/v1/maintenance/work-orders",
                    json=_wo_payload(asset_id="AST-ELV-A", title="Open WO"), headers=headers)

        resp = client.get("/api/v1/maintenance/assets/AST-ELV-A/history", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1
        assert resp.json()[0]["status"] == "completed"

    def test_different_asset_not_in_history(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        wo = client.post("/api/v1/maintenance/work-orders",
                         json=_wo_payload(asset_id="AST-GEN-1"), headers=headers).json()
        client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                   json={"status": "assigned"}, headers=headers)
        client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                   json={"status": "in_progress"}, headers=headers)
        client.put(f"/api/v1/maintenance/work-orders/{wo['work_order_id']}/status",
                   json={"status": "completed", "outcome": "Done."}, headers=headers)

        resp = client.get("/api/v1/maintenance/assets/AST-ELV-A/history", headers=headers)
        assert resp.json() == []
