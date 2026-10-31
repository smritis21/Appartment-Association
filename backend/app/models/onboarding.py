"""
SQLAlchemy models for the Onboarding & Approval module (BE-22).

Status flow: pending -> approved (Resident + User activated) or
pending -> rejected (with a reason). flat_id and resident_id stay nullable
on the application until approval, since block/floor/flat_number are stored
as plain strings so an application can be submitted before its flat or
resident row exists.
"""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    """Current UTC time, naive, with microsecond precision."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── OnboardingApplication ─────────────────────────────────────────────────────

class OnboardingApplication(Base):
    __tablename__ = "onboarding_applications"

    application_id = Column(String, primary_key=True, default=_uuid)

    # Link to the User account created via POST /auth/register (BE-21).
    # Nullable so walk-in registrations without a pre-existing account
    # can still be submitted.
    user_id        = Column(String, nullable=True)

    # Applicant details captured at submission time (snapshot, not FK).
    applicant_name = Column(String(100), nullable=False)
    email          = Column(String(255), nullable=False)
    phone          = Column(String(15), nullable=True)

    # ENUM values: owner / tenant
    applicant_type = Column(String(20), nullable=False)

    # Flat details - stored as plain strings so the application can be
    # submitted before the Flat row exists. flat_id is populated on approval.
    block          = Column(String(10), nullable=False)
    floor          = Column(String(10), nullable=True)
    flat_number    = Column(String(10), nullable=False)
    flat_id        = Column(String, nullable=True)   # populated on approval

    move_in_date   = Column(String(20), nullable=True)  # ISO date string
    occupation     = Column(String(100), nullable=True)

    # Tenant-only field: name of the flat's owner. Manually entered, or
    # auto-filled client-side from GET /onboarding/owner-lookup when an
    # approved owner application already exists for the same block+flat.
    owner_name     = Column(String(100), nullable=True)

    # ENUM values: pending / approved / rejected
    status         = Column(String(20), nullable=False, default="pending")

    rejection_reason = Column(Text, nullable=True)

    # Who reviewed it and when; no FK so the audit trail survives the
    # reviewer's account being deleted later.
    reviewed_by    = Column(String, nullable=True)
    reviewed_at    = Column(DateTime, nullable=True)

    # Populated on approval when the Resident row is created.
    resident_id    = Column(String, nullable=True)

    created_at     = Column(DateTime, nullable=False, default=_utcnow)
    updated_at     = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    documents = relationship(
        "UploadedDocument",
        back_populates="application",
        cascade="all, delete-orphan",
        order_by="UploadedDocument.uploaded_at",
    )

    __table_args__ = (
        Index("ix_onboarding_status", "status"),
        Index("ix_onboarding_user_id", "user_id"),
        Index("ix_onboarding_email", "email"),
    )


# ── UploadedDocument ──────────────────────────────────────────────────────────

class UploadedDocument(Base):
    __tablename__ = "uploaded_documents"

    document_id    = Column(String, primary_key=True, default=_uuid)
    application_id = Column(
        String,
        ForeignKey("onboarding_applications.application_id"),
        nullable=False,
    )

    # ENUM values: id_proof / address_proof / ownership_deed /
    #              rental_agreement / other
    document_type     = Column(String(30), nullable=False)
    # File path, URL, data URL, or object-storage key.
    file_reference    = Column(Text, nullable=False)
    original_filename = Column(String(255), nullable=True)

    uploaded_at = Column(DateTime, nullable=False, default=_utcnow)

    application = relationship("OnboardingApplication", back_populates="documents")

    __table_args__ = (
        Index("ix_uploaded_documents_application_id", "application_id"),
    )
