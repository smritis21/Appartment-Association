from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text

from app.database import Base


def _utcnow() -> datetime:
    """Current UTC time, naive, with microsecond precision."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    body = Column(Text, nullable=False)
    author = Column(String(255), nullable=True)
    visibility = Column(String(50), default="public", nullable=False)
    category = Column(String(100), nullable=True)
    # Pinned notices sort to the top of the residents' dashboard. The UI has
    # rendered a "Pinned" section since FE-04; without this column every live
    # announcement came back unpinned and that section was always empty.
    pinned = Column(Boolean, default=False, nullable=False)
    # FE-08 offers Save-draft and a schedule date/time. Without somewhere to
    # keep them a draft would have been published immediately and a scheduled
    # notice sent at once, so both are stored rather than dropped.
    status = Column(String(20), default="published", nullable=False)
    scheduled_for = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)
