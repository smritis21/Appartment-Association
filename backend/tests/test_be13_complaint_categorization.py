"""
pytest tests for BE-13 — Complaint Categorization.

Story: as a resident, I want to select a category when I submit a
complaint, so that it can be routed to the right staff and reported on
accurately.

Covers:
  - Each of the fixed categories is accepted, including the "Other" catch-all
  - Exactly one category is stored per complaint (no multi-select)
  - Any value outside the fixed list is rejected with 400

Fixtures (client, db_session) are defined in conftest.py.
"""

import pytest

from app.schemas.complaint import COMPLAINT_CATEGORIES

COMPLAINTS_URL = "/api/v1/complaints"

# Read from the schema so the list cannot drift from what the API accepts.
VALID_CATEGORIES = list(COMPLAINT_CATEGORIES)
INVALID_CATEGORIES = ["plumbing", "Water_Supply", "", "General", "Others"]


def payload(category: str) -> dict:
    return {
        "category": category,
        "description": "Category validation check.",
        "location": "A-101",
        "raised_by": "resident-001",
    }


@pytest.mark.parametrize("category", VALID_CATEGORIES)
def test_each_fixed_category_is_accepted(client, db_session, category):
    response = client.post(COMPLAINTS_URL, json=payload(category))

    assert response.status_code == 201
    assert response.json()["category"] == category


def test_complaint_stores_exactly_one_scalar_category(client):
    body = client.post(COMPLAINTS_URL, json=payload("Plumbing")).json()
    assert isinstance(body["category"], str)


def test_all_categories_coexist(client, db_session):
    for category in VALID_CATEGORIES:
        client.post(COMPLAINTS_URL, json=payload(category))

    stats = client.get(f"{COMPLAINTS_URL}/stats").json()
    assert stats["total"] == len(VALID_CATEGORIES)
    assert {row["category"] for row in stats["by_category"]} == set(VALID_CATEGORIES)


@pytest.mark.parametrize("category", INVALID_CATEGORIES)
def test_invalid_categories_return_400(client, category):
    response = client.post(COMPLAINTS_URL, json=payload(category))
    assert response.status_code == 400


def test_rejected_category_writes_nothing(client):
    stats_before = client.get(f"{COMPLAINTS_URL}/stats").json()["total"]
    client.post(COMPLAINTS_URL, json=payload("General"))
    stats_after = client.get(f"{COMPLAINTS_URL}/stats").json()["total"]

    assert stats_after == stats_before
