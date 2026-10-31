"""
SQLAlchemy models for the Settings & Configuration module (BE-40).

user_preferences.user_id is UNIQUE - one row per user, created lazily on
first read/write rather than at registration. apartment_config is a
key/value table (not fixed columns) so new config keys can be added without
a migration; ALLOWED_CONFIG_KEYS in settings_service.py is the source of
truth for which keys exist and how they're validated.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    """Current UTC time, naive, with microsecond precision."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class UserPreference(Base):
    __tablename__ = "user_preferences"

    preference_id = Column(String, primary_key=True, default=_uuid)
    user_id       = Column(String, ForeignKey("users.user_id"), nullable=False, unique=True)

    notification_email = Column(String(5), nullable=False, default="true")   # "true" / "false"
    notification_sms    = Column(String(5), nullable=False, default="false")  # "true" / "false"
    # ENUM values: en / hi / ta
    language             = Column(String(10), nullable=False, default="en")
    # ENUM values: light / dark
    theme                = Column(String(10), nullable=False, default="light")

    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)


class ApartmentConfig(Base):
    __tablename__ = "apartment_config"

    config_id  = Column(String, primary_key=True, default=_uuid)
    key         = Column(String(50), nullable=False, unique=True)
    value       = Column(String(500), nullable=False)
    updated_by  = Column(String, ForeignKey("users.user_id"), nullable=True)

    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        UniqueConstraint("key", name="uq_apartment_config_key"),
    )
