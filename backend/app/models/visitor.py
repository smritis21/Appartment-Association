"""
SQLAlchemy model for the Visitors module (BE-05).

Decision flow: pending -> approved / rejected / left_at_gate (deliveries
only, when the guard holds the parcel). Once a decision is recorded the
request is terminal, so decided_at IS NULL doubles as a cheap "still
pending" check and a second decision POST is a 409 rather than an update.
"""

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


# ── Visitor ───────────────────────────────────────────────────────────────────

class Visitor(Base):
    __tablename__ = "visitors"

    visitor_id   = Column(String, primary_key=True, default=_uuid)
    resident_id  = Column(String, ForeignKey("residents.resident_id"), nullable=True)

    visitor_name = Column(String(100), nullable=False)
    # e.g. "Guest Visit", "Delivery", "Cab / Taxi", "Home Service", "Relative"
    purpose      = Column(String(100), nullable=True)
    phone        = Column(String(15), nullable=True)
    flat_number  = Column(String(10), nullable=True)
    gate         = Column(String(50), nullable=True)
    vehicle      = Column(String(100), nullable=True)

    pass_code    = Column(String(20), unique=True, nullable=True)
    valid_from   = Column(DateTime, nullable=True)
    valid_until  = Column(DateTime, nullable=True)
    entry_time   = Column(DateTime, nullable=True)
    exit_time    = Column(DateTime, nullable=True)

    # ENUM values: pending / approved / rejected / left_at_gate / expired
    status       = Column(String(20), nullable=False, default="pending")

    # ── Decision fields (BE-05) ───────────────────────────────────────────────
    # decision mirrors the terminal status so the audit answer to "what did the
    # resident actually choose?" survives any later status change (e.g. an
    # approved visitor being marked completed once they leave).
    decision       = Column(String(20), nullable=True)
    decided_by     = Column(String, nullable=True)   # resident_id of the decider
    decided_at     = Column(DateTime, nullable=True)
    decision_notes = Column(Text, nullable=True)

    # Set only for the left_at_gate decision - who took the parcel and where
    # the resident can collect it from.
    collected_by    = Column(String(100), nullable=True)
    pickup_location = Column(String(100), nullable=True)

    requested_at = Column(DateTime, nullable=False, default=func.now())
    created_at   = Column(DateTime, nullable=False, default=func.now())
    updated_at   = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    resident = relationship("Resident", backref="visitors")

    __table_args__ = (
        Index("ix_visitors_resident_id", "resident_id"),
        Index("ix_visitors_status", "status"),
    )
