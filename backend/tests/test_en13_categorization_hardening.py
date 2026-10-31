"""
EN-13 — Harden Complaint Categorization.

Story: as the Association President, I want robust categorization so that
new/unknown categories are handled.

Additional tests beyond test_be13_complaint_categorization.py:
  - Unknown and empty categories are rejected on submission with one
    consistent, informative error, and write nothing.
  - GET /complaints/categories exposes the canonical list, and that list is
    exactly the set submission accepts and the set stats reports.
  - Adding a category to the single source of truth makes it both submittable
    and visible in the discovery endpoint, with no other change (and removing
    one takes effect the same way) — the "new categories are handled" edge.

Categories live in one place: app.schemas.complaint.COMPLAINT_CATEGORIES. The
tests monkeypatch that one name to prove everything derives from it.

Fixtures (client, db_session) are defined in conftest.py.
"""

import pytest

import app.schemas.complaint as complaint_schema

COMPLAINTS_URL = "/api/v1/complaints"
CATEGORIES_URL = "/api/v1/complaints/categories"

CANONICAL = list(complaint_schema.COMPLAINT_CATEGORIES)


def payload(category, **overrides) -> dict:
    body = {
        "category": category,
        "description": "Category validation check.",
        "location": "A-101",
        "raised_by": "resident-001",
    }
    body.update(overrides)
    return body


@pytest.fixture
def set_categories(monkeypatch):
    """Replace the single source of truth for the duration of a test."""
    def _set(categories):
        monkeypatch.setattr(complaint_schema, "COMPLAINT_CATEGORIES", tuple(categories))
    return _set


# ── Discovery endpoint ──────────────────────────────────────────────────────────

class TestCategoriesEndpoint:

    def test_returns_the_canonical_list_in_order(self, client):
        resp = client.get(CATEGORIES_URL)
        assert resp.status_code == 200
        body = resp.json()
        assert body["categories"] == CANONICAL
        assert body["count"] == len(CANONICAL)

    def test_list_has_no_duplicates(self, client):
        cats = client.get(CATEGORIES_URL).json()["categories"]
        assert len(cats) == len(set(cats))

    def test_endpoint_matches_what_submission_accepts(self, client, db_session):
        """Every advertised category must actually be submittable."""
        for category in client.get(CATEGORIES_URL).json()["categories"]:
            resp = client.post(COMPLAINTS_URL, json=payload(category))
            assert resp.status_code == 201, category
            assert resp.json()["category"] == category

    def test_endpoint_matches_what_stats_reports(self, client, db_session):
        for category in CANONICAL:
            client.post(COMPLAINTS_URL, json=payload(category))
        stats = client.get(f"{COMPLAINTS_URL}/stats").json()
        assert {row["category"] for row in stats["by_category"]} == set(CANONICAL)


# ── Consistent rejection of invalid / empty categories ──────────────────────────

class TestInvalidCategoriesRejected:

    # Near-misses that must all be rejected: unknown, wrong case, wrong
    # separators, empty, and whitespace-only. (A valid name with stray spaces
    # is trimmed and accepted — covered separately below.)
    @pytest.mark.parametrize("bad", [
        "Others", "General", "plumbing", "PLUMBING", "Water_Supply",
        "Plumbing!", "", "   ",
    ])
    def test_invalid_category_returns_400(self, client, bad):
        resp = client.post(COMPLAINTS_URL, json=payload(bad))
        assert resp.status_code == 400

    def test_rejection_message_is_informative(self, client):
        resp = client.post(COMPLAINTS_URL, json=payload("Nope"))
        assert resp.status_code == 400
        # The 400 body carries the field errors; the message names the rule and
        # lists the allowed values, so a client learns what to send.
        text = str(resp.json()["detail"]).lower()
        assert "category must be one of" in text
        assert "plumbing" in text

    def test_rejected_category_writes_nothing(self, client):
        before = client.get(f"{COMPLAINTS_URL}/stats").json()["total"]
        client.post(COMPLAINTS_URL, json=payload("General"))
        after = client.get(f"{COMPLAINTS_URL}/stats").json()["total"]
        assert after == before

    def test_leading_trailing_space_on_a_valid_name_is_trimmed_then_accepted(self, client):
        """A valid category with stray spaces is cleaned, not rejected."""
        resp = client.post(COMPLAINTS_URL, json=payload("  Plumbing  "))
        assert resp.status_code == 201
        assert resp.json()["category"] == "Plumbing"


# ── Edge cases for added / removed categories ───────────────────────────────────

class TestCategorySetChanges:

    def test_added_category_becomes_submittable_and_visible(self, client, db_session, set_categories):
        set_categories(CANONICAL + ["Gardening"])

        # Visible in discovery...
        assert "Gardening" in client.get(CATEGORIES_URL).json()["categories"]
        # ...and accepted on submission.
        resp = client.post(COMPLAINTS_URL, json=payload("Gardening"))
        assert resp.status_code == 201
        assert resp.json()["category"] == "Gardening"

    def test_still_unknown_category_is_rejected_after_an_addition(self, client, set_categories):
        set_categories(CANONICAL + ["Gardening"])
        resp = client.post(COMPLAINTS_URL, json=payload("Landscaping"))
        assert resp.status_code == 400

    def test_previously_valid_category_is_rejected_once_removed(self, client, set_categories):
        set_categories([c for c in CANONICAL if c != "Security"])

        assert "Security" not in client.get(CATEGORIES_URL).json()["categories"]
        resp = client.post(COMPLAINTS_URL, json=payload("Security"))
        assert resp.status_code == 400

    def test_discovery_and_submission_stay_in_lockstep(self, client, db_session, set_categories):
        """Whatever the list is, the endpoint and the accept-set agree exactly."""
        set_categories(["Plumbing", "Gardening", "Pest Control"])

        advertised = client.get(CATEGORIES_URL).json()["categories"]
        for category in advertised:
            assert client.post(COMPLAINTS_URL, json=payload(category)).status_code == 201
        # And a name not on the (new) list is rejected.
        assert client.post(COMPLAINTS_URL, json=payload("Electrical")).status_code == 400
