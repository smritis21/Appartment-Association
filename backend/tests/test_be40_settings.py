"""
pytest tests for BE-40 — Settings & Configuration API.

Story: as a user/admin, I want endpoints so that preferences and system
config persist.

Covers:
  - GET /settings/preferences creates and returns a default row on first
    read, without requiring the caller to create one first
  - PUT /settings/preferences updates only the fields supplied
  - Invalid language/theme values are rejected with 422
  - Preferences endpoints require authentication (401 without a token)
  - GET /settings/config lists everything that has been set; GET on an
    unset key returns 404
  - PUT /settings/config/{key} is admin-only: a non-admin gets 403, an
    unauthenticated caller gets 401
  - PUT rejects an unrecognised key, and rejects values that fail that
    key's own validation rule (400 in both cases)
  - A valid config write persists and is readable afterwards, recording
    who set it

Fixtures (client, db_session) are defined in conftest.py.
"""

from app.models.user import User

PREFERENCES_URL = "/api/v1/settings/preferences"
CONFIG_URL = "/api/v1/settings/config"


# ── Auth helpers (matches the pattern in test_be23_directory.py) ─────────────

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


def _owner_headers(client, db_session, email="owner40@jkr.com") -> dict:
    _register_activate(client, db_session, email, role="owner")
    return _login(client, email)


def _admin_headers(client, db_session, email="admin40@jkr.com") -> dict:
    _register_activate(client, db_session, email, role="admin")
    return _login(client, email)


# ── Preferences ───────────────────────────────────────────────────────────────

