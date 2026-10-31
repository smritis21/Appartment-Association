"""
pytest tests for BE-23 — Directory API.

Covers:
  GET /api/v1/directory                         — overview counts
  GET /api/v1/directory/residents               — list, filters, phone masking
  GET /api/v1/directory/residents/{id}          — detail, RBAC masking
  GET /api/v1/directory/flats                   — list, filters
  GET /api/v1/directory/flats/{id}              — flat detail with residents
  GET /api/v1/directory/household/{id}          — family members
  GET /api/v1/directory/emergency-contacts/{id} — RBAC gating
  GET /api/v1/directory/search                  — combined search
"""

import pytest
from app.models.resident import EmergencyContact, FamilyMember, Flat, Resident
from app.models.user import User


# ── Helpers ───────────────────────────────────────────────────────────────────

def _register_activate(client, db_session, email, role="owner") -> str:
    resp = client.post("/api/v1/auth/register", json={
        "email": email, "password": "password123",
        "full_name": "Test User", "role": role,
    })
    assert resp.status_code == 201
    user_id = resp.json()["user_id"]
    user = db_session.query(User).filter(User.user_id == user_id).first()
    user.account_status = "active"
    db_session.commit()
    return user_id


def _login(client, email, password="password123") -> dict:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _make_flat(db_session, block="A", flat_number="101",
               ownership_type="owned", occupancy_status="occupied") -> Flat:
    flat = Flat(block=block, flat_number=flat_number,
                ownership_type=ownership_type, occupancy_status=occupancy_status)
    db_session.add(flat)
    db_session.flush()
    return flat


def _make_resident(db_session, flat_id, name="Alice", phone="9876543210",
                   status="active", user_id=None) -> Resident:
    r = Resident(flat_id=flat_id, name=name, phone=phone,
                 status=status, user_id=user_id)
    db_session.add(r)
    db_session.flush()
    return r


def _make_family_member(db_session, resident_id, name="Bob", relation="spouse") -> FamilyMember:
    fm = FamilyMember(resident_id=resident_id, name=name, relation=relation)
    db_session.add(fm)
    db_session.flush()
    return fm


def _make_emergency_contact(db_session, resident_id, name="Eve", phone="1112223333") -> EmergencyContact:
    ec = EmergencyContact(resident_id=resident_id, name=name, phone=phone, relationship="parent")
    db_session.add(ec)
    db_session.flush()
    return ec


# ── GET /api/v1/directory ─────────────────────────────────────────────────────

