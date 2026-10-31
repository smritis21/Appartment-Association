"""
EN-30 — Harden Marketplace (additional tests beyond test_be30_marketplace.py).

Covers:
  - Sold items never appear in active (available) listings
  - Invalid / non-positive prices rejected
  - Oversized image URL rejected
  - Unauthorized listing edits (non-seller cannot mark sold)
  - Wishlist idempotency (no duplicate entries)
  - Sold listing still retrievable by ID but excluded from available filter
"""

from decimal import Decimal

from app.models.marketplace import MarketplaceListing, WishlistEntry
from app.models.resident import Flat, Resident

BASE = "/api/v1/marketplace"


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_resident(db_session, name="Test Resident", flat_number="501"):
    flat = Flat(block="E", floor="5", flat_number=flat_number,
                ownership_type="owned", occupancy_status="occupied")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    resident = Resident(flat_id=flat.flat_id, name=name,
                        phone="9333333333", status="active")
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def seed_listing(db_session, resident_id, status="available", **overrides):
    defaults = {
        "resident_id": resident_id,
        "title": "Test Item",
        "price": Decimal("1000.00"),
        "category": "Other",
        "status": status,
    }
    defaults.update(overrides)
    listing = MarketplaceListing(**defaults)
    db_session.add(listing)
    db_session.commit()
    db_session.refresh(listing)
    return listing.listing_id


def seed_wishlist(db_session, listing_id, resident_id):
    entry = WishlistEntry(listing_id=listing_id, resident_id=resident_id)
    db_session.add(entry)
    db_session.commit()
    db_session.refresh(entry)
    return entry.wishlist_id


# ── Sold items excluded from active listings ──────────────────────────────────

class TestSoldItemsExcludedFromActive:

    def test_sold_item_not_in_available_filter(self, client, db_session):
        seller = seed_resident(db_session)
        seed_listing(db_session, seller, title="Available Sofa", status="available")
        seed_listing(db_session, seller, title="Sold Bike", status="sold")

        resp = client.get(f"{BASE}/listings?status=available")
        titles = [p["title"] for p in resp.json()]
        assert "Available Sofa" in titles
        assert "Sold Bike" not in titles

    def test_sold_item_appears_in_sold_filter(self, client, db_session):
        seller = seed_resident(db_session)
        seed_listing(db_session, seller, title="Sold Chair", status="sold")

        resp = client.get(f"{BASE}/listings?status=sold")
        titles = [p["title"] for p in resp.json()]
        assert "Sold Chair" in titles

    def test_sold_item_still_retrievable_by_id(self, client, db_session):
        seller = seed_resident(db_session)
        lid = seed_listing(db_session, seller, title="Sold Lamp", status="sold")

        resp = client.get(f"{BASE}/listings/{lid}")
        assert resp.status_code == 200
        assert resp.json()["status"] == "sold"

    def test_mark_sold_removes_from_available_listing(self, client, db_session):
        seller = seed_resident(db_session)
        lid = seed_listing(db_session, seller, title="Soon Sold")

        client.put(f"{BASE}/listings/{lid}/sold", json={"resident_id": seller})

        resp = client.get(f"{BASE}/listings?status=available")
        titles = [p["title"] for p in resp.json()]
        assert "Soon Sold" not in titles

    def test_unfiltered_listing_includes_both_statuses(self, client, db_session):
        seller = seed_resident(db_session)
        seed_listing(db_session, seller, title="Active Item", status="available")
        seed_listing(db_session, seller, title="Sold Item", status="sold")

        resp = client.get(f"{BASE}/listings")
        titles = {p["title"] for p in resp.json()}
        assert "Active Item" in titles
        assert "Sold Item" in titles


# ── Invalid / non-positive prices ─────────────────────────────────────────────

class TestPriceValidation:

    def test_zero_price_rejected(self, client, db_session):
        seller = seed_resident(db_session)
        resp = client.post(f"{BASE}/listings", json={
            "resident_id": seller, "title": "Free Item",
            "price": 0, "category": "Other",
        })
        assert resp.status_code == 422

    def test_negative_price_rejected(self, client, db_session):
        seller = seed_resident(db_session)
        resp = client.post(f"{BASE}/listings", json={
            "resident_id": seller, "title": "Negative Price",
            "price": -100, "category": "Other",
        })
        assert resp.status_code == 422

    def test_very_small_positive_price_accepted(self, client, db_session):
        seller = seed_resident(db_session)
        resp = client.post(f"{BASE}/listings", json={
            "resident_id": seller, "title": "Cheap Item",
            "price": "0.01", "category": "Other",
        })
        assert resp.status_code == 201

    def test_price_exceeding_max_rejected(self, client, db_session):
        seller = seed_resident(db_session)
        resp = client.post(f"{BASE}/listings", json={
            "resident_id": seller, "title": "Too Expensive",
            "price": "100000000.00", "category": "Other",
        })
        assert resp.status_code == 422


# ── Oversized image URL ───────────────────────────────────────────────────────

