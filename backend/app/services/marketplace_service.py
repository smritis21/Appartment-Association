"""Service layer for the Buy & Sell Marketplace module (BE-30).

Price and image-reference validation live in the schema
(app/schemas/marketplace.py) and surface as 422 before reaching here.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import marketplace as crud
from app.crud import residents as resident_crud
from app.models.marketplace import MarketplaceListing
from app.schemas.marketplace import (
    MarketplaceListingCreate,
    MarketplaceListingOut,
    WishlistCreate,
    WishlistEntryOut,
)
from app.services import audit_service


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_listing_or_404(db: Session, listing_id: str) -> MarketplaceListing:
    listing = crud.get_listing(db, listing_id)
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Listing '{listing_id}' not found.",
        )
    return listing


def _require_resident(db: Session, resident_id: str) -> None:
    if not resident_crud.get_resident(db, resident_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{resident_id}' not found.",
        )


def _to_out(db: Session, listing: MarketplaceListing) -> MarketplaceListingOut:
    """
    Attach the derived wishlist_count. It's never stored on the row (see model
    docstring), so every read recomputes it.
    """
    return MarketplaceListingOut(
        listing_id=listing.listing_id,
        resident_id=listing.resident_id,
        title=listing.title,
        description=listing.description,
        price=listing.price,
        category=listing.category,
        image_url=listing.image_url,
        status=listing.status,
        wishlist_count=crud.count_wishlist(db, listing.listing_id),
        listed_at=listing.listed_at,
        updated_at=listing.updated_at,
    )


# ── Listings ──────────────────────────────────────────────────────────────────

def list_listings(
    db: Session,
    category: str | None = None,
    status_filter: str | None = None,
    resident_id: str | None = None,
) -> list[MarketplaceListingOut]:
    rows = crud.list_listings(db, category, status_filter, resident_id)
    return [_to_out(db, row) for row in rows]


def get_listing(db: Session, listing_id: str) -> MarketplaceListingOut:
    listing = _get_listing_or_404(db, listing_id)
    return _to_out(db, listing)


def create_listing(
    db: Session, data: MarketplaceListingCreate
) -> MarketplaceListingOut:
    """
    Record a resident's product listing.

    Errors:
      404 - selling resident does not exist
      422 - price non-positive/out of range, or image_url malformed (schema)
    """
    _require_resident(db, data.resident_id)

    listing = crud.create_listing(db, data)
    # Flush (not commit) so listing_id is populated for the audit row while
    # the listing and its audit entry stay inside one transaction - mirrors
    # community_service.create_signup's flush-before-audit pattern.
    db.flush()
    audit_service.log_action(
        db,
        actor_id=data.resident_id,
        actor_role="resident",
        module="marketplace",
        action="listing_created",
        target_type="marketplace_listing",
        target_id=listing.listing_id,
        description=f"Listed '{listing.title}' for {listing.price}.",
    )
    db.commit()
    db.refresh(listing)
    return _to_out(db, listing)


def mark_listing_sold(
    db: Session, listing_id: str, resident_id: str
) -> MarketplaceListingOut:
    """
    Mark a listing as sold.

    Only the seller may do this, and only while the listing is still
    available.

    Errors:
      404 - listing does not exist
      403 - caller is not the seller
      400 - listing is already sold
    """
    listing = _get_listing_or_404(db, listing_id)

    if listing.resident_id != resident_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the seller can mark this listing as sold.",
        )
    if listing.status == "sold":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Listing '{listing_id}' is already marked as sold.",
        )

    crud.mark_sold(db, listing)
    db.flush()
    audit_service.log_action(
        db,
        actor_id=resident_id,
        actor_role="resident",
        module="marketplace",
        action="listing_marked_sold",
        target_type="marketplace_listing",
        target_id=listing.listing_id,
        description=f"Marked '{listing.title}' as sold.",
    )
    db.commit()
    db.refresh(listing)
    return _to_out(db, listing)


# ── Wishlist ──────────────────────────────────────────────────────────────────

def add_to_wishlist(
    db: Session, listing_id: str, data: WishlistCreate
) -> WishlistEntryOut:
    """
    Save a listing to a resident's wishlist.

    Errors:
      404 - listing or resident does not exist
      400 - resident is trying to wishlist their own listing
      409 - resident has already wishlisted this listing
    """
    listing = _get_listing_or_404(db, listing_id)
    _require_resident(db, data.resident_id)

    if listing.resident_id == data.resident_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot wishlist your own listing.",
        )
    if crud.get_wishlist_entry(db, listing_id, data.resident_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Resident '{data.resident_id}' has already wishlisted this listing.",
        )

    entry = crud.create_wishlist_entry(db, listing_id, data.resident_id)
    db.commit()
    db.refresh(entry)
    return WishlistEntryOut.model_validate(entry)


def remove_from_wishlist(db: Session, listing_id: str, resident_id: str) -> None:
    """
    Remove a listing from a resident's wishlist (the toggle-off path).

    Errors:
      404 - the resident has not wishlisted this listing
    """
    entry = crud.get_wishlist_entry(db, listing_id, resident_id)
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{resident_id}' has not wishlisted listing '{listing_id}'.",
        )
    crud.delete_wishlist_entry(db, entry)
    db.commit()


def list_wishlist(db: Session, resident_id: str) -> list[MarketplaceListingOut]:
    """Return the listings a resident has wishlisted (the 'Wishlist' tab)."""
    _require_resident(db, resident_id)
    rows = crud.list_wishlisted_listings(db, resident_id)
    return [_to_out(db, row) for row in rows]
