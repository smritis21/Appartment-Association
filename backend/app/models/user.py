"""
SQLAlchemy model for the Authentication & Accounts module (BE-21).

hashed_password is never returned in any API response - enforced by
omission from every Out schema in schemas/auth.py. reset_token is a plain
UUID string rather than a hashed value, since it's single-use, expires in
an hour, and is only ever sent in the reset email - hashing it adds
complexity without a meaningful security gain at that entropy.
email_change_token follows the same pattern for the EN-21 sensitive-field
auditing feature, with pending_email holding the new address until confirmed.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Index, String

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    """Current UTC time, naive, with microsecond precision."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(Base):
    __tablename__ = "users"

    user_id    = Column(String, primary_key=True, default=_uuid)

    email      = Column(String(255), nullable=False, unique=True)
    hashed_password = Column(String(255), nullable=False)
    full_name  = Column(String(100), nullable=False)

    # ENUM values: owner / tenant / president / secretary / admin /
    #              maintenance / security
    role       = Column(String(30), nullable=False, default="owner")

    # ENUM values: pending / active / suspended
    account_status = Column(String(20), nullable=False, default="pending")

    # Nullable link to the Resident row - populated once the account is
    # approved and matched to a resident record.
    resident_id = Column(String, nullable=True)

    # Single-use password-reset token (UUID string, expires in 1 hour).
    # NULL when no reset is in progress.
    reset_token            = Column(String(36), nullable=True)
    reset_token_expires_at = Column(DateTime, nullable=True)

    # Single-use email-change token (UUID string, expires in 30 minutes),
    # mirroring the reset_token pattern above. pending_email holds the new
    # address until the token is confirmed, at which point it is copied
    # into email and these three columns are cleared.
    pending_email                  = Column(String(255), nullable=True)
    email_change_token             = Column(String(36), nullable=True)
    email_change_token_expires_at  = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False, default=_utcnow)
    updated_at = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    __table_args__ = (
        Index("ix_users_email", "email"),
        Index("ix_users_reset_token", "reset_token"),
        Index("ix_users_email_change_token", "email_change_token"),
    )