class TestDirectoryOverview:

    def test_overview_requires_auth(self, client, db_session):
        assert client.get("/api/v1/directory").status_code == 401

    def test_overview_empty_db(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        resp = client.get("/api/v1/directory", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_flats"] == 0
        assert data["total_residents"] == 0
        assert data["blocks"] == []

    def test_overview_counts(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")

        f1 = _make_flat(db_session, block="A", flat_number="101", occupancy_status="occupied")
        f2 = _make_flat(db_session, block="B", flat_number="201", occupancy_status="vacant")
        _make_resident(db_session, f1.flat_id, status="active")
        _make_resident(db_session, f1.flat_id, name="Carol", status="inactive")
        db_session.commit()

        resp = client.get("/api/v1/directory", headers=headers)
        data = resp.json()
        assert data["total_flats"] == 2
        assert data["occupied_flats"] == 1
        assert data["vacant_flats"] == 1
        assert data["total_residents"] == 2
        assert data["active_residents"] == 1
        assert set(data["blocks"]) == {"A", "B"}


# ── GET /api/v1/directory/residents ──────────────────────────────────────────

class TestListResidents:

    def test_requires_auth(self, client, db_session):
        assert client.get("/api/v1/directory/residents").status_code == 401

    def test_returns_residents(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        _make_resident(db_session, flat.flat_id, name="Alice")
        _make_resident(db_session, flat.flat_id, name="Bob")
        db_session.commit()

        resp = client.get("/api/v1/directory/residents", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_filter_by_status(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        _make_resident(db_session, flat.flat_id, name="Active", status="active")
        _make_resident(db_session, flat.flat_id, name="Moved", status="moved_out")
        db_session.commit()

        resp = client.get("/api/v1/directory/residents?status=active", headers=headers)
        assert resp.status_code == 200
        assert all(r["status"] == "active" for r in resp.json())

    def test_filter_by_block(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        fa = _make_flat(db_session, block="A", flat_number="101")
        fb = _make_flat(db_session, block="B", flat_number="201")
        _make_resident(db_session, fa.flat_id, name="InA")
        _make_resident(db_session, fb.flat_id, name="InB")
        db_session.commit()

        resp = client.get("/api/v1/directory/residents?block=A", headers=headers)
        assert resp.status_code == 200
        names = [r["name"] for r in resp.json()]
        assert "InA" in names
        assert "InB" not in names

    def test_filter_by_resident_type_owner(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        fo = _make_flat(db_session, block="A", flat_number="101", ownership_type="owned")
        fr = _make_flat(db_session, block="A", flat_number="102", ownership_type="rented")
        _make_resident(db_session, fo.flat_id, name="Owner")
        _make_resident(db_session, fr.flat_id, name="Tenant")
        db_session.commit()

        resp = client.get("/api/v1/directory/residents?resident_type=owner", headers=headers)
        names = [r["name"] for r in resp.json()]
        assert "Owner" in names
        assert "Tenant" not in names

    def test_pagination(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        for i in range(5):
            _make_resident(db_session, flat.flat_id, name=f"R{i}", phone=f"900000000{i}")
        db_session.commit()

        resp = client.get("/api/v1/directory/residents?skip=0&limit=3", headers=headers)
        assert len(resp.json()) == 3
        resp2 = client.get("/api/v1/directory/residents?skip=3&limit=3", headers=headers)
        assert len(resp2.json()) == 2

    def test_phone_masked_for_non_management_viewing_others(self, client, db_session):
        uid = _register_activate(client, db_session, "owner@jkr.com", role="owner")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        # resident NOT linked to this user
        _make_resident(db_session, flat.flat_id, name="Other", phone="9876543210")
        db_session.commit()

        resp = client.get("/api/v1/directory/residents", headers=headers)
        assert resp.status_code == 200
        phones = [r["phone"] for r in resp.json() if r["phone"]]
        assert all("*" in p for p in phones)

    def test_phone_visible_for_management(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        flat = _make_flat(db_session)
        _make_resident(db_session, flat.flat_id, name="Someone", phone="9876543210")
        db_session.commit()

        resp = client.get("/api/v1/directory/residents", headers=headers)
        phones = [r["phone"] for r in resp.json() if r["phone"]]
        assert all("*" not in p for p in phones)

    def test_own_phone_visible_to_owner(self, client, db_session):
        uid = _register_activate(client, db_session, "owner@jkr.com", role="owner")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        resident = _make_resident(db_session, flat.flat_id, name="Self", phone="9876543210")
        # link resident to user
        user = db_session.query(User).filter(User.user_id == uid).first()
        user.resident_id = resident.resident_id
        db_session.commit()

        resp = client.get("/api/v1/directory/residents", headers=headers)
        own = next(r for r in resp.json() if r["resident_id"] == resident.resident_id)
        assert own["phone"] == "9876543210"


# ── GET /api/v1/directory/residents/{id} ─────────────────────────────────────

class TestGetResident:

    def test_requires_auth(self, client, db_session):
        assert client.get("/api/v1/directory/residents/fake-id").status_code == 401

    def test_404_unknown(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        resp = client.get("/api/v1/directory/residents/00000000-0000-0000-0000-000000000000", headers=headers)
        assert resp.status_code == 404

    def test_returns_full_profile(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        flat = _make_flat(db_session)
        r = _make_resident(db_session, flat.flat_id, name="Alice", phone="9876543210")
        _make_family_member(db_session, r.resident_id)
        _make_emergency_contact(db_session, r.resident_id)
        db_session.commit()

        resp = client.get(f"/api/v1/directory/residents/{r.resident_id}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Alice"
        assert data["phone"] == "9876543210"
        assert len(data["family_members"]) == 1
        assert len(data["emergency_contacts"]) == 1

    def test_phone_masked_for_non_management(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com", role="owner")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        r = _make_resident(db_session, flat.flat_id, phone="9876543210")
        _make_emergency_contact(db_session, r.resident_id)
        db_session.commit()

        resp = client.get(f"/api/v1/directory/residents/{r.resident_id}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "*" in data["phone"]
        assert data["emergency_contacts"] == []

    def test_own_profile_unmasked(self, client, db_session):
        uid = _register_activate(client, db_session, "owner@jkr.com", role="owner")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        r = _make_resident(db_session, flat.flat_id, phone="9876543210")
        user = db_session.query(User).filter(User.user_id == uid).first()
        user.resident_id = r.resident_id
        _make_emergency_contact(db_session, r.resident_id)
        db_session.commit()

        resp = client.get(f"/api/v1/directory/residents/{r.resident_id}", headers=headers)
        data = resp.json()
        assert data["phone"] == "9876543210"
        assert len(data["emergency_contacts"]) == 1


# ── GET /api/v1/directory/flats ──────────────────────────────────────────────

class TestListFlats:

    def test_requires_auth(self, client, db_session):
        assert client.get("/api/v1/directory/flats").status_code == 401

    def test_returns_flats(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        _make_flat(db_session, block="A", flat_number="101")
        _make_flat(db_session, block="B", flat_number="201")
        db_session.commit()

        resp = client.get("/api/v1/directory/flats", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_filter_by_block(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        _make_flat(db_session, block="A", flat_number="101")
        _make_flat(db_session, block="B", flat_number="201")
        db_session.commit()

        resp = client.get("/api/v1/directory/flats?block=A", headers=headers)
        assert all(f["block"] == "A" for f in resp.json())

    def test_filter_by_ownership_type(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        _make_flat(db_session, block="A", flat_number="101", ownership_type="owned")
        _make_flat(db_session, block="A", flat_number="102", ownership_type="rented")
        db_session.commit()

        resp = client.get("/api/v1/directory/flats?ownership_type=owned", headers=headers)
        assert all(f["ownership_type"] == "owned" for f in resp.json())

    def test_filter_by_occupancy_status(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        _make_flat(db_session, block="A", flat_number="101", occupancy_status="occupied")
        _make_flat(db_session, block="A", flat_number="102", occupancy_status="vacant")
        db_session.commit()

        resp = client.get("/api/v1/directory/flats?occupancy_status=vacant", headers=headers)
        assert all(f["occupancy_status"] == "vacant" for f in resp.json())

    def test_flat_includes_active_residents(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        _make_resident(db_session, flat.flat_id, name="Active", status="active")
        _make_resident(db_session, flat.flat_id, name="Moved", status="moved_out")
        db_session.commit()

        resp = client.get("/api/v1/directory/flats", headers=headers)
        f = resp.json()[0]
        assert f["resident_count"] == 1
        assert len(f["residents"]) == 1
        assert f["residents"][0]["name"] == "Active"

    def test_pagination(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        for i in range(5):
            _make_flat(db_session, block="A", flat_number=f"10{i}")
        db_session.commit()

        resp = client.get("/api/v1/directory/flats?skip=0&limit=3", headers=headers)
        assert len(resp.json()) == 3


# ── GET /api/v1/directory/flats/{id} ─────────────────────────────────────────

class TestGetFlat:

    def test_requires_auth(self, client, db_session):
        assert client.get("/api/v1/directory/flats/fake-id").status_code == 401

    def test_404_unknown(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        resp = client.get("/api/v1/directory/flats/00000000-0000-0000-0000-000000000000", headers=headers)
        assert resp.status_code == 404

    def test_returns_flat_with_residents(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session, block="C", flat_number="301")
        _make_resident(db_session, flat.flat_id, name="Resident1")
        db_session.commit()

        resp = client.get(f"/api/v1/directory/flats/{flat.flat_id}", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["block"] == "C"
        assert data["flat_number"] == "301"
        assert data["resident_count"] == 1


# ── GET /api/v1/directory/household/{id} ─────────────────────────────────────

class TestGetHousehold:

    def test_requires_auth(self, client, db_session):
        assert client.get("/api/v1/directory/household/fake-id").status_code == 401

    def test_404_unknown_resident(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        resp = client.get("/api/v1/directory/household/00000000-0000-0000-0000-000000000000", headers=headers)
        assert resp.status_code == 404

    def test_returns_family_members(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        r = _make_resident(db_session, flat.flat_id)
        _make_family_member(db_session, r.resident_id, name="Spouse", relation="spouse")
        _make_family_member(db_session, r.resident_id, name="Child", relation="child")
        db_session.commit()

        resp = client.get(f"/api/v1/directory/household/{r.resident_id}", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_empty_household(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        r = _make_resident(db_session, flat.flat_id)
        db_session.commit()

        resp = client.get(f"/api/v1/directory/household/{r.resident_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json() == []


# ── GET /api/v1/directory/emergency-contacts/{id} ────────────────────────────

class TestGetEmergencyContacts:

    def test_requires_auth(self, client, db_session):
        assert client.get("/api/v1/directory/emergency-contacts/fake-id").status_code == 401

    def test_404_unknown_resident(self, client, db_session):
        _register_activate(client, db_session, "admin@jkr.com", role="admin")
        headers = _login(client, "admin@jkr.com")
        resp = client.get("/api/v1/directory/emergency-contacts/00000000-0000-0000-0000-000000000000", headers=headers)
        assert resp.status_code == 404

    def test_management_can_access(self, client, db_session):
        for role, email in [("admin", "admin@jkr.com"), ("president", "pres@jkr.com"), ("secretary", "sec@jkr.com")]:
            _register_activate(client, db_session, email, role=role)
        flat = _make_flat(db_session)
        r = _make_resident(db_session, flat.flat_id)
        _make_emergency_contact(db_session, r.resident_id)
        db_session.commit()

        for email in ["admin@jkr.com", "pres@jkr.com", "sec@jkr.com"]:
            headers = _login(client, email)
            resp = client.get(f"/api/v1/directory/emergency-contacts/{r.resident_id}", headers=headers)
            assert resp.status_code == 200
            assert len(resp.json()) == 1

    def test_owner_blocked_for_other_resident(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com", role="owner")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        r = _make_resident(db_session, flat.flat_id)
        _make_emergency_contact(db_session, r.resident_id)
        db_session.commit()

        resp = client.get(f"/api/v1/directory/emergency-contacts/{r.resident_id}", headers=headers)
        assert resp.status_code == 403

    def test_owner_can_access_own_contacts(self, client, db_session):
        uid = _register_activate(client, db_session, "owner@jkr.com", role="owner")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        r = _make_resident(db_session, flat.flat_id)
        user = db_session.query(User).filter(User.user_id == uid).first()
        user.resident_id = r.resident_id
        _make_emergency_contact(db_session, r.resident_id)
        db_session.commit()

        resp = client.get(f"/api/v1/directory/emergency-contacts/{r.resident_id}", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 1


# ── GET /api/v1/directory/search ─────────────────────────────────────────────

class TestSearch:

    def test_requires_auth(self, client, db_session):
        assert client.get("/api/v1/directory/search?q=Alice").status_code == 401

    def test_query_too_short(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        resp = client.get("/api/v1/directory/search?q=A", headers=headers)
        assert resp.status_code == 422

    def test_finds_resident_by_name(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        _make_resident(db_session, flat.flat_id, name="Zephyr")
        db_session.commit()

        resp = client.get("/api/v1/directory/search?q=Zeph", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert any(r["name"] == "Zephyr" for r in data["residents"])

    def test_finds_flat_by_block(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        _make_flat(db_session, block="ZZ", flat_number="999")
        db_session.commit()

        resp = client.get("/api/v1/directory/search?q=ZZ", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert any(f["block"] == "ZZ" for f in data["flats"])

    def test_search_result_structure(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        resp = client.get("/api/v1/directory/search?q=xx", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "residents" in data
        assert "flats" in data

    def test_search_masks_phones_for_non_management(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com", role="owner")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session, block="A", flat_number="101")
        _make_resident(db_session, flat.flat_id, name="Masked Person", phone="9876543210")
        db_session.commit()

        resp = client.get("/api/v1/directory/search?q=Masked", headers=headers)
        phones = [r["phone"] for r in resp.json()["residents"] if r.get("phone")]
        assert all("*" in p for p in phones)

    def test_search_limit(self, client, db_session):
        _register_activate(client, db_session, "owner@jkr.com")
        headers = _login(client, "owner@jkr.com")
        flat = _make_flat(db_session)
        for i in range(5):
            _make_resident(db_session, flat.flat_id, name=f"Common{i}", phone=f"900000000{i}")
        db_session.commit()

        resp = client.get("/api/v1/directory/search?q=Common&limit=3", headers=headers)
        assert len(resp.json()["residents"]) <= 3
