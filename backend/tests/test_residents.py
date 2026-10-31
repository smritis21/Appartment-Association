"""
pytest tests for BE-18 — Resident Management API.

Covers:
  - Create resident (success, flat not found, validation errors, duplicate)
  - Get resident by ID (success, not found, invalid UUID format)
  - List residents (success, status filter, pagination, boundary)
  - Search residents (success, too short query, empty results)
  - Update resident (success, not found, partial/single-field update, moved_out)
  - Delete resident (soft delete success, not found, delete twice)

Fixtures (client, db_session) are defined in conftest.py.
"""


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_flat(db_session):
    """Insert a flat directly into the test DB and return its flat_id."""
    from app.models.resident import Flat
    flat = Flat(
        block="A",
        floor="1",
        flat_number="101",
        ownership_type="owned",
        occupancy_status="vacant",
    )
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    return flat.flat_id


def resident_payload(flat_id: str, **overrides) -> dict:
    payload = {
        "flat_id": flat_id,
        "name": "Ravi Kumar",
        "phone": "9876543210",
        "occupation": "Engineer",
        "move_in_date": "2024-01-15",
        "status": "active",
        "family_members": [
            {"name": "Priya Kumar", "relation": "spouse", "phone": "9876543211"}
        ],
        "emergency_contacts": [
            {"name": "Suresh Kumar", "relationship": "father", "phone": "9876543212"}
        ],
    }
    payload.update(overrides)
    return payload


def create_resident(client, db_session, **overrides) -> dict:
    """Seed a flat and create a resident, return the response JSON."""
    flat_id = seed_flat(db_session)
    return client.post(
        "/api/v1/residents", json=resident_payload(flat_id, **overrides)
    ).json()


# ── POST /api/v1/residents ────────────────────────────────────────────────────

class TestCreateResident:

    def test_create_resident_success(self, client, db_session):
        flat_id = seed_flat(db_session)
        response = client.post("/api/v1/residents", json=resident_payload(flat_id))

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Ravi Kumar"
        assert data["phone"] == "9876543210"
        assert data["status"] == "active"
        assert data["flat_id"] == flat_id
        assert len(data["family_members"]) == 1
        assert len(data["emergency_contacts"]) == 1
        assert "resident_id" in data

    def test_create_resident_flat_not_found(self, client, db_session):
        response = client.post(
            "/api/v1/residents",
            json=resident_payload("non-existent-flat-id"),
        )
        assert response.status_code == 404
        assert "Flat" in response.json()["detail"]

    def test_create_resident_missing_name(self, client, db_session):
        flat_id = seed_flat(db_session)
        payload = resident_payload(flat_id)
        del payload["name"]
        response = client.post("/api/v1/residents", json=payload)
        assert response.status_code == 422

    def test_create_resident_invalid_phone(self, client, db_session):
        flat_id = seed_flat(db_session)
        response = client.post(
            "/api/v1/residents",
            json=resident_payload(flat_id, phone="not-a-phone!!"),
        )
        assert response.status_code == 422

    def test_create_resident_invalid_status(self, client, db_session):
        flat_id = seed_flat(db_session)
        response = client.post(
            "/api/v1/residents",
            json=resident_payload(flat_id, status="unknown_status"),
        )
        assert response.status_code == 422

    def test_create_resident_no_family_or_contacts(self, client, db_session):
        flat_id = seed_flat(db_session)
        payload = resident_payload(flat_id)
        payload["family_members"] = []
        payload["emergency_contacts"] = []
        response = client.post("/api/v1/residents", json=payload)
        assert response.status_code == 201
        assert response.json()["family_members"] == []
        assert response.json()["emergency_contacts"] == []

    def test_create_duplicate_resident_same_flat(self, client, db_session):
        """Two residents can share a flat (e.g. owner + tenant) — both should succeed."""
        flat_id = seed_flat(db_session)
        r1 = client.post("/api/v1/residents",
                         json=resident_payload(flat_id, name="Resident One", phone="9876543210"))
        r2 = client.post("/api/v1/residents",
                         json=resident_payload(flat_id, name="Resident Two", phone="9811111111"))
        assert r1.status_code == 201
        assert r2.status_code == 201
        # Each gets a unique resident_id
        assert r1.json()["resident_id"] != r2.json()["resident_id"]

    def test_same_phone_in_same_flat_is_rejected(self, client, db_session):
        """Same phone at the same flat is one person entered twice, not two residents."""
        flat_id = seed_flat(db_session)
        first = client.post("/api/v1/residents",
                            json=resident_payload(flat_id, name="Ravi Kumar", phone="9876543210"))
        assert first.status_code == 201

        duplicate = client.post("/api/v1/residents",
                                json=resident_payload(flat_id, name="Ravi K.", phone="9876543210"))
        assert duplicate.status_code == 409


