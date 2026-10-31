from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

def test_create_announcement_success(client: TestClient):
    payload = {
        "title": "Annual General Meeting",
        "body": "The AGM will be held on Friday at 6 PM.",
        "author": "President",
        "visibility": "public"
    }
    response = client.post("/api/v1/announcements/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Annual General Meeting"
    assert data["body"] == "The AGM will be held on Friday at 6 PM."
    assert "id" in data

def test_create_announcement_missing_fields(client: TestClient):
    payload = {
        "title": "Missing body"
    }
    response = client.post("/api/v1/announcements/", json=payload)
    assert response.status_code == 422  # Unprocessable Entity (validation error)
    
def test_update_announcement_success(client: TestClient):
    # Create first
    create_payload = {
        "title": "Pool Maintenance",
        "body": "The pool is closed.",
        "author": "Maintenance Team",
        "visibility": "public"
    }
    create_response = client.post("/api/v1/announcements/", json=create_payload)
    assert create_response.status_code == 201
    announcement_id = create_response.json()["id"]

    # Update
    update_payload = {
        "title": "Pool Maintenance - Extended",
        "body": "The pool is closed for another day."
    }
    update_response = client.put(f"/api/v1/announcements/{announcement_id}", json=update_payload)
    assert update_response.status_code == 200
    updated_data = update_response.json()
    assert updated_data["title"] == "Pool Maintenance - Extended"
    assert updated_data["body"] == "The pool is closed for another day."
    # Unchanged fields
    assert updated_data["author"] == "Maintenance Team"

def test_update_announcement_not_found(client: TestClient):
    update_payload = {
        "title": "Ghost Update"
    }
    response = client.put("/api/v1/announcements/99999", json=update_payload)
    assert response.status_code == 404

def test_read_announcements(client: TestClient):
    # Create an announcement first
    payload = {
        "title": "Water Supply Interruption",
        "body": "Water will be cut off from 2PM to 4PM.",
        "author": "Maintenance",
        "visibility": "public"
    }
    client.post("/api/v1/announcements/", json=payload)
    
    # Test GET without filters
    response = client.get("/api/v1/announcements/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    
    # Test GET with filter_type=current
    response_current = client.get("/api/v1/announcements/?filter_type=current")
    assert response_current.status_code == 200
    assert len(response_current.json()) >= 1
    
    # Test pagination
    response_page = client.get("/api/v1/announcements/?skip=0&limit=1")
    assert response_page.status_code == 200
    assert len(response_page.json()) == 1


# ── Pinned notices ────────────────────────────────────────────────────────────
# The dashboard has rendered a "Pinned" section since FE-04, but the column did
# not exist server-side, so every live announcement came back unpinned and that
# section was permanently empty.

def test_create_announcement_defaults_to_unpinned(client: TestClient):
    response = client.post("/api/v1/announcements/", json={
        "title": "Routine notice",
        "body": "Nothing urgent about this one.",
    })
    assert response.status_code == 201
    assert response.json()["pinned"] is False


def test_create_pinned_announcement_persists_the_flag(client: TestClient):
    response = client.post("/api/v1/announcements/", json={
        "title": "Lift out of service",
        "body": "Block B lift is under repair until Friday.",
        "pinned": True,
    })
    assert response.status_code == 201
    assert response.json()["pinned"] is True


def test_pinned_announcements_sort_before_unpinned(client: TestClient):
    client.post("/api/v1/announcements/", json={"title": "Older notice", "body": "Body."})
    client.post("/api/v1/announcements/", json={"title": "Pinned notice", "body": "Body.", "pinned": True})
    client.post("/api/v1/announcements/", json={"title": "Newest notice", "body": "Body."})

    rows = client.get("/api/v1/announcements/?filter_type=all").json()

    # Pinned first regardless of age; the rest stay newest-first.
    assert rows[0]["title"] == "Pinned notice"
    assert [r["title"] for r in rows[1:3]] == ["Newest notice", "Older notice"]


def test_an_announcement_can_be_pinned_and_unpinned(client: TestClient):
    created = client.post("/api/v1/announcements/", json={
        "title": "Toggle me", "body": "Body.",
    }).json()

    pinned = client.put(f"/api/v1/announcements/{created['id']}", json={"pinned": True})
    assert pinned.status_code == 200
    assert pinned.json()["pinned"] is True

    unpinned = client.put(f"/api/v1/announcements/{created['id']}", json={"pinned": False})
    assert unpinned.json()["pinned"] is False


def test_updating_another_field_leaves_pinned_untouched(client: TestClient):
    """exclude_unset means an omitted field must not be reset to its default."""
    created = client.post("/api/v1/announcements/", json={
        "title": "Stay pinned", "body": "Body.", "pinned": True,
    }).json()

    updated = client.put(f"/api/v1/announcements/{created['id']}", json={"title": "Renamed"})

    assert updated.json()["title"] == "Renamed"
    assert updated.json()["pinned"] is True


# ── Drafts and scheduling (FE-08 Save-draft and schedule date/time) ──────────

def _make(client, **overrides):
    payload = {"title": "Notice", "body": "Body text", "category": "General"}
    payload.update(overrides)
    return client.post("/api/v1/announcements/", json=payload)


def test_an_announcement_is_published_by_default(client):
    resp = _make(client)

    assert resp.status_code == 201
    assert resp.json()["status"] == "published"
    assert resp.json()["scheduled_for"] is None


def test_a_draft_is_kept_out_of_the_resident_list(client):
    _make(client, title="Draft notice", status="draft")

    titles = [a["title"] for a in client.get("/api/v1/announcements/").json()]

    assert "Draft notice" not in titles


def test_a_draft_cannot_be_found_by_searching_for_it(client):
    _make(client, title="Secret draft", status="draft")

    results = client.get("/api/v1/announcements/search", params={"keyword": "Secret"}).json()

    assert results == []


def test_a_notice_scheduled_for_later_is_not_shown_yet(client):
    later = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=3)).isoformat()
    _make(client, title="Future notice", scheduled_for=later)

    titles = [a["title"] for a in client.get("/api/v1/announcements/").json()]

    assert "Future notice" not in titles