class TestOversizedImageUrl:

    def test_image_url_over_500_chars_rejected(self, client, db_session):
        seller = seed_resident(db_session)
        long_url = "https://cdn.example.com/" + "a" * 490
        resp = client.post(f"{BASE}/listings", json={
            "resident_id": seller, "title": "Long URL",
            "price": 100, "category": "Other",
            "image_url": long_url,
        })
        assert resp.status_code == 422

    def test_malformed_image_url_rejected(self, client, db_session):
        seller = seed_resident(db_session)
        resp = client.post(f"{BASE}/listings", json={
            "resident_id": seller, "title": "Bad URL",
            "price": 100, "category": "Other",
            "image_url": "not-a-url",
        })
        assert resp.status_code == 422

    def test_blank_image_url_rejected(self, client, db_session):
        seller = seed_resident(db_session)
        resp = client.post(f"{BASE}/listings", json={
            "resident_id": seller, "title": "Blank URL",
            "price": 100, "category": "Other",
            "image_url": "   ",
        })
        assert resp.status_code == 422

    def test_valid_https_image_url_accepted(self, client, db_session):
        seller = seed_resident(db_session)
        resp = client.post(f"{BASE}/listings", json={
            "resident_id": seller, "title": "Valid URL",
            "price": 100, "category": "Other",
            "image_url": "https://cdn.example.com/item.jpg",
        })
        assert resp.status_code == 201


# ── Unauthorized listing edits ────────────────────────────────────────────────

class TestUnauthorizedListingEdits:

    def test_non_seller_cannot_mark_sold(self, client, db_session):
        seller = seed_resident(db_session, name="Seller", flat_number="501")
        other = seed_resident(db_session, name="Other", flat_number="502")
        lid = seed_listing(db_session, seller)

        resp = client.put(f"{BASE}/listings/{lid}/sold",
                          json={"resident_id": other})
        assert resp.status_code == 403
        assert "seller" in resp.json()["detail"].lower()

    def test_seller_can_mark_own_listing_sold(self, client, db_session):
        seller = seed_resident(db_session)
        lid = seed_listing(db_session, seller)

        resp = client.put(f"{BASE}/listings/{lid}/sold",
                          json={"resident_id": seller})
        assert resp.status_code == 200
        assert resp.json()["status"] == "sold"

    def test_already_sold_listing_cannot_be_sold_again(self, client, db_session):
        seller = seed_resident(db_session)
        lid = seed_listing(db_session, seller, status="sold")

        resp = client.put(f"{BASE}/listings/{lid}/sold",
                          json={"resident_id": seller})
        assert resp.status_code == 400
        assert "already" in resp.json()["detail"].lower()


# ── Wishlist idempotency ──────────────────────────────────────────────────────

class TestWishlistIdempotency:

    def test_duplicate_wishlist_entry_rejected_409(self, client, db_session):
        seller = seed_resident(db_session, name="Seller", flat_number="501")
        buyer = seed_resident(db_session, name="Buyer", flat_number="502")
        lid = seed_listing(db_session, seller)
        seed_wishlist(db_session, lid, buyer)

        resp = client.post(f"{BASE}/listings/{lid}/wishlist",
                           json={"resident_id": buyer})
        assert resp.status_code == 409
        assert "already" in resp.json()["detail"].lower()

    def test_wishlist_count_does_not_increment_on_duplicate_attempt(self, client, db_session):
        seller = seed_resident(db_session, name="Seller", flat_number="501")
        buyer = seed_resident(db_session, name="Buyer", flat_number="502")
        lid = seed_listing(db_session, seller)
        seed_wishlist(db_session, lid, buyer)

        # Attempt duplicate — should fail
        client.post(f"{BASE}/listings/{lid}/wishlist",
                    json={"resident_id": buyer})

        resp = client.get(f"{BASE}/listings/{lid}")
        assert resp.json()["wishlist_count"] == 1

    def test_two_different_buyers_can_wishlist_same_listing(self, client, db_session):
        seller = seed_resident(db_session, name="Seller", flat_number="501")
        buyer1 = seed_resident(db_session, name="Buyer1", flat_number="502")
        buyer2 = seed_resident(db_session, name="Buyer2", flat_number="503")
        lid = seed_listing(db_session, seller)

        r1 = client.post(f"{BASE}/listings/{lid}/wishlist",
                         json={"resident_id": buyer1})
        r2 = client.post(f"{BASE}/listings/{lid}/wishlist",
                         json={"resident_id": buyer2})

        assert r1.status_code == 201
        assert r2.status_code == 201
        assert client.get(f"{BASE}/listings/{lid}").json()["wishlist_count"] == 2

    def test_own_listing_wishlist_rejected(self, client, db_session):
        seller = seed_resident(db_session)
        lid = seed_listing(db_session, seller)

        resp = client.post(f"{BASE}/listings/{lid}/wishlist",
                           json={"resident_id": seller})
        assert resp.status_code == 400
        assert "own listing" in resp.json()["detail"].lower()
