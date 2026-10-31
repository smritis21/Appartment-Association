"""
pytest tests for BE-22 — Onboarding & Approval API.

Covers:
  POST /api/v1/onboarding/register
    - owner registration
    - tenant registration
    - duplicate registration (409)
    - missing required fields (422)
    - invalid email (422)
    - invalid phone (422)

  POST /api/v1/onboarding/upload-document
    - successful upload
    - upload to non-existent application (404)
    - upload to approved application (400)
    - invalid document_type (422)

  GET /api/v1/onboarding/status/{id}
    - status lookup success
    - unknown application (404)

  GET /api/v1/onboarding/pending
    - returns pending list (secretary/admin/president)
    - forbidden for owner role (403)
    - unauthenticated (401)

  GET /api/v1/onboarding/{id}
    - detail returned for reviewer
    - forbidden for owner (403)

  PUT /api/v1/onboarding/{id}/approve
    - successful approval — resident created, user activated
    - approval twice (409)
    - approve rejected application (409)
    - invalid application (404)
    - forbidden role (403)
    - unauthenticated (401)

  PUT /api/v1/onboarding/{id}/reject
    - successful rejection
    - rejection twice (409)
    - reject approved application (409)
    - missing rejection_reason (422)
    - invalid application (404)
    - forbidden role (403)

  Profile linkage
    - resident_id set on User after approval
    - account_status active after approval

  Audit log
    - audit entry written on submission
    - audit entry written on approval
    - audit entry written on rejection

Fixtures (client, db_session) are defined in conftest.py.
"""

import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

def _reg_payload(**overrides) -> dict:
    payload = {
        "applicant_name": "Ravi Kumar",
        "email": "ravi@jkr.com",
        "phone": "9876543210",
        "applicant_type": "owner",
        "block": "A",
        "floor": "2",
        "flat_number": "201",
        "move_in_date": "2024-01-15",
        "occupation": "Engineer",
    }
    payload.update(overrides)
    return payload


def _register(client, **overrides) -> dict:
    resp = client.post("/api/v1/onboarding/register", json=_reg_payload(**overrides))
    assert resp.status_code == 201
    return resp.json()


