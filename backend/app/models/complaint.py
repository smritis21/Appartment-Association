"""
SQLAlchemy models for the Complaints & Staff module (BE-06, BE-15, BE-16).

Status flow: submitted -> assigned -> in_progress -> resolved -> closed.
"""

import uuid

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


# ── Staff ─────────────────────────────────────────────────────────────────────

class Staff(Base):
    __tablename__ = "staff"

    staff_id  = Column(String, primary_key=True, default=_uuid)
    name      = Column(String(100), nullable=False)
    # e.g. "maintenance", "electrician", "plumber", "security"
    role      = Column(String(50), nullable=False)
    phone     = Column(String(15), nullable=True)
    is_active = Column(String(5), nullable=False, default="true")  # "true" / "false"

    complaints = relationship("Complaint", back_populates="assigned_staff")


# ── Complaint ─────────────────────────────────────────────────────────────────

class Complaint(Base):
    __tablename__ = "complaints"

    complaint_id = Column(String, primary_key=True, default=_uuid)
    # A UUID is the key the database and foreign keys use, but it is not
    # something a resident can read out or quote at the office. This is the
    # reference they are shown and asked to keep: "CMP-2026-0001".
    reference    = Column(String(20), unique=True, index=True, nullable=True)
    # e.g. "plumbing", "electrical", "security", "water_supply", "lift_maintenance"
    category     = Column(String(50), nullable=False)
    description  = Column(Text, nullable=False)
    location     = Column(String(100), nullable=True)
    # URL, object key, or file path for an externally stored image
    image_reference = Column(String(500), nullable=True)
    raised_by    = Column(String, nullable=True)  # resident_id, no FK yet (BE-01 owns creation)

    # ENUM values: submitted / assigned / in_progress / resolved / closed
    status       = Column(String(20), nullable=False, default="submitted")

    assigned_to  = Column(String, ForeignKey("staff.staff_id"), nullable=True)
    assigned_at  = Column(DateTime, nullable=True)

    created_at   = Column(DateTime, nullable=False, default=func.now())
    updated_at   = Column(DateTime, nullable=False, default=func.now(), onupdate=func.now())

    assigned_staff = relationship("Staff", back_populates="complaints")
    progress_logs = relationship(
        "ComplaintProgressLog",
        back_populates="complaint",
        cascade="all, delete-orphan",
        order_by="ComplaintProgressLog.updated_at",
    )
    # uselist=False - a complaint is rated at most once (BE-20)
    feedback = relationship(
        "ComplaintFeedback",
        back_populates="complaint",
        cascade="all, delete-orphan",
        uselist=False,
    )

    __table_args__ = (
        Index("ix_complaints_status", "status"),
        Index("ix_complaints_assigned_to", "assigned_to"),
        Index("ix_complaints_raised_by", "raised_by"),
    )


# ── ComplaintProgressLog ──────────────────────────────────────────────────────
# One row per status change, so the full history is retained rather than just
# the complaint's current status.

class ComplaintProgressLog(Base):
    __tablename__ = "complaint_progress_logs"

    log_id       = Column(String, primary_key=True, default=_uuid)
    complaint_id = Column(String, ForeignKey("complaints.complaint_id"), nullable=False)
    # Generic status changes may not have an employee; /progress requires one.
    employee_id  = Column(String, ForeignKey("staff.staff_id"), nullable=True)
    # ENUM values: submitted / assigned / in_progress / resolved / closed
    status       = Column(String(20), nullable=False)
    notes        = Column(Text, nullable=True)
    updated_at   = Column(DateTime, nullable=False, default=func.now())

    complaint = relationship("Complaint", back_populates="progress_logs")
    employee  = relationship("Staff")

    __table_args__ = (
        Index("ix_progress_logs_complaint_id", "complaint_id"),
    )


# ── ComplaintFeedback ─────────────────────────────────────────────────────────
# BE-20 - a resident's rating of how their complaint was handled. Kept as its
# own table rather than columns on `complaints` since most complaints are
# never rated. complaint_id is UNIQUE (not just indexed) so a complaint can
# be rated at most once, enforced at the DB level rather than only by the
# service's 409-on-duplicate check.

class ComplaintFeedback(Base):
    __tablename__ = "complaint_feedback"

    feedback_id  = Column(String, primary_key=True, default=_uuid)
    complaint_id = Column(
        String, ForeignKey("complaints.complaint_id"), nullable=False, unique=True
    )

    # 1–5 stars. Range is enforced in the Pydantic schema; stored as a plain
    # integer so the value is portable across SQLite and PostgreSQL.
    rating       = Column(Integer, nullable=False)
    comment      = Column(Text, nullable=True)

    # resident_id of whoever rated it. Nullable and un-constrained until auth
    # lands and the caller is known from the token rather than the body -
    # same convention as Alert.raised_by and Visitor.decided_by.
    submitted_by = Column(String, nullable=True)
    submitted_at = Column(DateTime, nullable=False, default=func.now())

    complaint = relationship("Complaint", back_populates="feedback")

    __table_args__ = (
        Index("ix_complaint_feedback_complaint_id", "complaint_id"),
    )