def test_get_preferences_creates_default_on_first_read(client, db_session):
    headers = _owner_headers(client, db_session)

    response = client.get(PREFERENCES_URL, headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["language"] == "en"
    assert body["theme"] == "light"
    assert body["notification_email"] is True
    assert body["notification_sms"] is False


def test_update_preferences_changes_only_supplied_fields(client, db_session):
    headers = _owner_headers(client, db_session)
    client.get(PREFERENCES_URL, headers=headers)

    response = client.put(PREFERENCES_URL, headers=headers, json={"theme": "dark"})

    assert response.status_code == 200
    body = response.json()
    assert body["theme"] == "dark"
    assert body["language"] == "en"


def test_update_preferences_without_reading_first_still_works(client, db_session):
    headers = _owner_headers(client, db_session)

    response = client.put(PREFERENCES_URL, headers=headers, json={"language": "hi"})

    assert response.status_code == 200
    assert response.json()["language"] == "hi"


def test_update_preferences_persists(client, db_session):
    headers = _owner_headers(client, db_session)
    client.put(PREFERENCES_URL, headers=headers, json={"notification_sms": True})

    response = client.get(PREFERENCES_URL, headers=headers)
    assert response.json()["notification_sms"] is True


def test_invalid_language_returns_422(client, db_session):
    headers = _owner_headers(client, db_session)
    response = client.put(PREFERENCES_URL, headers=headers, json={"language": "fr"})
    assert response.status_code == 422


def test_invalid_theme_returns_422(client, db_session):
    headers = _owner_headers(client, db_session)
    response = client.put(PREFERENCES_URL, headers=headers, json={"theme": "solarized"})
    assert response.status_code == 422


def test_preferences_require_authentication(client):
    response = client.get(PREFERENCES_URL)
    assert response.status_code == 401


def test_two_users_have_independent_preferences(client, db_session):
    headers_a = _owner_headers(client, db_session, email="a40@jkr.com")
    headers_b = _owner_headers(client, db_session, email="b40@jkr.com")
    client.put(PREFERENCES_URL, headers=headers_a, json={"theme": "dark"})

    response_b = client.get(PREFERENCES_URL, headers=headers_b)
    assert response_b.json()["theme"] == "light"


# ── Apartment config ──────────────────────────────────────────────────────────

def test_config_read_requires_authentication(client):
    response = client.get(CONFIG_URL)
    assert response.status_code == 401


def test_get_unset_config_key_returns_404(client, db_session):
    headers = _owner_headers(client, db_session)
    response = client.get(f"{CONFIG_URL}/gst_rate", headers=headers)
    assert response.status_code == 404


def test_non_admin_cannot_set_config(client, db_session):
    headers = _owner_headers(client, db_session)
    response = client.put(f"{CONFIG_URL}/gst_rate", headers=headers, json={"value": "18"})
    assert response.status_code == 403


def test_unauthenticated_cannot_set_config(client):
    response = client.put(f"{CONFIG_URL}/gst_rate", json={"value": "18"})
    assert response.status_code == 401


def test_admin_can_set_valid_config(client, db_session):
    headers = _admin_headers(client, db_session)

    response = client.put(f"{CONFIG_URL}/gst_rate", headers=headers, json={"value": "18"})

    assert response.status_code == 200
    body = response.json()
    assert body["key"] == "gst_rate"
    assert body["value"] == "18"
    assert body["updated_by"]


def test_config_write_persists_and_is_readable(client, db_session):
    headers = _admin_headers(client, db_session)
    client.put(f"{CONFIG_URL}/society_name", headers=headers, json={"value": "Jains Kences Retreat"})

    response = client.get(f"{CONFIG_URL}/society_name", headers=headers)
    assert response.status_code == 200
    assert response.json()["value"] == "Jains Kences Retreat"


def test_set_unrecognised_config_key_returns_400(client, db_session):
    headers = _admin_headers(client, db_session)
    response = client.put(f"{CONFIG_URL}/wifi_password", headers=headers, json={"value": "anything"})
    assert response.status_code == 400


def test_gst_rate_out_of_range_returns_400(client, db_session):
    headers = _admin_headers(client, db_session)
    response = client.put(f"{CONFIG_URL}/gst_rate", headers=headers, json={"value": "150"})
    assert response.status_code == 400


def test_gst_rate_non_numeric_returns_400(client, db_session):
    headers = _admin_headers(client, db_session)
    response = client.put(f"{CONFIG_URL}/gst_rate", headers=headers, json={"value": "eighteen"})
    assert response.status_code == 400


def test_visitor_pass_hours_out_of_range_returns_400(client, db_session):
    headers = _admin_headers(client, db_session)
    response = client.put(
        f"{CONFIG_URL}/visitor_pass_default_hours", headers=headers, json={"value": "200"}
    )
    assert response.status_code == 400


def test_maintenance_due_day_out_of_range_returns_400(client, db_session):
    headers = _admin_headers(client, db_session)
    response = client.put(f"{CONFIG_URL}/maintenance_due_day", headers=headers, json={"value": "31"})
    assert response.status_code == 400


def test_emergency_contact_number_invalid_returns_400(client, db_session):
    headers = _admin_headers(client, db_session)
    response = client.put(
        f"{CONFIG_URL}/emergency_contact_number", headers=headers, json={"value": "not-a-number"}
    )
    assert response.status_code == 400


def test_society_name_blank_returns_400(client, db_session):
    headers = _admin_headers(client, db_session)
    response = client.put(f"{CONFIG_URL}/society_name", headers=headers, json={"value": "   "})
    assert response.status_code == 400


def test_list_config_returns_everything_set(client, db_session):
    headers = _admin_headers(client, db_session)
    client.put(f"{CONFIG_URL}/gst_rate", headers=headers, json={"value": "18"})
    client.put(f"{CONFIG_URL}/maintenance_due_day", headers=headers, json={"value": "5"})

    response = client.get(CONFIG_URL, headers=headers)
    assert response.status_code == 200
    keys = {row["key"] for row in response.json()}
    assert keys == {"gst_rate", "maintenance_due_day"}


def test_updating_existing_config_key_overwrites(client, db_session):
    headers = _admin_headers(client, db_session)
    client.put(f"{CONFIG_URL}/gst_rate", headers=headers, json={"value": "18"})
    client.put(f"{CONFIG_URL}/gst_rate", headers=headers, json={"value": "12"})

    response = client.get(f"{CONFIG_URL}/gst_rate", headers=headers)
    assert response.json()["value"] == "12"