def _make_reviewer(client, db_session, role: str = "secretary") -> str:
    """Register + activate a reviewer account, return Bearer token."""
    from app.utils.security import hash_password
    from app.models.user import User
    import uuid
    user = User(
        user_id=str(uuid.uuid4()),
        email=f"{role}_{uuid.uuid4().hex[:6]}@jkr.com",
        hashed_password=hash_password("password123"),
        full_name="Reviewer",
        role=role,
        account_status="active",
    )
    db_session.add(user)
    db_session.commit()

    resp = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "password123"},
    )
    assert resp.status_code == 200
    return resp.json()["access_token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── POST /api/v1/onboarding/register ─────────────────────────────────────────

class TestRegister:

    def test_owner_registration(self, client, db_session):
        resp = client.post("/api/v1/onboarding/register", json=_reg_payload())
        assert resp.status_code == 201
        data = resp.json()
        assert data["applicant_type"] == "owner"
        assert data["status"] == "pending"
        assert data["email"] == "ravi@jkr.com"
        assert "application_id" in data

    def test_tenant_registration(self, client, db_session):
        resp = client.post(
            "/api/v1/onboarding/register",
            json=_reg_payload(applicant_type="tenant", email="tenant@jkr.com"),
        )
        assert resp.status_code == 201
        assert resp.json()["applicant_type"] == "tenant"
        assert resp.json()["status"] == "pending"

    def test_duplicate_registration_rejected(self, client, db_session):
        _register(client)
        resp = client.post("/api/v1/onboarding/register", json=_reg_payload())
        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"].lower()

    def test_duplicate_email_case_insensitive(self, client, db_session):
        _register(client, email="Ravi@JKR.com")
        resp = client.post(
            "/api/v1/onboarding/register",
            json=_reg_payload(email="ravi@jkr.com"),
        )
        assert resp.status_code == 409

    def test_missing_required_field(self, client, db_session):
        payload = _reg_payload()
        del payload["applicant_name"]
        resp = client.post("/api/v1/onboarding/register", json=payload)
        assert resp.status_code == 422

    def test_invalid_email(self, client, db_session):
        resp = client.post(
            "/api/v1/onboarding/register",
            json=_reg_payload(email="not-an-email"),
        )
        assert resp.status_code == 422

    def test_invalid_phone(self, client, db_session):
        resp = client.post(
            "/api/v1/onboarding/register",
            json=_reg_payload(phone="abc-xyz"),
        )
        assert resp.status_code == 422

    def test_invalid_applicant_type(self, client, db_session):
        resp = client.post(
            "/api/v1/onboarding/register",
            json=_reg_payload(applicant_type="manager"),
        )
        assert resp.status_code == 422

    def test_registration_with_user_id_link(self, client, db_session):
        """Application can be linked to a pre-existing User account."""
        from app.utils.security import hash_password
        from app.models.user import User
        import uuid
        user = User(
            user_id=str(uuid.uuid4()),
            email="linked@jkr.com",
            hashed_password=hash_password("password123"),
            full_name="Linked User",
            role="owner",
            account_status="pending",
        )
        db_session.add(user)
        db_session.commit()

        resp = client.post(
            "/api/v1/onboarding/register",
            json=_reg_payload(email="linked@jkr.com", user_id=user.user_id),
        )
        assert resp.status_code == 201
        assert resp.json()["user_id"] == user.user_id


# ── POST /api/v1/onboarding/upload-document ───────────────────────────────────

class TestUploadDocument:

    def test_upload_success(self, client, db_session):
        app_data = _register(client)
        resp = client.post(
            "/api/v1/onboarding/upload-document",
            json={
                "application_id": app_data["application_id"],
                "document_type": "id_proof",
                "file_reference": "/uploads/id_proof.pdf",
                "original_filename": "id_proof.pdf",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["document_type"] == "id_proof"
        assert data["application_id"] == app_data["application_id"]

    def test_upload_unknown_application(self, client, db_session):
        resp = client.post(
            "/api/v1/onboarding/upload-document",
            json={
                "application_id": "00000000-0000-0000-0000-000000000000",
                "document_type": "id_proof",
                "file_reference": "/uploads/id.pdf",
            },
        )
        assert resp.status_code == 404

    def test_upload_to_approved_application_rejected(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/approve",
            json={},
            headers=_auth(token),
        )
        resp = client.post(
            "/api/v1/onboarding/upload-document",
            json={
                "application_id": app_data["application_id"],
                "document_type": "id_proof",
                "file_reference": "/uploads/late.pdf",
            },
        )
        assert resp.status_code == 400
        assert "pending" in resp.json()["detail"].lower()

    def test_upload_invalid_document_type(self, client, db_session):
        app_data = _register(client)
        resp = client.post(
            "/api/v1/onboarding/upload-document",
            json={
                "application_id": app_data["application_id"],
                "document_type": "selfie",
                "file_reference": "/uploads/selfie.jpg",
            },
        )
        assert resp.status_code == 422

    def test_multiple_documents_attached(self, client, db_session):
        app_data = _register(client)
        for doc_type in ["id_proof", "address_proof"]:
            resp = client.post(
                "/api/v1/onboarding/upload-document",
                json={
                    "application_id": app_data["application_id"],
                    "document_type": doc_type,
                    "file_reference": f"/uploads/{doc_type}.pdf",
                },
            )
            assert resp.status_code == 201

        detail = client.get(
            f"/api/v1/onboarding/status/{app_data['application_id']}"
        ).json()
        assert len(detail["documents"]) == 2

    def test_upload_binary_file_and_stream(self, client, db_session):
        import io
        app_data = _register(client)
        file_content = b"%PDF-1.4 test binary pdf content"
        file_obj = io.BytesIO(file_content)

        resp = client.post(
            "/api/v1/onboarding/upload-file",
            data={
                "application_id": app_data["application_id"],
                "document_type": "id_proof",
            },
            files={"file": ("my_id_proof.pdf", file_obj, "application/pdf")},
        )
        assert resp.status_code == 201
        doc_data = resp.json()
        doc_id = doc_data["document_id"]
        assert doc_data["original_filename"] == "my_id_proof.pdf"

        # Stream inline file
        stream_resp = client.get(f"/api/v1/onboarding/documents/{doc_id}/file")
        assert stream_resp.status_code == 200
        assert stream_resp.content == file_content
        assert "inline" in stream_resp.headers.get("content-disposition", "")

        # Download attachment file
        down_resp = client.get(f"/api/v1/onboarding/documents/{doc_id}/download")
        assert down_resp.status_code == 200
        assert down_resp.content == file_content
        assert "attachment" in down_resp.headers.get("content-disposition", "")


# ── GET /api/v1/onboarding/status/{id} ───────────────────────────────────────


class TestStatusLookup:

    def test_status_lookup_success(self, client, db_session):
        app_data = _register(client)
        resp = client.get(
            f"/api/v1/onboarding/status/{app_data['application_id']}"
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "pending"

    def test_status_lookup_unknown(self, client, db_session):
        resp = client.get(
            "/api/v1/onboarding/status/00000000-0000-0000-0000-000000000000"
        )
        assert resp.status_code == 404


# ── GET /api/v1/onboarding/pending ───────────────────────────────────────────

class TestPendingList:

    def test_pending_list_secretary(self, client, db_session):
        _register(client)
        _register(client, email="second@jkr.com")
        token = _make_reviewer(client, db_session, role="secretary")
        resp = client.get("/api/v1/onboarding/pending", headers=_auth(token))
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    def test_pending_list_admin(self, client, db_session):
        _register(client)
        token = _make_reviewer(client, db_session, role="admin")
        resp = client.get("/api/v1/onboarding/pending", headers=_auth(token))
        assert resp.status_code == 200

    def test_pending_list_forbidden_for_owner(self, client, db_session):
        from app.utils.security import hash_password
        from app.models.user import User
        import uuid
        user = User(
            user_id=str(uuid.uuid4()),
            email="owner_test@jkr.com",
            hashed_password=hash_password("password123"),
            full_name="Owner",
            role="owner",
            account_status="active",
        )
        db_session.add(user)
        db_session.commit()
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "owner_test@jkr.com", "password": "password123"},
        )
        token = resp.json()["access_token"]
        resp = client.get("/api/v1/onboarding/pending", headers=_auth(token))
        assert resp.status_code == 403

    def test_pending_list_unauthenticated(self, client, db_session):
        resp = client.get("/api/v1/onboarding/pending")
        assert resp.status_code == 401

    def test_approved_not_in_pending_list(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/approve",
            json={},
            headers=_auth(token),
        )
        resp = client.get("/api/v1/onboarding/pending", headers=_auth(token))
        ids = [a["application_id"] for a in resp.json()]
        assert app_data["application_id"] not in ids


# ── GET /api/v1/onboarding/{id} ──────────────────────────────────────────────

class TestGetApplication:

    def test_get_application_detail(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        resp = client.get(
            f"/api/v1/onboarding/{app_data['application_id']}",
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["application_id"] == app_data["application_id"]

    def test_get_application_forbidden_for_owner(self, client, db_session):
        app_data = _register(client)
        from app.utils.security import hash_password
        from app.models.user import User
        import uuid
        user = User(
            user_id=str(uuid.uuid4()),
            email="owner2@jkr.com",
            hashed_password=hash_password("password123"),
            full_name="Owner2",
            role="owner",
            account_status="active",
        )
        db_session.add(user)
        db_session.commit()
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "owner2@jkr.com", "password": "password123"},
        )
        token = resp.json()["access_token"]
        resp = client.get(
            f"/api/v1/onboarding/{app_data['application_id']}",
            headers=_auth(token),
        )
        assert resp.status_code == 403


# ── PUT /api/v1/onboarding/{id}/approve ──────────────────────────────────────

class TestApprove:

    def test_approve_success(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        resp = client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/approve",
            json={},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "approved"
        assert data["resident_id"] is not None
        assert data["reviewed_by"] is not None

    def test_approve_creates_resident(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        resp = client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/approve",
            json={},
            headers=_auth(token),
        )
        resident_id = resp.json()["resident_id"]
        from app.models.resident import Resident
        resident = db_session.query(Resident).filter(
            Resident.resident_id == resident_id
        ).first()
        assert resident is not None
        assert resident.name == "Ravi Kumar"
        assert resident.status == "active"

    def test_approve_activates_linked_user(self, client, db_session):
        from app.utils.security import hash_password
        from app.models.user import User
        import uuid
        user = User(
            user_id=str(uuid.uuid4()),
            email="pending_user@jkr.com",
            hashed_password=hash_password("password123"),
            full_name="Pending User",
            role="owner",
            account_status="pending",
        )
        db_session.add(user)
        db_session.commit()

        app_data = _register(
            client, email="pending_user@jkr.com", user_id=user.user_id
        )
        token = _make_reviewer(client, db_session)
        client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/approve",
            json={},
            headers=_auth(token),
        )

        db_session.refresh(user)
        assert user.account_status == "active"
        assert user.resident_id is not None

    def test_approve_twice_rejected(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/approve",
            json={},
            headers=_auth(token),
        )
        resp = client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/approve",
            json={},
            headers=_auth(token),
        )
        assert resp.status_code == 409

    def test_approve_rejected_application(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/reject",
            json={"rejection_reason": "Incomplete documents."},
            headers=_auth(token),
        )
        resp = client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/approve",
            json={},
            headers=_auth(token),
        )
        assert resp.status_code == 409

    def test_approve_invalid_application(self, client, db_session):
        token = _make_reviewer(client, db_session)
        resp = client.put(
            "/api/v1/onboarding/00000000-0000-0000-0000-000000000000/approve",
            json={},
            headers=_auth(token),
        )
        assert resp.status_code == 404

    def test_approve_forbidden_role(self, client, db_session):
        app_data = _register(client)
        from app.utils.security import hash_password
        from app.models.user import User
        import uuid
        user = User(
            user_id=str(uuid.uuid4()),
            email="tenant_reviewer@jkr.com",
            hashed_password=hash_password("password123"),
            full_name="Tenant",
            role="tenant",
            account_status="active",
        )
        db_session.add(user)
        db_session.commit()
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "tenant_reviewer@jkr.com", "password": "password123"},
        )
        token = resp.json()["access_token"]
        resp = client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/approve",
            json={},
            headers=_auth(token),
        )
        assert resp.status_code == 403

    def test_approve_unauthenticated(self, client, db_session):
        app_data = _register(client)
        resp = client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/approve",
            json={},
        )
        assert resp.status_code == 401

    def test_approve_with_explicit_flat_id(self, client, db_session):
        """Approval with a pre-existing flat_id should use that flat."""
        from app.models.resident import Flat
        import uuid
        flat = Flat(
            flat_id=str(uuid.uuid4()),
            block="B",
            flat_number="101",
            occupancy_status="vacant",
        )
        db_session.add(flat)
        db_session.commit()

        app_data = _register(
            client, block="B", flat_number="101", email="flattest@jkr.com"
        )
        token = _make_reviewer(client, db_session)
        resp = client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/approve",
            json={"flat_id": flat.flat_id},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        assert resp.json()["flat_id"] == flat.flat_id