# ── GET /api/v1/residents/{id} ────────────────────────────────────────────────

class TestGetResident:

    def test_get_resident_success(self, client, db_session):
        flat_id = seed_flat(db_session)
        created = client.post("/api/v1/residents", json=resident_payload(flat_id)).json()
        resident_id = created["resident_id"]

        response = client.get(f"/api/v1/residents/{resident_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["resident_id"] == resident_id
        assert data["name"] == "Ravi Kumar"
        assert data["flat"]["flat_number"] == "101"

    def test_get_resident_not_found(self, client, db_session):
        response = client.get("/api/v1/residents/does-not-exist")
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_resident_invalid_uuid_format(self, client, db_session):
        """A garbage string that looks nothing like a UUID should return 404, not 500."""
        response = client.get("/api/v1/residents/!!!invalid-uuid!!!")
        assert response.status_code == 404


# ── GET /api/v1/residents ─────────────────────────────────────────────────────

class TestListResidents:

    def test_list_residents_empty(self, client, db_session):
        response = client.get("/api/v1/residents")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_residents_returns_created(self, client, db_session):
        flat_id = seed_flat(db_session)
        client.post("/api/v1/residents", json=resident_payload(flat_id))
        response = client.get("/api/v1/residents")
        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_list_residents_status_filter(self, client, db_session):
        flat_id = seed_flat(db_session)
        client.post("/api/v1/residents", json=resident_payload(flat_id, status="active"))
        client.post("/api/v1/residents", json=resident_payload(flat_id, name="Moved Out Person", status="moved_out"))

        active = client.get("/api/v1/residents?status=active").json()
        moved  = client.get("/api/v1/residents?status=moved_out").json()

        assert all(r["status"] == "active" for r in active)
        assert all(r["status"] == "moved_out" for r in moved)

    def test_list_residents_pagination(self, client, db_session):
        flat_id = seed_flat(db_session)
        for i in range(5):
            client.post("/api/v1/residents", json=resident_payload(
                flat_id, name=f"Resident {i}", phone=f"98765432{10 + i}"))

        page1 = client.get("/api/v1/residents?skip=0&limit=3").json()
        page2 = client.get("/api/v1/residents?skip=3&limit=3").json()

        assert len(page1) == 3
        assert len(page2) == 2

    def test_list_residents_pagination_boundary_skip_beyond_total(self, client, db_session):
        """Skipping past all records should return an empty list, not an error."""
        flat_id = seed_flat(db_session)
        client.post("/api/v1/residents", json=resident_payload(flat_id))

        response = client.get("/api/v1/residents?skip=999&limit=20")
        assert response.status_code == 200
        assert response.json() == []

    def test_list_residents_limit_cap_enforced(self, client, db_session):
        """Requesting more than 100 records should return a 422 validation error."""
        response = client.get("/api/v1/residents?limit=101")
        assert response.status_code == 422


# ── GET /api/v1/residents/search ──────────────────────────────────────────────

class TestSearchResidents:

    def test_search_by_name(self, client, db_session):
        flat_id = seed_flat(db_session)
        client.post("/api/v1/residents", json=resident_payload(flat_id, name="Anita Sharma"))
        client.post("/api/v1/residents", json=resident_payload(flat_id, name="Ravi Kumar"))

        response = client.get("/api/v1/residents/search?q=anita")
        assert response.status_code == 200
        results = response.json()
        assert len(results) == 1
        assert results[0]["name"] == "Anita Sharma"

    def test_search_by_phone(self, client, db_session):
        flat_id = seed_flat(db_session)
        client.post("/api/v1/residents", json=resident_payload(flat_id, phone="9999999999"))

        response = client.get("/api/v1/residents/search?q=9999999999")
        assert response.status_code == 200
        assert len(response.json()) == 1

    def test_search_no_results(self, client, db_session):
        response = client.get("/api/v1/residents/search?q=zzznomatch")
        assert response.status_code == 200
        assert response.json() == []

    def test_search_query_too_short(self, client, db_session):
        response = client.get("/api/v1/residents/search?q=a")
        assert response.status_code == 422

    def test_search_empty_db_returns_empty_list(self, client, db_session):
        """Search on an empty database should return [] not an error."""
        response = client.get("/api/v1/residents/search?q=anyone")
        assert response.status_code == 200
        assert response.json() == []


# ── PUT /api/v1/residents/{id} ────────────────────────────────────────────────

class TestUpdateResident:

    def test_update_resident_success(self, client, db_session):
        flat_id = seed_flat(db_session)
        created = client.post("/api/v1/residents", json=resident_payload(flat_id)).json()
        resident_id = created["resident_id"]

        response = client.put(
            f"/api/v1/residents/{resident_id}",
            json={"name": "Ravi Kumar Updated", "occupation": "Manager"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Ravi Kumar Updated"
        assert data["occupation"] == "Manager"
        assert data["phone"] == "9876543210"  # unchanged

    def test_update_single_field_only(self, client, db_session):
        """Sending only one field must not wipe out the rest."""
        flat_id = seed_flat(db_session)
        created = client.post("/api/v1/residents", json=resident_payload(flat_id)).json()
        resident_id = created["resident_id"]

        response = client.put(
            f"/api/v1/residents/{resident_id}",
            json={"occupation": "Doctor"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["occupation"] == "Doctor"
        assert data["name"] == "Ravi Kumar"        # unchanged
        assert data["phone"] == "9876543210"       # unchanged
        assert data["status"] == "active"          # unchanged

    def test_update_status_to_moved_out(self, client, db_session):
        flat_id = seed_flat(db_session)
        created = client.post("/api/v1/residents", json=resident_payload(flat_id)).json()
        resident_id = created["resident_id"]

        response = client.put(
            f"/api/v1/residents/{resident_id}",
            json={"status": "moved_out"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "moved_out"
        assert data["move_out_date"] is not None

    def test_update_resident_not_found(self, client, db_session):
        response = client.put(
            "/api/v1/residents/does-not-exist",
            json={"name": "Ghost"},
        )
        assert response.status_code == 404

    def test_update_resident_invalid_flat(self, client, db_session):
        flat_id = seed_flat(db_session)
        created = client.post("/api/v1/residents", json=resident_payload(flat_id)).json()
        resident_id = created["resident_id"]

        response = client.put(
            f"/api/v1/residents/{resident_id}",
            json={"flat_id": "non-existent-flat"},
        )
        assert response.status_code == 404


# ── DELETE /api/v1/residents/{id} ─────────────────────────────────────────────

class TestDeleteResident:

    def test_delete_resident_soft_delete(self, client, db_session):
        """DELETE sets status to inactive — record still exists."""
        flat_id = seed_flat(db_session)
        created = client.post("/api/v1/residents", json=resident_payload(flat_id)).json()
        resident_id = created["resident_id"]

        response = client.delete(f"/api/v1/residents/{resident_id}")
        assert response.status_code == 200
        assert "deactivated" in response.json()["detail"].lower()

        # Record still exists but is now inactive
        get_response = client.get(f"/api/v1/residents/{resident_id}")
        assert get_response.status_code == 200
        assert get_response.json()["status"] == "inactive"

    def test_delete_resident_not_found(self, client, db_session):
        response = client.delete("/api/v1/residents/does-not-exist")
        assert response.status_code == 404

    def test_delete_resident_twice(self, client, db_session):
        """Deleting an already-inactive resident should still succeed (idempotent soft delete)."""
        flat_id = seed_flat(db_session)
        created = client.post("/api/v1/residents", json=resident_payload(flat_id)).json()
        resident_id = created["resident_id"]

        first  = client.delete(f"/api/v1/residents/{resident_id}")
        second = client.delete(f"/api/v1/residents/{resident_id}")

        assert first.status_code == 200
        assert second.status_code == 200  # soft delete is idempotent
