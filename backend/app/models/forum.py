"""SQLAlchemy models for the Forum & Lost-and-Found module (BE-29)."""

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, JSON, String, Text, func
from sqlalchemy.orm import relationship

from app.database import Base

# Maximum number of image references allowed per forum post
MAX_IMAGE_REFS = 3


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


# ── ForumPost ─────────────────────────────────────────────────────────────────

class ForumPost(Base):
    """A resident-created discussion post."""
    __tablename__ = "forum_posts"

    post_id    = Column(String, primary_key=True, default=_uuid)

    title      = Column(String(200), nullable=False)
    body       = Column(Text, nullable=False)
    # ENUM: general | events | classifieds | safety | lost_found
    category   = Column(String(30), nullable=False, default="general")
    # JSON list of image URL strings; max MAX_IMAGE_REFS entries
    image_refs = Column(JSON, nullable=False, default=list)
    author_id  = Column(String(100), nullable=True)   # resident_id or display name

    created_at = Column(DateTime, nullable=False, default=func.now())
    updated_at = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    comments   = relationship(
        "ForumComment", back_populates="post", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_forum_posts_category", "category"),
        Index("ix_forum_posts_created_at", "created_at"),
    )


# ── ForumComment ──────────────────────────────────────────────────────────────

class ForumComment(Base):
    """A reply to a forum post. Threading is flat - no nested replies."""
    __tablename__ = "forum_comments"

    comment_id = Column(String, primary_key=True, default=_uuid)
    post_id    = Column(String, ForeignKey("forum_posts.post_id"), nullable=False)
    body       = Column(Text, nullable=False)
    author_id  = Column(String(100), nullable=True)

    created_at = Column(DateTime, nullable=False, default=func.now())

    post = relationship("ForumPost", back_populates="comments")

    __table_args__ = (
        Index("ix_forum_comments_post_id", "post_id"),
        Index("ix_forum_comments_created_at", "created_at"),
    )


# ── LostFoundItem ─────────────────────────────────────────────────────────────

class LostFoundItem(Base):
    """An item reported as lost or found."""
    __tablename__ = "lost_found_items"

    item_id      = Column(String, primary_key=True, default=_uuid)

    # ENUM: lost | found
    item_type    = Column(String(10), nullable=False)
    title        = Column(String(200), nullable=False)
    description  = Column(Text, nullable=True)
    # Single optional image URL
    image_ref    = Column(String(500), nullable=True)
    # ENUM: open | resolved
    status       = Column(String(20), nullable=False, default="open")
    reported_by  = Column(String(100), nullable=True)

    created_at   = Column(DateTime, nullable=False, default=func.now())
    updated_at   = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_lost_found_item_type", "item_type"),
        Index("ix_lost_found_status", "status"),
        Index("ix_lost_found_created_at", "created_at"),
    )