# ── PUT /api/v1/onboarding/{id}/reject ───────────────────────────────────────

class TestReject:

    def test_reject_success(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        resp = client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/reject",
            json={"rejection_reason": "Documents are incomplete."},
            headers=_auth(token),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "rejected"
        assert data["rejection_reason"] == "Documents are incomplete."
        assert data["reviewed_by"] is not None

    def test_reject_does_not_create_resident(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/reject",
            json={"rejection_reason": "Fake documents."},
            headers=_auth(token),
        )
        from app.models.resident import Resident
        count = db_session.query(Resident).count()
        assert count == 0

    def test_reject_twice_rejected(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/reject",
            json={"rejection_reason": "First rejection."},
            headers=_auth(token),
        )
        resp = client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/reject",
            json={"rejection_reason": "Second rejection."},
            headers=_auth(token),
        )
        assert resp.status_code == 409

    def test_reject_approved_application(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/approve",
            json={},
            headers=_auth(token),
        )
        resp = client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/reject",
            json={"rejection_reason": "Changed mind."},
            headers=_auth(token),
        )
        assert resp.status_code == 409

    def test_reject_missing_reason(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        resp = client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/reject",
            json={},
            headers=_auth(token),
        )
        assert resp.status_code == 422

    def test_reject_invalid_application(self, client, db_session):
        token = _make_reviewer(client, db_session)
        resp = client.put(
            "/api/v1/onboarding/00000000-0000-0000-0000-000000000000/reject",
            json={"rejection_reason": "Not found."},
            headers=_auth(token),
        )
        assert resp.status_code == 404

    def test_reject_forbidden_role(self, client, db_session):
        app_data = _register(client)
        from app.utils.security import hash_password
        from app.models.user import User
        import uuid
        user = User(
            user_id=str(uuid.uuid4()),
            email="maintenance_user@jkr.com",
            hashed_password=hash_password("password123"),
            full_name="Maintenance",
            role="maintenance",
            account_status="active",
        )
        db_session.add(user)
        db_session.commit()
        resp = client.post(
            "/api/v1/auth/login",
            json={"email": "maintenance_user@jkr.com", "password": "password123"},
        )
        token = resp.json()["access_token"]
        resp = client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/reject",
            json={"rejection_reason": "Unauthorized attempt."},
            headers=_auth(token),
        )
        assert resp.status_code == 403


