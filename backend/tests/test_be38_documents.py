"""
pytest tests for BE-38 — Document Management API.

Covers:
  - Upload document (success, wrong MIME type, oversized, empty, missing title,
    invalid category, invalid access_role, non-admin rejection)
  - List documents (empty, populated, category filter, role-based visibility)
  - Get document metadata (success, not found, access denied by role)
  - Download document (success, access denied, not found)
  - Delete document (success, not found, non-admin rejection)

Fixtures (client, db_session) are defined in conftest.py.
File I/O is handled through an in-memory tmp directory so tests are portable.
"""

import io
import os
import tempfile
import unittest.mock as mock

import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

def _pdf_file(name: str = "test.pdf", size: int = 1024) -> tuple:
    """Return (filename, file-like, content-type) for a fake PDF."""
    content = b"%PDF-1.4 " + b"x" * size
    return (name, io.BytesIO(content), "application/pdf")


def _txt_file(name: str = "test.txt", content: bytes = b"Hello Society!") -> tuple:
    return (name, io.BytesIO(content), "text/plain")


def _upload(client, role: str = "admin", **overrides) -> object:
    """POST to /documents/upload with sensible defaults."""
    data = {
        "title":       "Test Document",
        "category":    "notices",
        "access_role": "resident",
        "uploaded_by": "test-admin",
    }
    data.update(overrides)
    files = overrides.pop("file", None) or {"file": _pdf_file()}
    return client.post(
        "/api/v1/documents/upload",
        data=data,
        files={"file": _pdf_file()},
        headers={"X-User-Role": role},
    )


def _upload_and_get_id(client, role: str = "admin", **overrides) -> str:
    """Upload a document and return its document_id."""
    resp = _upload(client, role=role, **overrides)
    assert resp.status_code == 201, resp.text
    return resp.json()["document_id"]


# ── POST /api/v1/documents/upload ─────────────────────────────────────────────

