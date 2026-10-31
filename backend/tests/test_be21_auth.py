"""
pytest tests for BE-21 — Authentication & Account API.

Covers:
  POST /api/v1/auth/register
    - successful registration
    - duplicate email (409)
    - missing required fields (422)
    - password too short (422)
    - invalid email format (422)

  POST /api/v1/auth/login
    - successful login — token returned
    - wrong password (401)
    - email not found (401)
    - pending account (403)
    - suspended account (403)

  POST /api/v1/auth/forgot-password
    - known email — token stored
    - unknown email — same 200 response (no enumeration)

  POST /api/v1/auth/reset-password
    - successful reset
    - invalid token (400)
    - expired token (400)
    - token reuse after reset (400)

  POST /api/v1/auth/change-password
    - successful change
    - wrong current password (401)
    - no token (401)
    - invalid JWT (401)

  GET /api/v1/auth/profile
    - success
    - no token (401)
    - invalid token (401)

  PUT /api/v1/auth/profile
    - successful update
    - no token (401)

  RBAC
    - expired JWT (401)
    - wrong role (403)

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import datetime, timedelta, timezone

import pytest


# ── Helpers ───────────────────────────────────────────────────────────────────

def register_payload(**overrides) -> dict:
    payload = {
        "email": "test@jkr.com",
        "password": "password123",
        "full_name": "Test User",
        "role": "owner",
    }
    payload.update(overrides)
    return payload


def register_and_activate(client, db_session, **overrides) -> dict:
    """Register a user and manually set account_status to active."""
    resp = client.post("/api/v1/auth/register", json=register_payload(**overrides))
    assert resp.status_code == 201
    user_id = resp.json()["user_id"]

    from app.models.user import User
    user = db_session.query(User).filter(User.user_id == user_id).first()
    user.account_status = "active"
    db_session.commit()

    return resp.json()


def login(client, email="test@jkr.com", password="password123") -> str:
    """Return the access token string."""
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── POST /api/v1/auth/register ────────────────────────────────────────────────

class TestRegister:

    def test_register_success(self, client, db_session):
        resp = client.post("/api/v1/auth/register", json=register_payload())
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "test@jkr.com"
        assert data["full_name"] == "Test User"
        assert data["role"] == "owner"
        assert data["account_status"] == "pending"
        assert "user_id" in data
        # Password must never appear in any response
        assert "password" not in data
        assert "hashed_password" not in data

    def test_register_duplicate_email(self, client, db_session):
        client.post("/api/v1/auth/register", json=register_payload())
        resp = client.post("/api/v1/auth/register", json=register_payload())
        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"].lower()

    def test_register_email_case_insensitive(self, client, db_session):
        client.post("/api/v1/auth/register", json=register_payload(email="Test@JKR.com"))
        resp = client.post("/api/v1/auth/register", json=register_payload(email="test@jkr.com"))
        assert resp.status_code == 409

    def test_register_missing_email(self, client, db_session):
        payload = register_payload()
        del payload["email"]
        resp = client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 422

    def test_register_invalid_email(self, client, db_session):
        resp = client.post("/api/v1/auth/register", json=register_payload(email="not-an-email"))
        assert resp.status_code == 422

    def test_register_password_too_short(self, client, db_session):
        resp = client.post("/api/v1/auth/register", json=register_payload(password="short"))
        assert resp.status_code == 422

    def test_register_missing_full_name(self, client, db_session):
        payload = register_payload()
        del payload["full_name"]
        resp = client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 422

    def test_register_all_roles_accepted(self, client, db_session):
        roles = ["owner", "tenant", "president", "secretary", "admin", "maintenance", "security"]
        for i, role in enumerate(roles):
            resp = client.post(
                "/api/v1/auth/register",
                json=register_payload(email=f"user{i}@jkr.com", role=role),
            )
            assert resp.status_code == 201
            assert resp.json()["role"] == role

    def test_register_invalid_role(self, client, db_session):
        resp = client.post("/api/v1/auth/register", json=register_payload(role="superuser"))
        assert resp.status_code == 422


# ── POST /api/v1/auth/login ───────────────────────────────────────────────────

class TestLogin:

    def test_login_success(self, client, db_session):
        register_and_activate(client, db_session)
        resp = client.post("/api/v1/auth/login", json={"email": "test@jkr.com", "password": "password123"})
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["role"] == "owner"
        assert data["account_status"] == "active"
        assert "password" not in data

    def test_login_wrong_password(self, client, db_session):
        register_and_activate(client, db_session)
        resp = client.post("/api/v1/auth/login", json={"email": "test@jkr.com", "password": "wrongpass"})
        assert resp.status_code == 401
        assert "incorrect" in resp.json()["detail"].lower()

    def test_login_unknown_email(self, client, db_session):
        resp = client.post("/api/v1/auth/login", json={"email": "nobody@jkr.com", "password": "password123"})
        assert resp.status_code == 401

    def test_login_pending_account(self, client, db_session):
        # Register but do NOT activate
        client.post("/api/v1/auth/register", json=register_payload())
        resp = client.post("/api/v1/auth/login", json={"email": "test@jkr.com", "password": "password123"})
        assert resp.status_code == 403
        assert "pending" in resp.json()["detail"].lower()

    def test_login_suspended_account(self, client, db_session):
        register_and_activate(client, db_session)
        from app.models.user import User
        user = db_session.query(User).filter(User.email == "test@jkr.com").first()
        user.account_status = "suspended"
        db_session.commit()

        resp = client.post("/api/v1/auth/login", json={"email": "test@jkr.com", "password": "password123"})
        assert resp.status_code == 403
        assert "suspended" in resp.json()["detail"].lower()

    def test_login_token_contains_role(self, client, db_session):
        register_and_activate(client, db_session)
        token = login(client)
        from app.utils.security import decode_access_token
        payload = decode_access_token(token)
        assert payload["role"] == "owner"
        assert "sub" in payload
        assert "exp" in payload

    def test_login_token_has_expiry(self, client, db_session):
        register_and_activate(client, db_session)
        token = login(client)
        from app.utils.security import decode_access_token
        payload = decode_access_token(token)
        assert "exp" in payload
        # exp must be in the future
        exp_dt = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        assert exp_dt > datetime.now(timezone.utc)


# ── POST /api/v1/auth/forgot-password ────────────────────────────────────────

class TestForgotPassword:

    def test_forgot_password_known_email(self, client, db_session):
        register_and_activate(client, db_session)
        resp = client.post("/api/v1/auth/forgot-password", json={"email": "test@jkr.com"})
        assert resp.status_code == 200
        assert "token" in resp.json()["detail"].lower() or "issued" in resp.json()["detail"].lower()

        # Token must be stored on the user row
        from app.models.user import User
        user = db_session.query(User).filter(User.email == "test@jkr.com").first()
        assert user.reset_token is not None
        assert user.reset_token_expires_at is not None

    def test_forgot_password_unknown_email_same_response(self, client, db_session):
        """Must return 200 even for unknown emails — no user enumeration."""
        resp = client.post("/api/v1/auth/forgot-password", json={"email": "nobody@jkr.com"})
        assert resp.status_code == 200

    def test_forgot_password_invalid_email_format(self, client, db_session):
        resp = client.post("/api/v1/auth/forgot-password", json={"email": "not-an-email"})
        assert resp.status_code == 422


# ── POST /api/v1/auth/reset-password ─────────────────────────────────────────

class TestResetPassword:

    def _get_reset_token(self, client, db_session) -> str:
        register_and_activate(client, db_session)
        client.post("/api/v1/auth/forgot-password", json={"email": "test@jkr.com"})
        from app.models.user import User
        user = db_session.query(User).filter(User.email == "test@jkr.com").first()
        return user.reset_token

    def test_reset_password_success(self, client, db_session):
        token = self._get_reset_token(client, db_session)
        resp = client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": "brandnewpass99"},
        )
        assert resp.status_code == 200
        assert "reset" in resp.json()["detail"].lower()

        # Can now log in with the new password
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": "test@jkr.com", "password": "brandnewpass99"},
        )
        assert login_resp.status_code == 200

    def test_reset_password_invalid_token(self, client, db_session):
        resp = client.post(
            "/api/v1/auth/reset-password",
            json={"token": "00000000-0000-0000-0000-000000000000", "new_password": "newpass123"},
        )
        assert resp.status_code == 400

    def test_reset_password_expired_token(self, client, db_session):
        register_and_activate(client, db_session)
        # Manually plant an already-expired token
        from app.models.user import User
        import uuid
        user = db_session.query(User).filter(User.email == "test@jkr.com").first()
        expired_token = str(uuid.uuid4())
        user.reset_token = expired_token
        user.reset_token_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=2)
        db_session.commit()

        resp = client.post(
            "/api/v1/auth/reset-password",
            json={"token": expired_token, "new_password": "newpass123"},
        )
        assert resp.status_code == 400
        assert "expired" in resp.json()["detail"].lower()

    def test_reset_password_token_cleared_after_use(self, client, db_session):
        token = self._get_reset_token(client, db_session)
        client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": "firstnewpass1"},
        )
        # Second use of the same token must fail
        resp = client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": "secondnewpass2"},
        )
        assert resp.status_code == 400

    def test_reset_password_too_short(self, client, db_session):
        token = self._get_reset_token(client, db_session)
        resp = client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "new_password": "short"},
        )
        assert resp.status_code == 422


# ── POST /api/v1/auth/change-password ────────────────────────────────────────

class TestChangePassword:

    def test_change_password_success(self, client, db_session):
        register_and_activate(client, db_session)
        token = login(client)
        resp = client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "password123", "new_password": "changed456!"},
            headers=auth_headers(token),
        )
        assert resp.status_code == 200
        assert "changed" in resp.json()["detail"].lower()

        # Old password no longer works
        old_login = client.post(
            "/api/v1/auth/login",
            json={"email": "test@jkr.com", "password": "password123"},
        )
        assert old_login.status_code == 401

        # New password works
        new_login = client.post(
            "/api/v1/auth/login",
            json={"email": "test@jkr.com", "password": "changed456!"},
        )
        assert new_login.status_code == 200

    def test_change_password_wrong_current(self, client, db_session):
        register_and_activate(client, db_session)
        token = login(client)
        resp = client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "wrongpassword", "new_password": "newpass456"},
            headers=auth_headers(token),
        )
        assert resp.status_code == 401
        assert "incorrect" in resp.json()["detail"].lower()

    def test_change_password_no_token(self, client, db_session):
        resp = client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "password123", "new_password": "newpass456"},
        )
        assert resp.status_code == 401

    def test_change_password_invalid_jwt(self, client, db_session):
        resp = client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "password123", "new_password": "newpass456"},
            headers={"Authorization": "Bearer this.is.not.a.valid.jwt"},
        )
        assert resp.status_code == 401

    def test_change_password_new_too_short(self, client, db_session):
        register_and_activate(client, db_session)
        token = login(client)
        resp = client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "password123", "new_password": "short"},
            headers=auth_headers(token),
        )
        assert resp.status_code == 422


# ── GET /api/v1/auth/profile ──────────────────────────────────────────────────

class TestGetProfile:

    def test_get_profile_success(self, client, db_session):
        register_and_activate(client, db_session)
        token = login(client)
        resp = client.get("/api/v1/auth/profile", headers=auth_headers(token))
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "test@jkr.com"
        assert data["full_name"] == "Test User"
        assert data["role"] == "owner"
        assert data["account_status"] == "active"
        assert "hashed_password" not in data
        assert "reset_token" not in data

    def test_get_profile_no_token(self, client, db_session):
        resp = client.get("/api/v1/auth/profile")
        assert resp.status_code == 401

    def test_get_profile_invalid_token(self, client, db_session):
        resp = client.get(
            "/api/v1/auth/profile",
            headers={"Authorization": "Bearer garbage.token.here"},
        )
        assert resp.status_code == 401


# ── PUT /api/v1/auth/profile ──────────────────────────────────────────────────

class TestUpdateProfile:

    def test_update_profile_success(self, client, db_session):
        register_and_activate(client, db_session)
        token = login(client)
        resp = client.put(
            "/api/v1/auth/profile",
            json={"full_name": "Ravi Kumar Updated"},
            headers=auth_headers(token),
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Ravi Kumar Updated"
        # Other fields unchanged
        assert resp.json()["email"] == "test@jkr.com"
        assert resp.json()["role"] == "owner"

    def test_update_profile_empty_body_is_noop(self, client, db_session):
        """Sending an empty body should not error — nothing changes."""
        register_and_activate(client, db_session)
        token = login(client)
        resp = client.put(
            "/api/v1/auth/profile",
            json={},
            headers=auth_headers(token),
        )
        assert resp.status_code == 200
        assert resp.json()["full_name"] == "Test User"

    def test_update_profile_no_token(self, client, db_session):
        resp = client.put("/api/v1/auth/profile", json={"full_name": "Ghost"})
        assert resp.status_code == 401

    def test_update_profile_blank_full_name_rejected(self, client, db_session):
        register_and_activate(client, db_session)
        token = login(client)
        resp = client.put(
            "/api/v1/auth/profile",
            json={"full_name": ""},
            headers=auth_headers(token),
        )
        assert resp.status_code == 422


# ── RBAC / JWT edge cases ─────────────────────────────────────────────────────

class TestRBACAndJWT:

    def test_expired_jwt_returns_401(self, client, db_session):
        """Manually craft a token that is already expired."""
        from app.utils.security import create_access_token
        expired_token = create_access_token(
            {"sub": "fake-user-id", "role": "owner"},
            expires_delta=timedelta(seconds=-1),
        )
        resp = client.get(
            "/api/v1/auth/profile",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert resp.status_code == 401

    def test_wrong_role_returns_403(self, client, db_session):
        """
        require_roles() should return 403 when the authenticated user's role
        is not in the allowed set. We test this by calling an admin-only
        endpoint (GET /audit) with a non-admin JWT.
        """
        register_and_activate(client, db_session, role="owner")
        token = login(client)
        # GET /audit requires X-User-Role: admin (require_admin stub).
        # Use the new JWT path: supply a valid Bearer token but no admin header.
        # The audit endpoint still uses the old require_admin stub, so we
        # test require_roles() directly by crafting a token with role=owner
        # and calling a hypothetical admin endpoint. Since no require_roles()
        # endpoint exists yet outside auth, we verify the helper directly.
        from app.utils.security import create_access_token, decode_access_token
        owner_token = create_access_token({"sub": "some-id", "role": "owner"})
        payload = decode_access_token(owner_token)
        assert payload["role"] == "owner"
        # Confirm require_roles raises 403 for wrong role
        from fastapi import HTTPException
        from app.dependencies import require_roles
        import pytest as _pytest
        checker = require_roles("admin", "president")

        class _FakeUser:
            role = "owner"

        with _pytest.raises(HTTPException) as exc_info:
            checker(_FakeUser())
        assert exc_info.value.status_code == 403

    def test_malformed_bearer_token(self, client, db_session):
        resp = client.get(
            "/api/v1/auth/profile",
            headers={"Authorization": "Bearer not.three.parts.here.extra"},
        )
        assert resp.status_code == 401

    def test_missing_bearer_prefix(self, client, db_session):
        register_and_activate(client, db_session)
        token = login(client)
        # Send token without "Bearer " prefix
        resp = client.get(
            "/api/v1/auth/profile",
            headers={"Authorization": token},
        )
        assert resp.status_code == 401