# ── Audit log ─────────────────────────────────────────────────────────────────

class TestAuditLog:

    def test_audit_log_on_submission(self, client, db_session):
        _register(client)
        from app.models.audit import AuditLog
        log = (
            db_session.query(AuditLog)
            .filter(
                AuditLog.module == "onboarding",
                AuditLog.action == "application_submitted",
            )
            .first()
        )
        assert log is not None

    def test_audit_log_on_approval(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/approve",
            json={},
            headers=_auth(token),
        )
        from app.models.audit import AuditLog
        log = (
            db_session.query(AuditLog)
            .filter(
                AuditLog.module == "onboarding",
                AuditLog.action == "application_approved",
            )
            .first()
        )
        assert log is not None
        assert log.target_id == app_data["application_id"]

    def test_audit_log_on_rejection(self, client, db_session):
        app_data = _register(client)
        token = _make_reviewer(client, db_session)
        client.put(
            f"/api/v1/onboarding/{app_data['application_id']}/reject",
            json={"rejection_reason": "Audit test."},
            headers=_auth(token),
        )
        from app.models.audit import AuditLog
        log = (
            db_session.query(AuditLog)
            .filter(
                AuditLog.module == "onboarding",
                AuditLog.action == "application_rejected",
            )
            .first()
        )
        assert log is not None
        assert log.target_id == app_data["application_id"]
