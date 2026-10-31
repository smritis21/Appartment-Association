"""
pytest tests for BE-30 — Buy & Sell Marketplace API.

Covers:
  - Listing a product (create), including price/image validation (422)
  - Browsing listings, filtered by category, status and seller
  - Getting a single listing (with derived wishlist_count)
  - Mark-as-sold success, seller-only (403), already-sold (400)
  - Wishlist add success, own-listing (400), duplicate (409)
  - Wishlist remove (204) and a resident's wishlist listing
  - Not-found paths (404)
  - Validation paths (422)

Fixtures (client, db_session) are defined in conftest.py.
"""

from decimal import Decimal

from app.models.marketplace import MarketplaceListing, WishlistEntry
from app.models.resident import Flat, Resident

BASE = "/api/v1/marketplace"


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_resident(db_session, **overrides) -> str:
    flat = Flat(block="A", floor="1", flat_number="101", ownership_type="owned", occupancy_status="occupied")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)

    defaults = {
        "flat_id": flat.flat_id,
        "name": "Test Resident",
        "phone": "9800000000",
        "status": "active",
    }
    defaults.update(overrides)
    resident = Resident(**defaults)
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def seed_listing(db_session, resident_id: str, **overrides) -> str:
    defaults = {
        "resident_id": resident_id,
        "title": "3-seater fabric sofa",
        "price": Decimal("8500.00"),
        "category": "Furniture",
        "status": "available",
    }
    defaults.update(overrides)
    listing = MarketplaceListing(**defaults)
    db_session.add(listing)
    db_session.commit()
    db_session.refresh(listing)
    return listing.listing_id


def seed_wishlist(db_session, listing_id: str, resident_id: str) -> str:
    entry = WishlistEntry(listing_id=listing_id, resident_id=resident_id)
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)
    return entry.wishlist_id


# ── Create listing ────────────────────────────────────────────────────────────