class TestUploadDocument:

    def test_upload_success(self, client, tmp_path):
        """Admin can upload a valid PDF."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Society Rules", "category": "rules",
                      "access_role": "resident", "uploaded_by": "admin@jkr.com"},
                files={"file": _pdf_file()},
                headers={"X-User-Role": "admin"},
            )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Society Rules"
        assert data["category"] == "rules"
        assert data["access_role"] == "resident"
        assert data["mime_type"] == "application/pdf"
        assert data["file_size_bytes"] > 0
        assert "document_id" in data

    def test_upload_wrong_mime_type(self, client, tmp_path):
        """Executable files (.exe) must be rejected with 415."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Malware", "category": "other", "access_role": "public"},
                files={"file": ("virus.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")},
                headers={"X-User-Role": "admin"},
            )
        assert resp.status_code == 415

    def test_upload_oversized_file(self, client, tmp_path):
        """Files > 10 MB must be rejected with 413."""
        big_content = b"x" * (10 * 1024 * 1024 + 1)
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Big PDF", "category": "other", "access_role": "public"},
                files={"file": ("big.pdf", io.BytesIO(big_content), "application/pdf")},
                headers={"X-User-Role": "admin"},
            )
        assert resp.status_code == 413

    def test_upload_empty_file(self, client, tmp_path):
        """Empty files must be rejected with 400."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Empty", "category": "other", "access_role": "public"},
                files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")},
                headers={"X-User-Role": "admin"},
            )
        assert resp.status_code == 400

    def test_upload_missing_title(self, client, tmp_path):
        """Request without 'title' field must return 422."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            resp = client.post(
                "/api/v1/documents/upload",
                data={"category": "other", "access_role": "public"},
                files={"file": _pdf_file()},
                headers={"X-User-Role": "admin"},
            )
        assert resp.status_code == 422

    def test_upload_invalid_category(self, client, tmp_path):
        """Unknown category must be rejected with 422."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Doc", "category": "UNKNOWN_CAT", "access_role": "public"},
                files={"file": _pdf_file()},
                headers={"X-User-Role": "admin"},
            )
        assert resp.status_code == 422

    def test_upload_invalid_access_role(self, client, tmp_path):
        """Unknown access_role must be rejected with 422."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Doc", "category": "other", "access_role": "superuser"},
                files={"file": _pdf_file()},
                headers={"X-User-Role": "admin"},
            )
        assert resp.status_code == 422

    def test_upload_non_admin_rejected(self, client, tmp_path):
        """Residents cannot upload documents — must get 403."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Sneaky Upload", "category": "other", "access_role": "public"},
                files={"file": _pdf_file()},
                headers={"X-User-Role": "resident"},
            )
        assert resp.status_code == 403

    def test_upload_no_role_header_rejected(self, client, tmp_path):
        """Requests without role header default to 'public' and must be rejected with 403."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Anon Upload", "category": "other", "access_role": "public"},
                files={"file": _pdf_file()},
            )
        assert resp.status_code == 403

    def test_upload_txt_file_allowed(self, client, tmp_path):
        """Plain text files must be accepted."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Meeting Notes", "category": "minutes", "access_role": "resident"},
                files={"file": _txt_file()},
                headers={"X-User-Role": "admin"},
            )
        assert resp.status_code == 201
        assert resp.json()["mime_type"] == "text/plain"


# ── GET /api/v1/documents ─────────────────────────────────────────────────────

class TestListDocuments:

    def test_list_empty(self, client):
        """Empty database returns an empty list."""
        resp = client.get("/api/v1/documents", headers={"X-User-Role": "admin"})
        assert resp.status_code == 200
        assert resp.json() == []

    def test_list_returns_uploaded_docs(self, client, tmp_path):
        """Uploaded documents appear in the list."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            client.post(
                "/api/v1/documents/upload",
                data={"title": "Doc A", "category": "notices", "access_role": "public"},
                files={"file": _pdf_file()},
                headers={"X-User-Role": "admin"},
            )
            client.post(
                "/api/v1/documents/upload",
                data={"title": "Doc B", "category": "rules", "access_role": "resident"},
                files={"file": _txt_file()},
                headers={"X-User-Role": "admin"},
            )
        resp = client.get("/api/v1/documents", headers={"X-User-Role": "admin"})
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    def test_list_category_filter(self, client, tmp_path):
        """Category filter returns only matching documents."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            client.post(
                "/api/v1/documents/upload",
                data={"title": "Rules Doc", "category": "rules", "access_role": "public"},
                files={"file": _pdf_file()},
                headers={"X-User-Role": "admin"},
            )
            client.post(
                "/api/v1/documents/upload",
                data={"title": "Minutes Doc", "category": "minutes", "access_role": "public"},
                files={"file": _txt_file()},
                headers={"X-User-Role": "admin"},
            )
        resp = client.get("/api/v1/documents?category=rules", headers={"X-User-Role": "admin"})
        assert resp.status_code == 200
        docs = resp.json()
        assert len(docs) == 1
        assert docs[0]["category"] == "rules"

    def test_list_resident_cannot_see_admin_docs(self, client, tmp_path):
        """Residents must not see admin-only documents."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            client.post(
                "/api/v1/documents/upload",
                data={"title": "Admin Only", "category": "financial", "access_role": "admin"},
                files={"file": _pdf_file()},
                headers={"X-User-Role": "admin"},
            )
            client.post(
                "/api/v1/documents/upload",
                data={"title": "Public Doc", "category": "notices", "access_role": "public"},
                files={"file": _txt_file()},
                headers={"X-User-Role": "admin"},
            )
        resp = client.get("/api/v1/documents", headers={"X-User-Role": "resident"})
        assert resp.status_code == 200
        titles = [d["title"] for d in resp.json()]
        assert "Admin Only" not in titles
        assert "Public Doc" in titles

    def test_list_public_role_sees_only_public_docs(self, client, tmp_path):
        """Anonymous / public role must only see access_role=public documents."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            client.post(
                "/api/v1/documents/upload",
                data={"title": "Public Notice", "category": "notices", "access_role": "public"},
                files={"file": _txt_file()},
                headers={"X-User-Role": "admin"},
            )
            client.post(
                "/api/v1/documents/upload",
                data={"title": "Resident Only", "category": "rules", "access_role": "resident"},
                files={"file": _pdf_file()},
                headers={"X-User-Role": "admin"},
            )
        resp = client.get("/api/v1/documents")  # no role header → public
        assert resp.status_code == 200
        titles = [d["title"] for d in resp.json()]
        assert "Public Notice" in titles
        assert "Resident Only" not in titles

    def test_list_pagination(self, client, tmp_path):
        """Pagination skip/limit works correctly."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            for i in range(5):
                client.post(
                    "/api/v1/documents/upload",
                    data={"title": f"Doc {i}", "category": "other", "access_role": "public"},
                    files={"file": _txt_file()},
                    headers={"X-User-Role": "admin"},
                )
        page1 = client.get("/api/v1/documents?skip=0&limit=3",
                           headers={"X-User-Role": "admin"}).json()
        page2 = client.get("/api/v1/documents?skip=3&limit=3",
                           headers={"X-User-Role": "admin"}).json()
        assert len(page1) == 3
        assert len(page2) == 2


