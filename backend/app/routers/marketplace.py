"""FastAPI router for the Buy & Sell Marketplace module (BE-30)."""

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.marketplace import (
    Category,
    ListingStatus,
    MarketplaceListingCreate,
    MarketplaceListingOut,
    WishlistCreate,
    WishlistEntryOut,
)
from app.services import marketplace_service as service

router = APIRouter(prefix="/marketplace", tags=["Marketplace"])


# ── Listings ──────────────────────────────────────────────────────────────────

@router.post(
    "/listings",
    response_model=MarketplaceListingOut,
    status_code=status.HTTP_201_CREATED,
    summary="List a product for sale",
    description=(
        "Creates a marketplace listing for the selling resident. Price must "
        "be greater than zero and the image reference (if given) must be a "
        "valid http(s) URL or root-relative path."
    ),
    responses={
        201: {"description": "Listing created"},
        404: {"description": "Selling resident not found"},
        422: {"description": "Validation error - bad price, category or image reference"},
    },
)
def create_listing(data: MarketplaceListingCreate, db: Session = Depends(get_db)):
    return service.create_listing(db, data)


@router.get(
    "/listings",
    response_model=list[MarketplaceListingOut],
    summary="Browse marketplace listings",
    description=(
        "Returns listings newest-first. Filter by category, status "
        "(available/sold) or resident_id (a resident's own listings)."
    ),
    responses={422: {"description": "Invalid category/status filter value"}},
)
def list_listings(
    category: Category | None = Query(None, description="Filter by product category"),
    status_filter: ListingStatus | None = Query(
        None, alias="status", description="available / sold"
    ),
    resident_id: str | None = Query(None, description="Only listings from this seller"),
    db: Session = Depends(get_db),
):
    return service.list_listings(db, category, status_filter, resident_id)


@router.get(
    "/listings/{listing_id}",
    response_model=MarketplaceListingOut,
    summary="Get a marketplace listing",
    responses={404: {"description": "Listing not found"}},
)
def get_listing(listing_id: str, db: Session = Depends(get_db)):
    return service.get_listing(db, listing_id)


@router.put(
    "/listings/{listing_id}/sold",
    response_model=MarketplaceListingOut,
    summary="Mark a listing as sold",
    description=(
        "Marks the listing as sold. Only the seller may do this, and only "
        "while the listing is still available."
    ),
    responses={
        200: {"description": "Listing marked as sold"},
        400: {"description": "Listing is already sold"},
        403: {"description": "Caller is not the seller"},
        404: {"description": "Listing not found"},
        422: {"description": "Validation error - resident_id missing"},
    },
)
def mark_sold(
    listing_id: str, data: WishlistCreate, db: Session = Depends(get_db)
):
    # WishlistCreate carries just resident_id - reused here as the "acting
    # resident" payload so the service can verify seller ownership.
    return service.mark_listing_sold(db, listing_id, data.resident_id)


# ── Wishlist ──────────────────────────────────────────────────────────────────

@router.post(
    "/listings/{listing_id}/wishlist",
    response_model=WishlistEntryOut,
    status_code=status.HTTP_201_CREATED,
    summary="Save a listing to a wishlist",
    description=(
        "Adds the listing to the resident's wishlist. Rejected if the "
        "resident owns the listing or has already wishlisted it."
    ),
    responses={
        201: {"description": "Listing wishlisted"},
        400: {"description": "Cannot wishlist your own listing"},
        404: {"description": "Listing or resident not found"},
        409: {"description": "Resident already wishlisted this listing"},
        422: {"description": "Validation error - resident_id missing"},
    },
)
def add_to_wishlist(
    listing_id: str, data: WishlistCreate, db: Session = Depends(get_db)
):
    return service.add_to_wishlist(db, listing_id, data)


@router.delete(
    "/listings/{listing_id}/wishlist/{resident_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a listing from a wishlist",
    responses={
        204: {"description": "Listing removed from wishlist"},
        404: {"description": "Resident has not wishlisted this listing"},
    },
)
def remove_from_wishlist(
    listing_id: str, resident_id: str, db: Session = Depends(get_db)
):
    service.remove_from_wishlist(db, listing_id, resident_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/residents/{resident_id}/wishlist",
    response_model=list[MarketplaceListingOut],
    summary="List a resident's wishlist",
    description="Returns the listings a resident has saved, newest save first.",
    responses={404: {"description": "Resident not found"}},
)
def list_wishlist(resident_id: str, db: Session = Depends(get_db)):
    return service.list_wishlist(db, resident_id)
