"""
pytest tests for BE-29 — Forum & Lost-and-Found API.

Covers:
  Forum Posts:
    - Create post (success 201, missing title 422, invalid category 422,
      too many image_refs 400/422)
    - List posts (all, filter by category, pagination, newest-first ordering)
    - Get single post (200 success, 404 unknown)

  Forum Comments:
    - Create comment (success 201, 404 unknown post, missing body 422)
    - List comments (all for post, pagination, oldest-first ordering,
      404 unknown post)
    - comment_count reflects new comments on post detail

  Lost & Found:
    - Create item (success 201, invalid item_type 422, missing title 422)
    - List items (all, filter by item_type, filter by status, pagination,
      newest-first ordering)
    - Get single item (200, 404 unknown)
    - Update status (open→resolved success, already resolved idempotent,
      invalid status 422, 404 unknown)

Fixtures (client, db_session) are defined in conftest.py.
"""

import pytest

BASE = "/api/v1/forum"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _create_post(client, **overrides) -> dict:
    """POST to /forum/posts and assert 201. Returns the JSON body."""
    payload = {
        "title": "Test Post",
        "body": "This is the body of the test post.",
        "category": "general",
        "image_refs": [],
    }
    payload.update(overrides)
    resp = client.post(f"{BASE}/posts", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


def _create_item(client, **overrides) -> dict:
    """POST to /forum/lost-found and assert 201. Returns the JSON body."""
    payload = {
        "item_type": "lost",
        "title": "Test Lost Item",
        "description": "A test description.",
    }
    payload.update(overrides)
    resp = client.post(f"{BASE}/lost-found", json=payload)
    assert resp.status_code == 201, resp.text
    return resp.json()


# ══════════════════════════════════════════════════════════════════════════════
# Forum Posts
# ══════════════════════════════════════════════════════════════════════════════

class TestCreateForumPost:

    def test_create_returns_201(self, client):
        """Basic post creation returns 201 and expected fields."""
        payload = {
            "title": "Water Outage Notice",
            "body": "Water will be off from 9 AM to 1 PM.",
            "category": "general",
            "image_refs": [],
            "author_id": "resident-001",
        }
        resp = client.post(f"{BASE}/posts", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Water Outage Notice"
        assert data["category"] == "general"
        assert data["comment_count"] == 0
        assert "post_id" in data
        assert "created_at" in data
        assert "updated_at" in data

    def test_create_with_image_refs(self, client):
        """Image references are persisted."""
        refs = [
            "https://cdn.example.com/img1.jpg",
            "https://cdn.example.com/img2.jpg",
        ]
        data = _create_post(client, image_refs=refs)
        assert data["image_refs"] == refs

    def test_create_all_categories(self, client):
        """All valid categories are accepted."""
        for cat in ("general", "events", "classifieds", "safety", "lost_found"):
            data = _create_post(client, category=cat, title=f"Post in {cat}")
            assert data["category"] == cat

    def test_create_missing_title_returns_422(self, client):
        resp = client.post(f"{BASE}/posts", json={"body": "No title here."})
        assert resp.status_code == 422

    def test_create_missing_body_returns_422(self, client):
        resp = client.post(f"{BASE}/posts", json={"title": "No body."})
        assert resp.status_code == 422

    def test_create_invalid_category_returns_422(self, client):
        resp = client.post(
            f"{BASE}/posts",
            json={"title": "Bad cat", "body": "Body.", "category": "nonsense"},
        )
        assert resp.status_code == 422

    def test_create_too_many_image_refs_rejected(self, client):
        """More than 3 image_refs must be rejected (400 or 422)."""
        refs = [f"https://img.example.com/{i}.jpg" for i in range(4)]
        resp = client.post(
            f"{BASE}/posts",
            json={"title": "Too many images", "body": "Body.", "image_refs": refs},
        )
        assert resp.status_code in (400, 422)

    def test_create_without_author_id(self, client):
        """author_id is optional; post is created without it."""
        data = _create_post(client)
        # author_id may be None
        assert "author_id" in data


class TestListForumPosts:

    def test_list_returns_all(self, client):
        _create_post(client, title="Post A")
        _create_post(client, title="Post B")
        resp = client.get(f"{BASE}/posts")
        assert resp.status_code == 200
        data = resp.json()
        titles = {p["title"] for p in data["posts"]}
        assert {"Post A", "Post B"}.issubset(titles)

    def test_list_has_pagination_envelope(self, client):
        resp = client.get(f"{BASE}/posts")
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert "posts" in data

    def test_list_filter_by_category(self, client):
        _create_post(client, title="Gen Post", category="general")
        _create_post(client, title="Event Post", category="events")
        resp = client.get(f"{BASE}/posts?category=events")
        assert resp.status_code == 200
        posts = resp.json()["posts"]
        titles = [p["title"] for p in posts]
        assert "Event Post" in titles
        assert "Gen Post" not in titles

    def test_list_pagination_skip_limit(self, client):
        for i in range(5):
            _create_post(client, title=f"Pagination Post {i}")
        page1 = client.get(f"{BASE}/posts?skip=0&limit=3").json()
        page2 = client.get(f"{BASE}/posts?skip=3&limit=3").json()
        assert len(page1["posts"]) == 3
        assert page1["total"] >= 5

    def test_list_newest_first(self, client):
        _create_post(client, title="First")
        _create_post(client, title="Second")
        _create_post(client, title="Third")
        data = client.get(f"{BASE}/posts").json()
        titles = [p["title"] for p in data["posts"]]
        # "Third" should appear before "First"
        assert titles.index("Third") < titles.index("First")

    def test_list_empty_returns_empty(self, client, db_session):
        resp = client.get(f"{BASE}/posts?category=classifieds")
        # Should succeed even when no posts match
        assert resp.status_code == 200
        # Posts list may be empty or contain only classifieds posts
        data = resp.json()
        assert isinstance(data["posts"], list)


class TestGetForumPost:

    def test_get_returns_200(self, client):
        post = _create_post(client, title="Detail Post")
        pid = post["post_id"]
        resp = client.get(f"{BASE}/posts/{pid}")
        assert resp.status_code == 200
        assert resp.json()["post_id"] == pid
        assert resp.json()["title"] == "Detail Post"

    def test_get_includes_comment_count(self, client):
        post = _create_post(client)
        pid = post["post_id"]
        # Add 2 comments
        client.post(f"{BASE}/posts/{pid}/comments", json={"body": "Comment 1"})
        client.post(f"{BASE}/posts/{pid}/comments", json={"body": "Comment 2"})
        data = client.get(f"{BASE}/posts/{pid}").json()
        assert data["comment_count"] == 2

    def test_get_unknown_post_returns_404(self, client):
        resp = client.get(f"{BASE}/posts/does-not-exist")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


# ══════════════════════════════════════════════════════════════════════════════
# Forum Comments
# ══════════════════════════════════════════════════════════════════════════════

class TestCreateForumComment:

    def test_create_comment_returns_201(self, client):
        post = _create_post(client)
        pid = post["post_id"]
        resp = client.post(
            f"{BASE}/posts/{pid}/comments",
            json={"body": "Great post!", "author_id": "resident-002"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["body"] == "Great post!"
        assert data["post_id"] == pid
        assert "comment_id" in data
        assert "created_at" in data

    def test_create_comment_unknown_post_returns_404(self, client):
        resp = client.post(
            f"{BASE}/posts/no-such-post/comments",
            json={"body": "Orphan comment."},
        )
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_create_comment_missing_body_returns_422(self, client):
        post = _create_post(client)
        pid = post["post_id"]
        resp = client.post(f"{BASE}/posts/{pid}/comments", json={})
        assert resp.status_code == 422

    def test_create_comment_without_author_is_allowed(self, client):
        post = _create_post(client)
        pid = post["post_id"]
        resp = client.post(f"{BASE}/posts/{pid}/comments", json={"body": "Anonymous."})
        assert resp.status_code == 201


class TestListForumComments:

    def test_list_comments_returns_200(self, client):
        post = _create_post(client)
        pid = post["post_id"]
        client.post(f"{BASE}/posts/{pid}/comments", json={"body": "C1"})
        client.post(f"{BASE}/posts/{pid}/comments", json={"body": "C2"})
        resp = client.get(f"{BASE}/posts/{pid}/comments")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["comments"]) == 2

    def test_list_comments_has_pagination_envelope(self, client):
        post = _create_post(client)
        pid = post["post_id"]
        resp = client.get(f"{BASE}/posts/{pid}/comments")
        assert resp.status_code == 200
        data = resp.json()
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert "comments" in data

    def test_list_comments_oldest_first(self, client):
        post = _create_post(client)
        pid = post["post_id"]
        client.post(f"{BASE}/posts/{pid}/comments", json={"body": "Alpha"})
        client.post(f"{BASE}/posts/{pid}/comments", json={"body": "Beta"})
        client.post(f"{BASE}/posts/{pid}/comments", json={"body": "Gamma"})
        data = client.get(f"{BASE}/posts/{pid}/comments").json()
        bodies = [c["body"] for c in data["comments"]]
        assert bodies[0] == "Alpha"
        assert bodies[-1] == "Gamma"

    def test_list_comments_pagination(self, client):
        post = _create_post(client)
        pid = post["post_id"]
        for i in range(5):
            client.post(f"{BASE}/posts/{pid}/comments", json={"body": f"Comment {i}"})
        page1 = client.get(f"{BASE}/posts/{pid}/comments?skip=0&limit=3").json()
        page2 = client.get(f"{BASE}/posts/{pid}/comments?skip=3&limit=3").json()
        assert len(page1["comments"]) == 3
        assert len(page2["comments"]) == 2
        assert page1["total"] == 5

    def test_list_comments_unknown_post_returns_404(self, client):
        resp = client.get(f"{BASE}/posts/no-such-post/comments")
        assert resp.status_code == 404


# ══════════════════════════════════════════════════════════════════════════════
# Lost & Found
# ══════════════════════════════════════════════════════════════════════════════

class TestCreateLostFoundItem:

    def test_create_lost_item_returns_201(self, client):
        resp = client.post(
            f"{BASE}/lost-found",
            json={
                "item_type": "lost",
                "title": "Car keys",
                "description": "Left near the main gate.",
                "reported_by": "resident-003",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["item_type"] == "lost"
        assert data["title"] == "Car keys"
        assert data["status"] == "open"
        assert "item_id" in data
        assert "created_at" in data

    def test_create_found_item_returns_201(self, client):
        data = _create_item(client, item_type="found", title="Found umbrella")
        assert data["item_type"] == "found"
        assert data["status"] == "open"

    def test_create_with_image_ref(self, client):
        data = _create_item(client, image_ref="https://img.example.com/umbrella.jpg")
        assert data["image_ref"] == "https://img.example.com/umbrella.jpg"

    def test_create_invalid_item_type_returns_422(self, client):
        resp = client.post(
            f"{BASE}/lost-found",
            json={"item_type": "stolen", "title": "My bike"},
        )
        assert resp.status_code == 422

    def test_create_missing_title_returns_422(self, client):
        resp = client.post(
            f"{BASE}/lost-found",
            json={"item_type": "lost"},
        )
        assert resp.status_code == 422

    def test_create_missing_item_type_returns_422(self, client):
        resp = client.post(
            f"{BASE}/lost-found",
            json={"title": "Some item"},
        )
        assert resp.status_code == 422

    def test_new_item_status_is_open(self, client):
        """Items always start as 'open'."""
        data = _create_item(client)
        assert data["status"] == "open"


class TestListLostFoundItems:

    def test_list_returns_all(self, client):
        _create_item(client, item_type="lost", title="Lost Keys")
        _create_item(client, item_type="found", title="Found Wallet")
        resp = client.get(f"{BASE}/lost-found")
        assert resp.status_code == 200
        data = resp.json()
        titles = {i["title"] for i in data["items"]}
        assert {"Lost Keys", "Found Wallet"}.issubset(titles)

    def test_list_has_pagination_envelope(self, client):
        resp = client.get(f"{BASE}/lost-found")
        data = resp.json()
        assert "total" in data
        assert "skip" in data
        assert "limit" in data
        assert "items" in data

    def test_list_filter_by_item_type_lost(self, client):
        _create_item(client, item_type="lost", title="Lost Phone")
        _create_item(client, item_type="found", title="Found Keys")
        resp = client.get(f"{BASE}/lost-found?item_type=lost")
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert all(i["item_type"] == "lost" for i in items)
        titles = [i["title"] for i in items]
        assert "Lost Phone" in titles
        assert "Found Keys" not in titles

    def test_list_filter_by_item_type_found(self, client):
        _create_item(client, item_type="lost",  title="Lost Bag")
        _create_item(client, item_type="found", title="Found Bag")
        resp = client.get(f"{BASE}/lost-found?item_type=found")
        items = resp.json()["items"]
        assert all(i["item_type"] == "found" for i in items)

    def test_list_filter_by_status_open(self, client):
        item = _create_item(client, title="Open Item")
        # Mark it resolved via PATCH
        client.patch(
            f"{BASE}/lost-found/{item['item_id']}/status",
            json={"status": "resolved"},
        )
        _create_item(client, title="Still Open")
        resp = client.get(f"{BASE}/lost-found?status=open")
        items = resp.json()["items"]
        item_titles = [i["title"] for i in items]
        assert "Still Open" in item_titles
        assert "Open Item" not in item_titles

    def test_list_filter_by_status_resolved(self, client):
        item = _create_item(client, title="To Resolve")
        client.patch(
            f"{BASE}/lost-found/{item['item_id']}/status",
            json={"status": "resolved"},
        )
        resp = client.get(f"{BASE}/lost-found?status=resolved")
        items = resp.json()["items"]
        assert any(i["title"] == "To Resolve" for i in items)
        assert all(i["status"] == "resolved" for i in items)

    def test_list_pagination(self, client):
        for i in range(5):
            _create_item(client, title=f"Paged Item {i}")
        page1 = client.get(f"{BASE}/lost-found?skip=0&limit=3").json()
        page2 = client.get(f"{BASE}/lost-found?skip=3&limit=3").json()
        assert len(page1["items"]) == 3
        assert page1["total"] >= 5

    def test_list_newest_first(self, client):
        _create_item(client, title="Old Item")
        _create_item(client, title="New Item")
        data = client.get(f"{BASE}/lost-found").json()
        titles = [i["title"] for i in data["items"]]
        assert titles.index("New Item") < titles.index("Old Item")


class TestGetLostFoundItem:

    def test_get_returns_200(self, client):
        item = _create_item(client, title="Get Test Item")
        iid = item["item_id"]
        resp = client.get(f"{BASE}/lost-found/{iid}")
        assert resp.status_code == 200
        assert resp.json()["item_id"] == iid
        assert resp.json()["title"] == "Get Test Item"

    def test_get_unknown_returns_404(self, client):
        resp = client.get(f"{BASE}/lost-found/does-not-exist")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


class TestUpdateLostFoundStatus:

    def test_update_open_to_resolved(self, client):
        item = _create_item(client, title="Status Update Test")
        iid = item["item_id"]
        assert item["status"] == "open"

        resp = client.patch(
            f"{BASE}/lost-found/{iid}/status",
            json={"status": "resolved"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "resolved"
        assert data["item_id"] == iid

    def test_update_resolved_to_open(self, client):
        """Should be able to re-open a resolved item."""
        item = _create_item(client)
        iid = item["item_id"]
        client.patch(f"{BASE}/lost-found/{iid}/status", json={"status": "resolved"})
        resp = client.patch(f"{BASE}/lost-found/{iid}/status", json={"status": "open"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "open"

    def test_update_already_resolved_is_idempotent(self, client):
        item = _create_item(client)
        iid = item["item_id"]
        client.patch(f"{BASE}/lost-found/{iid}/status", json={"status": "resolved"})
        # Update again — should still return 200 with resolved status
        resp = client.patch(f"{BASE}/lost-found/{iid}/status", json={"status": "resolved"})
        assert resp.status_code == 200
        assert resp.json()["status"] == "resolved"

    def test_update_invalid_status_returns_422(self, client):
        item = _create_item(client)
        iid = item["item_id"]
        resp = client.patch(
            f"{BASE}/lost-found/{iid}/status",
            json={"status": "archived"},
        )
        assert resp.status_code == 422

    def test_update_unknown_item_returns_404(self, client):
        resp = client.patch(
            f"{BASE}/lost-found/does-not-exist/status",
            json={"status": "resolved"},
        )
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()