# ── GET /api/v1/documents/{id} ────────────────────────────────────────────────

class TestGetDocument:

    def test_get_document_success(self, client, tmp_path):
        """Admin can retrieve document metadata by ID."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            upload_resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Get Test", "category": "legal", "access_role": "resident"},
                files={"file": _pdf_file()},
                headers={"X-User-Role": "admin"},
            )
        doc_id = upload_resp.json()["document_id"]

        resp = client.get(f"/api/v1/documents/{doc_id}", headers={"X-User-Role": "admin"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["document_id"] == doc_id
        assert data["title"] == "Get Test"

    def test_get_document_not_found(self, client):
        """Non-existent document ID returns 404."""
        resp = client.get("/api/v1/documents/does-not-exist",
                          headers={"X-User-Role": "admin"})
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_get_document_access_denied(self, client, tmp_path):
        """Resident cannot access an admin-only document — expects 403."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            upload_resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Admin Secret", "category": "financial",
                      "access_role": "admin"},
                files={"file": _pdf_file()},
                headers={"X-User-Role": "admin"},
            )
        doc_id = upload_resp.json()["document_id"]

        resp = client.get(f"/api/v1/documents/{doc_id}",
                          headers={"X-User-Role": "resident"})
        assert resp.status_code == 403

    def test_get_public_doc_without_role_header(self, client, tmp_path):
        """Public documents are accessible without a role header."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            upload_resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Open Notice", "category": "notices", "access_role": "public"},
                files={"file": _txt_file()},
                headers={"X-User-Role": "admin"},
            )
        doc_id = upload_resp.json()["document_id"]

        resp = client.get(f"/api/v1/documents/{doc_id}")  # no header
        assert resp.status_code == 200


# ── GET /api/v1/documents/{id}/download ───────────────────────────────────────

class TestDownloadDocument:

    def test_download_success(self, client, tmp_path):
        """Admin can download a document and gets the file content."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            upload_resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Download Me", "category": "notices", "access_role": "public"},
                files={"file": _txt_file(content=b"Download content here")},
                headers={"X-User-Role": "admin"},
            )
        doc_id = upload_resp.json()["document_id"]

        resp = client.get(f"/api/v1/documents/{doc_id}/download",
                          headers={"X-User-Role": "admin"})
        assert resp.status_code == 200
        assert b"Download content here" in resp.content

    def test_download_access_denied(self, client, tmp_path):
        """Resident cannot download an admin-only document."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            upload_resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Admin File", "category": "financial", "access_role": "admin"},
                files={"file": _pdf_file()},
                headers={"X-User-Role": "admin"},
            )
        doc_id = upload_resp.json()["document_id"]

        resp = client.get(f"/api/v1/documents/{doc_id}/download",
                          headers={"X-User-Role": "resident"})
        assert resp.status_code == 403

    def test_download_not_found(self, client):
        """Downloading a non-existent document returns 404."""
        resp = client.get("/api/v1/documents/ghost-id-123/download",
                          headers={"X-User-Role": "admin"})
        assert resp.status_code == 404


# ── DELETE /api/v1/documents/{id} ─────────────────────────────────────────────

class TestDeleteDocument:

    def test_delete_success(self, client, tmp_path):
        """Admin can delete a document; subsequent GET returns 404."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            upload_resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Delete Me", "category": "other", "access_role": "public"},
                files={"file": _txt_file()},
                headers={"X-User-Role": "admin"},
            )
        doc_id = upload_resp.json()["document_id"]

        del_resp = client.delete(f"/api/v1/documents/{doc_id}",
                                 headers={"X-User-Role": "admin"})
        assert del_resp.status_code == 200
        assert "deleted" in del_resp.json()["detail"].lower()

        # Verify it's gone
        get_resp = client.get(f"/api/v1/documents/{doc_id}",
                              headers={"X-User-Role": "admin"})
        assert get_resp.status_code == 404

    def test_delete_not_found(self, client):
        """Deleting a non-existent document returns 404."""
        resp = client.delete("/api/v1/documents/does-not-exist",
                             headers={"X-User-Role": "admin"})
        assert resp.status_code == 404

    def test_delete_non_admin_rejected(self, client, tmp_path):
        """Residents cannot delete documents — must get 403."""
        with mock.patch("app.services.document_service._get_upload_dir",
                        return_value=str(tmp_path)):
            upload_resp = client.post(
                "/api/v1/documents/upload",
                data={"title": "Protected Doc", "category": "other", "access_role": "public"},
                files={"file": _txt_file()},
                headers={"X-User-Role": "admin"},
            )
        doc_id = upload_resp.json()["document_id"]

        resp = client.delete(f"/api/v1/documents/{doc_id}",
                             headers={"X-User-Role": "resident"})
        assert resp.status_code == 403

        # Document must still exist after failed delete
        get_resp = client.get(f"/api/v1/documents/{doc_id}",
                              headers={"X-User-Role": "admin"})
        assert get_resp.status_code == 200


