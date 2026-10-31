"""
SQLAlchemy model for move-in/move-out slot booking (EN-22).

A move slot reserves the shared moving resource (service elevator / loading
dock) for a block on a given date and time window. Conflicts are detected in
the service layer by real start/end time overlap, since a move slot is an
actual time range rather than a slot chosen from a fixed list of bands.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, Date, DateTime, Index, String, Time

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    """Current UTC time, naive, with microsecond precision."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class MoveSlot(Base):
    __tablename__ = "move_slots"

    move_slot_id = Column(String, primary_key=True, default=_uuid)

    # The shared moving resource is scoped per block (wing/tower), not per
    # flat - two different flats in the same block still contend for the
    # same elevator/dock.
    block        = Column(String(10), nullable=False)
    slot_date    = Column(Date, nullable=False)
    start_time   = Column(Time, nullable=False)
    end_time     = Column(Time, nullable=False)

    # ENUM values: move_in / move_out
    move_type      = Column(String(20), nullable=False)
    # ENUM values: onboarding_application / resident
    reference_type = Column(String(30), nullable=False)
    reference_id   = Column(String, nullable=False)

    created_at = Column(DateTime, nullable=False, default=_utcnow)

    __table_args__ = (
        Index("ix_move_slots_block_date", "block", "slot_date"),
    )