def test_create_listing_returns_201(client, db_session):
    seller = seed_resident(db_session)

    response = client.post(
        f"{BASE}/listings",
        json={
            "resident_id": seller,
            "title": "IFB 23L microwave",
            "description": "Barely used, bill available.",
            "price": 4200,
            "category": "Kitchen",
            "image_url": "https://cdn.example.com/mw.jpg",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "IFB 23L microwave"
    assert body["resident_id"] == seller
    assert body["status"] == "available"
    # Money is Decimal end-to-end, so it serialises as a string (same
    # convention as the payments/billing endpoints) — compare numerically.
    assert Decimal(body["price"]) == Decimal("4200")
    assert body["wishlist_count"] == 0


def test_create_listing_unknown_resident_returns_404(client, db_session):
    response = client.post(
        f"{BASE}/listings",
        json={"resident_id": "does-not-exist", "title": "X", "price": 10, "category": "Other"},
    )

    assert response.status_code == 404
    assert "resident" in response.json()["detail"].lower()


def test_create_listing_zero_price_returns_422(client, db_session):
    seller = seed_resident(db_session)

    response = client.post(
        f"{BASE}/listings",
        json={"resident_id": seller, "title": "Freebie", "price": 0, "category": "Other"},
    )

    assert response.status_code == 422


def test_create_listing_negative_price_returns_422(client, db_session):
    seller = seed_resident(db_session)

    response = client.post(
        f"{BASE}/listings",
        json={"resident_id": seller, "title": "Bad", "price": -5, "category": "Other"},
    )

    assert response.status_code == 422


def test_create_listing_invalid_category_returns_422(client, db_session):
    seller = seed_resident(db_session)

    response = client.post(
        f"{BASE}/listings",
        json={"resident_id": seller, "title": "Thing", "price": 10, "category": "Vehicles"},
    )

    assert response.status_code == 422


def test_create_listing_malformed_image_reference_returns_422(client, db_session):
    seller = seed_resident(db_session)

    response = client.post(
        f"{BASE}/listings",
        json={
            "resident_id": seller,
            "title": "Thing",
            "price": 10,
            "category": "Other",
            "image_url": "not-a-real-reference",
        },
    )

    assert response.status_code == 422


def test_create_listing_blank_image_reference_returns_422(client, db_session):
    seller = seed_resident(db_session)

    response = client.post(
        f"{BASE}/listings",
        json={
            "resident_id": seller,
            "title": "Thing",
            "price": 10,
            "category": "Other",
            "image_url": "   ",
        },
    )

    assert response.status_code == 422


def test_create_listing_root_relative_image_reference_is_accepted(client, db_session):
    seller = seed_resident(db_session)

    response = client.post(
        f"{BASE}/listings",
        json={
            "resident_id": seller,
            "title": "Thing",
            "price": 10,
            "category": "Other",
            "image_url": "/uploads/thing.png",
        },
    )

    assert response.status_code == 201
    assert response.json()["image_url"] == "/uploads/thing.png"


# ── Browse / filter ───────────────────────────────────────────────────────────

def test_list_listings_returns_all(client, db_session):
    seller = seed_resident(db_session)
    seed_listing(db_session, seller, title="Sofa", category="Furniture")
    seed_listing(db_session, seller, title="Microwave", category="Kitchen")

    response = client.get(f"{BASE}/listings")

    assert response.status_code == 200
    titles = {p["title"] for p in response.json()}
    assert titles == {"Sofa", "Microwave"}


def test_list_listings_filters_by_category(client, db_session):
    seller = seed_resident(db_session)
    seed_listing(db_session, seller, title="Sofa", category="Furniture")
    seed_listing(db_session, seller, title="Microwave", category="Kitchen")

    response = client.get(f"{BASE}/listings?category=Kitchen")

    assert response.status_code == 200
    titles = [p["title"] for p in response.json()]
    assert titles == ["Microwave"]


def test_list_listings_filters_by_status(client, db_session):
    seller = seed_resident(db_session)
    seed_listing(db_session, seller, title="Available Sofa", status="available")
    seed_listing(db_session, seller, title="Sold Tricycle", status="sold")

    response = client.get(f"{BASE}/listings?status=sold")

    assert response.status_code == 200
    titles = [p["title"] for p in response.json()]
    assert titles == ["Sold Tricycle"]


def test_list_listings_filters_by_seller(client, db_session):
    seller_a = seed_resident(db_session, name="Arjun")
    seller_b = seed_resident(db_session, name="Priya")
    seed_listing(db_session, seller_a, title="A's Sofa")
    seed_listing(db_session, seller_b, title="B's Racket")

    response = client.get(f"{BASE}/listings?resident_id={seller_a}")

    assert response.status_code == 200
    titles = [p["title"] for p in response.json()]
    assert titles == ["A's Sofa"]


def test_list_listings_invalid_category_returns_422(client, db_session):
    response = client.get(f"{BASE}/listings?category=Vehicles")

    assert response.status_code == 422


def test_get_listing_returns_derived_wishlist_count(client, db_session):
    seller = seed_resident(db_session)
    buyer = seed_resident(db_session, name="Buyer")
    listing_id = seed_listing(db_session, seller)
    seed_wishlist(db_session, listing_id, buyer)

    response = client.get(f"{BASE}/listings/{listing_id}")

    assert response.status_code == 200
    assert response.json()["wishlist_count"] == 1


def test_get_unknown_listing_returns_404(client, db_session):
    response = client.get(f"{BASE}/listings/does-not-exist")

    assert response.status_code == 404


# ── Mark as sold ──────────────────────────────────────────────────────────────

def test_mark_sold_success(client, db_session):
    seller = seed_resident(db_session)
    listing_id = seed_listing(db_session, seller)

    response = client.put(
        f"{BASE}/listings/{listing_id}/sold", json={"resident_id": seller}
    )

    assert response.status_code == 200
    assert response.json()["status"] == "sold"


def test_mark_sold_persists(client, db_session):
    seller = seed_resident(db_session)
    listing_id = seed_listing(db_session, seller)

    client.put(f"{BASE}/listings/{listing_id}/sold", json={"resident_id": seller})

    response = client.get(f"{BASE}/listings/{listing_id}")
    assert response.json()["status"] == "sold"


def test_mark_sold_by_non_seller_returns_403(client, db_session):
    seller = seed_resident(db_session)
    other = seed_resident(db_session, name="Other")
    listing_id = seed_listing(db_session, seller)

    response = client.put(
        f"{BASE}/listings/{listing_id}/sold", json={"resident_id": other}
    )

    assert response.status_code == 403
    assert "seller" in response.json()["detail"].lower()


def test_mark_sold_already_sold_returns_400(client, db_session):
    seller = seed_resident(db_session)
    listing_id = seed_listing(db_session, seller, status="sold")

    response = client.put(
        f"{BASE}/listings/{listing_id}/sold", json={"resident_id": seller}
    )

    assert response.status_code == 400
    assert "already" in response.json()["detail"].lower()


def test_mark_sold_unknown_listing_returns_404(client, db_session):
    seller = seed_resident(db_session)

    response = client.put(
        f"{BASE}/listings/does-not-exist/sold", json={"resident_id": seller}
    )

    assert response.status_code == 404


# ── Wishlist — add ────────────────────────────────────────────────────────────

def test_add_to_wishlist_returns_201(client, db_session):
    seller = seed_resident(db_session)
    buyer = seed_resident(db_session, name="Buyer")
    listing_id = seed_listing(db_session, seller)

    response = client.post(
        f"{BASE}/listings/{listing_id}/wishlist", json={"resident_id": buyer}
    )

    assert response.status_code == 201
    body = response.json()
    assert body["listing_id"] == listing_id
    assert body["resident_id"] == buyer


def test_add_to_wishlist_updates_count(client, db_session):
    seller = seed_resident(db_session)
    buyer = seed_resident(db_session, name="Buyer")
    listing_id = seed_listing(db_session, seller)

    client.post(f"{BASE}/listings/{listing_id}/wishlist", json={"resident_id": buyer})

    response = client.get(f"{BASE}/listings/{listing_id}")
    assert response.json()["wishlist_count"] == 1


def test_wishlist_own_listing_returns_400(client, db_session):
    seller = seed_resident(db_session)
    listing_id = seed_listing(db_session, seller)

    response = client.post(
        f"{BASE}/listings/{listing_id}/wishlist", json={"resident_id": seller}
    )

    assert response.status_code == 400
    assert "own listing" in response.json()["detail"].lower()


def test_duplicate_wishlist_returns_409(client, db_session):
    seller = seed_resident(db_session)
    buyer = seed_resident(db_session, name="Buyer")
    listing_id = seed_listing(db_session, seller)
    seed_wishlist(db_session, listing_id, buyer)

    response = client.post(
        f"{BASE}/listings/{listing_id}/wishlist", json={"resident_id": buyer}
    )

    assert response.status_code == 409
    assert "already" in response.json()["detail"].lower()


def test_wishlist_unknown_listing_returns_404(client, db_session):
    buyer = seed_resident(db_session)

    response = client.post(
        f"{BASE}/listings/does-not-exist/wishlist", json={"resident_id": buyer}
    )

    assert response.status_code == 404
    assert "listing" in response.json()["detail"].lower()


def test_wishlist_unknown_resident_returns_404(client, db_session):
    seller = seed_resident(db_session)
    listing_id = seed_listing(db_session, seller)

    response = client.post(
        f"{BASE}/listings/{listing_id}/wishlist", json={"resident_id": "does-not-exist"}
    )

    assert response.status_code == 404
    assert "resident" in response.json()["detail"].lower()


# ── Wishlist — remove & list ──────────────────────────────────────────────────

def test_remove_from_wishlist_returns_204(client, db_session):
    seller = seed_resident(db_session)
    buyer = seed_resident(db_session, name="Buyer")
    listing_id = seed_listing(db_session, seller)
    seed_wishlist(db_session, listing_id, buyer)

    response = client.delete(f"{BASE}/listings/{listing_id}/wishlist/{buyer}")

    assert response.status_code == 204

    check = client.get(f"{BASE}/listings/{listing_id}")
    assert check.json()["wishlist_count"] == 0


def test_remove_from_wishlist_not_wishlisted_returns_404(client, db_session):
    seller = seed_resident(db_session)
    buyer = seed_resident(db_session, name="Buyer")
    listing_id = seed_listing(db_session, seller)

    response = client.delete(f"{BASE}/listings/{listing_id}/wishlist/{buyer}")

    assert response.status_code == 404


def test_list_resident_wishlist(client, db_session):
    seller = seed_resident(db_session)
    buyer = seed_resident(db_session, name="Buyer")
    l1 = seed_listing(db_session, seller, title="Sofa")
    l2 = seed_listing(db_session, seller, title="Racket")
    seed_wishlist(db_session, l1, buyer)
    seed_wishlist(db_session, l2, buyer)

    response = client.get(f"{BASE}/residents/{buyer}/wishlist")

    assert response.status_code == 200
    titles = {p["title"] for p in response.json()}
    assert titles == {"Sofa", "Racket"}


def test_list_wishlist_unknown_resident_returns_404(client, db_session):
    response = client.get(f"{BASE}/residents/does-not-exist/wishlist")

    assert response.status_code == 404


# ── Validation ────────────────────────────────────────────────────────────────

def test_create_listing_missing_title_returns_422(client, db_session):
    seller = seed_resident(db_session)

    response = client.post(
        f"{BASE}/listings", json={"resident_id": seller, "price": 10, "category": "Other"}
    )

    assert response.status_code == 422


def test_add_to_wishlist_missing_resident_id_returns_422(client, db_session):
    seller = seed_resident(db_session)
    listing_id = seed_listing(db_session, seller)

    response = client.post(f"{BASE}/listings/{listing_id}/wishlist", json={})

    assert response.status_code == 422
