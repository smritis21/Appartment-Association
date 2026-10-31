"""
Pydantic schemas for the Buy & Sell Marketplace module (BE-30).

price and image_url are validated here, at the schema boundary, so a bad
payload is rejected with 422 before it reaches the DB: price must be > 0
and within Numeric(10, 2) range, and image_url, when supplied, must be an
http(s) URL or a root-relative path.
"""

from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# ── Allowed ENUM values ───────────────────────────────────────────────────────
# Categories mirror the frontend's PRODUCT_CATEGORIES
# (apartment-app/src/features/marketplace/mock/products.js) so browse filters
# line up on both ends.

Category = Literal[
    "Furniture",
    "Electronics",
    "Books",
    "Kids & Toys",
    "Kitchen",
    "Sports",
    "Other",
]
ListingStatus = Literal["available", "sold"]

# Numeric(10, 2) holds at most 99,999,999.99 - reject anything above it here
# rather than letting the DB raise a less helpful error.
_MAX_PRICE = Decimal("99999999.99")


# ── MarketplaceListing ────────────────────────────────────────────────────────

class MarketplaceListingBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    price: Decimal = Field(..., gt=0, le=_MAX_PRICE, description="Asking price; must be > 0")
    category: Category
    image_url: Optional[str] = Field(
        None,
        max_length=500,
        description="Primary image reference - an http(s) URL or root-relative path",
    )

    @field_validator("image_url")
    @classmethod
    def _validate_image_reference(cls, v: Optional[str]) -> Optional[str]:
        """Rejects blank strings - a blank image_url is a bug, not "no image" (omit the field for that)."""
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("image_url cannot be blank; omit it for no image")
        if not (v.startswith("http://") or v.startswith("https://") or v.startswith("/")):
            raise ValueError(
                "image_url must be an http(s) URL or a root-relative path (starting with '/')"
            )
        return v


class MarketplaceListingCreate(MarketplaceListingBase):
    resident_id: str = Field(..., min_length=1, description="UUID of the selling resident")


class MarketplaceListingOut(MarketplaceListingBase):
    listing_id: str
    resident_id: str
    status: ListingStatus
    wishlist_count: int = Field(0, description="Number of residents who wishlisted this listing")
    listed_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ── Wishlist ──────────────────────────────────────────────────────────────────

class WishlistCreate(BaseModel):
    resident_id: str = Field(..., min_length=1, description="UUID of the resident saving the listing")


class WishlistEntryOut(BaseModel):
    wishlist_id: str
    listing_id: str
    resident_id: str
    added_at: datetime

    model_config = ConfigDict(from_attributes=True)
