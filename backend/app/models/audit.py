"""
SQLAlchemy model for the Audit Log module (BE-39).

audit_logs is meant to be an immutable, append-only record of key actions
across the system. That's enforced by omission rather than a DB trigger:
app/crud/audit.py exposes only create and filtered-read functions, and no
update/delete route exists for it. actor_id has no FK, so the trail survives
the actor being deleted or moved out.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Index, String, Text

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    """Current UTC time, naive, with microsecond precision."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id      = Column(String, primary_key=True, default=_uuid)

    # No FK - see module docstring.
    actor_id    = Column(String, nullable=True)
    actor_role  = Column(String(30), nullable=True)

    module      = Column(String(50), nullable=False)
    action      = Column(String(100), nullable=False)
    target_type = Column(String(50), nullable=True)
    target_id   = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)

    timestamp   = Column(DateTime, nullable=False, default=_utcnow)

    __table_args__ = (
        Index("ix_audit_logs_actor_timestamp", "actor_id", "timestamp"),
        Index("ix_audit_logs_module", "module"),
        Index("ix_audit_logs_action", "action"),
    )