def test_a_notice_scheduled_in_the_past_is_already_visible(client):
    earlier = (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)).isoformat()
    _make(client, title="Past notice", scheduled_for=earlier)

    titles = [a["title"] for a in client.get("/api/v1/announcements/").json()]

    assert "Past notice" in titles


def test_publishing_a_draft_makes_it_visible(client):
    draft_id = _make(client, title="Later published", status="draft").json()["id"]

    client.put(f"/api/v1/announcements/{draft_id}", json={"status": "published"})

    titles = [a["title"] for a in client.get("/api/v1/announcements/").json()]
    assert "Later published" in titles


def test_drafts_can_be_listed_so_they_are_not_lost(client):
    _make(client, title="Retrievable draft", status="draft")
    _make(client, title="Live notice")

    drafts = client.get("/api/v1/announcements/", params={"status": "draft"}).json()

    titles = [a["title"] for a in drafts]
    assert titles == ["Retrievable draft"]


def test_the_default_list_still_excludes_drafts(client):
    _make(client, title="Hidden draft", status="draft")
    _make(client, title="Live notice")

    titles = [a["title"] for a in client.get("/api/v1/announcements/").json()]

    assert titles == ["Live notice"]


def test_a_blank_title_is_rejected(client):
    resp = _make(client, title="   ")

    assert resp.status_code == 422


def test_a_blank_body_is_rejected(client):
    resp = _make(client, body="")

    assert resp.status_code == 422


def test_surrounding_whitespace_is_trimmed(client):
    resp = _make(client, title="  Spaced Notice  ")

    assert resp.json()["title"] == "Spaced Notice"


def test_an_unknown_status_is_rejected(client):
    """A typo must not create a notice that is invisible to everyone."""
    resp = _make(client, status="publised")

    assert resp.status_code == 422
