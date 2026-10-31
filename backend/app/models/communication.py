"""
SQLAlchemy models for the Communication module (BE-27).

Circular attachments and poll options are stored as JSON lists rather than
child tables, since both are short and effectively append-only, so a join
on every read isn't worth it. Poll tallies are likewise never stored on the
poll row - they're derived from COUNT(poll_responses) on read so there's no
second write path that could drift out of sync.
"""

import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


# Maximum number of attachment paths allowed per circular.
MAX_ATTACHMENTS = 5


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


# ── Circular ──────────────────────────────────────────────────────────────────

class Circular(Base):
    """A circular or notice published by the admin."""
    __tablename__ = "circulars"

    circular_id  = Column(String, primary_key=True, default=_uuid)

    title        = Column(String(200), nullable=False)
    body         = Column(Text, nullable=False)
    # ENUM: general | meeting | notice | urgent
    category     = Column(String(20), nullable=False, default="general")
    # Nullable - only required/meaningful for meeting circulars
    meeting_date = Column(String(10), nullable=True)
    # JSON list of file-path strings; enforced to MAX_ATTACHMENTS in service
    attachments  = Column(JSON, nullable=False, default=list)
    created_by   = Column(String(100), nullable=True)

    created_at   = Column(DateTime, nullable=False, default=func.now())
    updated_at   = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_circulars_category", "category"),
        Index("ix_circulars_meeting_date", "meeting_date"),
    )


# ── Poll ──────────────────────────────────────────────────────────────────────

class Poll(Base):
    """An admin-created poll or survey."""
    __tablename__ = "polls"

    poll_id    = Column(String, primary_key=True, default=_uuid)

    question   = Column(String(500), nullable=False)
    # JSON list of option strings (min 2, validated by service/schema)
    options    = Column(JSON, nullable=False)
    created_by = Column(String(100), nullable=True)

    open_at    = Column(DateTime, nullable=False)
    close_at   = Column(DateTime, nullable=False)

    created_at = Column(DateTime, nullable=False, default=func.now())

    responses  = relationship(
        "PollResponse", back_populates="poll", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_polls_open_at", "open_at"),
        Index("ix_polls_close_at", "close_at"),
    )


# ── PollResponse ──────────────────────────────────────────────────────────────

class PollResponse(Base):
    """One resident's response to a poll; poll_id + resident_id is unique."""
    __tablename__ = "poll_responses"

    response_id   = Column(String, primary_key=True, default=_uuid)
    poll_id       = Column(String, ForeignKey("polls.poll_id"), nullable=False)
    resident_id   = Column(String, ForeignKey("residents.resident_id"), nullable=False)
    chosen_option = Column(String(200), nullable=False)
    responded_at  = Column(DateTime, nullable=False, default=func.now())

    poll     = relationship("Poll", back_populates="responses")
    resident = relationship("Resident", backref="poll_responses")

    __table_args__ = (
        UniqueConstraint("poll_id", "resident_id", name="uq_poll_response_resident"),
        Index("ix_poll_responses_poll_id", "poll_id"),
        Index("ix_poll_responses_resident_id", "resident_id"),
    )