# ── INT-38: a signed-in manager is recognised without the interim header ─────

def _token_for(client, db_session, email, role):
    from app.models.user import User
    resp = client.post("/api/v1/auth/register", json={
        "full_name": "Doc User", "email": email,
        "password": "password123", "phone": "9876511111", "role": role,
    })
    user = db_session.query(User).filter(User.user_id == resp.json()["user_id"]).first()
    user.account_status = "active"
    db_session.commit()
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "password123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def _upload(client, headers, tmp_path):
    with mock.patch("app.services.document_service._get_upload_dir", return_value=str(tmp_path)):
        return client.post(
            "/api/v1/documents/upload",
            data={"title": "Bye-Laws", "category": "rules", "access_role": "public"},
            files={"file": ("rules.pdf", io.BytesIO(b"%PDF-1.4 tiny"), "application/pdf")},
            headers=headers,
        )


def test_a_president_may_upload_with_their_token(client, db_session, tmp_path):
    """The people who publish society rules are admitted, not just 'admin'."""
    headers = _token_for(client, db_session, "pres@x.com", "president")

    assert _upload(client, headers, tmp_path).status_code == 201


def test_a_resident_token_cannot_upload(client, db_session, tmp_path):
    headers = _token_for(client, db_session, "owner@x.com", "owner")

    resp = _upload(client, headers, tmp_path)

    assert resp.status_code == 403
    assert "admin" in resp.json()["detail"].lower()


def test_an_unsigned_request_still_cannot_upload(client, tmp_path):
    assert _upload(client, {}, tmp_path).status_code == 403


def test_a_junk_token_does_not_grant_access(client, tmp_path):
    headers = {"Authorization": "Bearer not-a-real-token"}

    assert _upload(client, headers, tmp_path).status_code == 403
