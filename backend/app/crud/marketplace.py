"""CRUD operations for the Buy & Sell Marketplace module (BE-30)."""

from sqlalchemy.orm import Session

from app.models.marketplace import MarketplaceListing, WishlistEntry
from app.schemas.marketplace import MarketplaceListingCreate


# ── Listings ──────────────────────────────────────────────────────────────────

def get_listing(db: Session, listing_id: str) -> MarketplaceListing | None:
    return (
        db.query(MarketplaceListing)
        .filter(MarketplaceListing.listing_id == listing_id)
        .first()
    )


def list_listings(
    db: Session,
    category: str | None = None,
    status: str | None = None,
    resident_id: str | None = None,
) -> list[MarketplaceListing]:
    query = db.query(MarketplaceListing)
    if category:
        query = query.filter(MarketplaceListing.category == category)
    if status:
        query = query.filter(MarketplaceListing.status == status)
    if resident_id:
        query = query.filter(MarketplaceListing.resident_id == resident_id)
    # Newest-first - the marketplace shows the freshest listings at the top.
    return query.order_by(MarketplaceListing.listed_at.desc()).all()


def create_listing(db: Session, data: MarketplaceListingCreate) -> MarketplaceListing:
    listing = MarketplaceListing(**data.model_dump())
    db.add(listing)
    return listing


def mark_sold(db: Session, listing: MarketplaceListing) -> MarketplaceListing:
    listing.status = "sold"
    db.add(listing)
    return listing


def count_wishlist(db: Session, listing_id: str) -> int:
    return (
        db.query(WishlistEntry)
        .filter(WishlistEntry.listing_id == listing_id)
        .count()
    )


# ── Wishlist ──────────────────────────────────────────────────────────────────

def get_wishlist_entry(
    db: Session, listing_id: str, resident_id: str
) -> WishlistEntry | None:
    return (
        db.query(WishlistEntry)
        .filter(
            WishlistEntry.listing_id == listing_id,
            WishlistEntry.resident_id == resident_id,
        )
        .first()
    )


def create_wishlist_entry(
    db: Session, listing_id: str, resident_id: str
) -> WishlistEntry:
    entry = WishlistEntry(listing_id=listing_id, resident_id=resident_id)
    db.add(entry)
    return entry


def delete_wishlist_entry(db: Session, entry: WishlistEntry) -> None:
    db.delete(entry)


def list_wishlisted_listings(
    db: Session, resident_id: str
) -> list[MarketplaceListing]:
    """Return the listings a resident has wishlisted, newest save first."""
    return (
        db.query(MarketplaceListing)
        .join(WishlistEntry, WishlistEntry.listing_id == MarketplaceListing.listing_id)
        .filter(WishlistEntry.resident_id == resident_id)
        .order_by(WishlistEntry.added_at.desc())
        .all()
    )
