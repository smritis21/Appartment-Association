"""
SQLAlchemy models for the Buy & Sell Marketplace module (BE-30).

price uses Numeric(10, 2) like the payments/billing models; positive-value
enforcement lives in the schema/service rather than a DB CHECK, so it
returns a clean 422 instead of an IntegrityError. Wishlist counts are
derived from COUNT(marketplace_wishlist) rather than stored on the listing.
"""

import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


# ── MarketplaceListing ────────────────────────────────────────────────────────

class MarketplaceListing(Base):
    __tablename__ = "marketplace_listings"

    listing_id  = Column(String, primary_key=True, default=_uuid)
    # The seller. FK to residents so a listing always traces to a real resident.
    resident_id = Column(String, ForeignKey("residents.resident_id"), nullable=False)

    title       = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    price       = Column(Numeric(10, 2), nullable=False)
    # ENUM values: Furniture / Electronics / Books / Kids & Toys / Kitchen /
    #              Sports / Other
    category    = Column(String(50), nullable=False)
    # Single primary image reference (URL or storage path). NULL = no image.
    image_url   = Column(String(500), nullable=True)
    # ENUM values: available / sold
    status      = Column(String(20), nullable=False, default="available")

    listed_at   = Column(DateTime, nullable=False, default=func.now())
    updated_at  = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    seller = relationship("Resident", backref="marketplace_listings")
    wishlist_entries = relationship(
        "WishlistEntry", back_populates="listing", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_marketplace_listings_category", "category"),
        Index("ix_marketplace_listings_status", "status"),
        Index("ix_marketplace_listings_resident_id", "resident_id"),
    )


# ── WishlistEntry ─────────────────────────────────────────────────────────────

class WishlistEntry(Base):
    __tablename__ = "marketplace_wishlist"

    wishlist_id = Column(String, primary_key=True, default=_uuid)
    listing_id  = Column(String, ForeignKey("marketplace_listings.listing_id"), nullable=False)
    resident_id = Column(String, ForeignKey("residents.resident_id"), nullable=False)

    added_at    = Column(DateTime, nullable=False, default=func.now())

    listing  = relationship("MarketplaceListing", back_populates="wishlist_entries")
    resident = relationship("Resident", backref="wishlist_entries")

    __table_args__ = (
        UniqueConstraint("listing_id", "resident_id", name="uq_wishlist_listing_resident"),
        Index("ix_marketplace_wishlist_listing_id", "listing_id"),
        Index("ix_marketplace_wishlist_resident_id", "resident_id"),
    )
