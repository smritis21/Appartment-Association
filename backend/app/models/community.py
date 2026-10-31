"""
SQLAlchemy models for the Community Corners module (BE-34).

Signup counts are never denormalised onto the activity row - they're derived
from COUNT(activity_signups) on read, avoiding a second write path that
could drift. The UniqueConstraint on (activity_id, resident_id) blocks a
resident signing up twice, which also keeps capacity checks meaningful.
"""

import uuid

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
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


# ── CommunityActivity ─────────────────────────────────────────────────────────

class CommunityActivity(Base):
    __tablename__ = "community_activities"

    activity_id   = Column(String, primary_key=True, default=_uuid)

    # ENUM values: kids / senior / recreational / social
    corner        = Column(String(20), nullable=False)
    title         = Column(String(200), nullable=False)
    description   = Column(Text, nullable=True)
    activity_date = Column(Date, nullable=True)
    # NULL = unlimited signups
    capacity      = Column(Integer, nullable=True)
    # ENUM values: upcoming / completed / cancelled
    status        = Column(String(20), nullable=False, default="upcoming")

    created_at    = Column(DateTime, nullable=False, default=func.now())
    updated_at    = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    signups = relationship(
        "ActivitySignup", back_populates="activity", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_community_activities_corner", "corner"),
        Index("ix_community_activities_status", "status"),
        Index("ix_community_activities_activity_date", "activity_date"),
    )


# ── ActivitySignup ────────────────────────────────────────────────────────────

class ActivitySignup(Base):
    __tablename__ = "activity_signups"

    signup_id     = Column(String, primary_key=True, default=_uuid)
    activity_id   = Column(String, ForeignKey("community_activities.activity_id"), nullable=False)
    resident_id   = Column(String, ForeignKey("residents.resident_id"), nullable=False)

    notes         = Column(String(200), nullable=True)
    signed_up_at  = Column(DateTime, nullable=False, default=func.now())

    activity = relationship("CommunityActivity", back_populates="signups")
    resident = relationship("Resident", backref="activity_signups")

    __table_args__ = (
        UniqueConstraint("activity_id", "resident_id", name="uq_activity_signup_resident"),
        Index("ix_activity_signups_activity_id", "activity_id"),
        Index("ix_activity_signups_resident_id", "resident_id"),
    )
