"""
SQLAlchemy model for the agentic assistant (BE-42).

assistant_actions holds actions the assistant has proposed but not yet
executed - it never mutates data straight off a chat message, so the
proposal needs to survive between the propose and confirm requests. It
doubles as an audit trail of what the assistant did or was asked to do.
Conversation transcripts are not stored here; only actions are persisted.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    """Current UTC time, naive, with microsecond precision."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AssistantAction(Base):
    __tablename__ = "assistant_actions"

    action_id = Column(String, primary_key=True, default=_uuid)
    user_id   = Column(String, ForeignKey("users.user_id"), nullable=False)

    # Registry key from assistant_tools.TOOLS - never free text from a model.
    tool      = Column(String(50), nullable=False)
    # JSON-encoded parameters, stored as Text for SQLite/PostgreSQL parity
    # (the same approach MaintenanceSchedule.affected_facilities uses).
    params    = Column(Text, nullable=False, default="{}")
    # Human-readable description of exactly what confirming will do.
    summary   = Column(Text, nullable=False)

    # ENUM values: proposed / confirmed / rejected / expired
    status    = Column(String(20), nullable=False, default="proposed")
    # Identifier of whatever the executor created, for traceability.
    result_ref = Column(String, nullable=True)
    error      = Column(Text, nullable=True)

    created_at  = Column(DateTime, nullable=False, default=_utcnow)
    expires_at  = Column(DateTime, nullable=False)
    resolved_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index("ix_assistant_actions_user_status", "user_id", "status"),
    )
