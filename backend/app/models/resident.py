"""SQLAlchemy models for the Residents module (BE-18)."""

import uuid

from sqlalchemy import Boolean, Column, Date, ForeignKey, String
from sqlalchemy.orm import relationship as db_relationship

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


# ── Flat ──────────────────────────────────────────────────────────────────────

class Flat(Base):
    __tablename__ = "flats"

    flat_id          = Column(String, primary_key=True, default=_uuid)
    block            = Column(String(10), nullable=False)
    floor            = Column(String(10), nullable=True)
    flat_number      = Column(String(10), nullable=False)
    # ENUM values: owned / rented
    ownership_type   = Column(String(20), nullable=True)
    # ENUM values: occupied / vacant
    occupancy_status = Column(String(20), nullable=True, default="vacant")

    # One flat → many residents
    residents = db_relationship("Resident", back_populates="flat")


# ── Resident ──────────────────────────────────────────────────────────────────

class Resident(Base):
    __tablename__ = "residents"

    resident_id   = Column(String, primary_key=True, default=_uuid)
    user_id       = Column(String, nullable=True)          # FK to users (future auth)
    flat_id       = Column(String, ForeignKey("flats.flat_id"), nullable=False)
    name          = Column(String(100), nullable=False)
    phone         = Column(String(15), nullable=True)
    occupation    = Column(String(100), nullable=True)
    move_in_date  = Column(Date, nullable=True)
    move_out_date = Column(Date, nullable=True)
    # ENUM values: active / inactive / moved_out
    status        = Column(String(20), nullable=False, default="active")

    # Relationships
    flat             = db_relationship("Flat", back_populates="residents")
    family_members   = db_relationship(
        "FamilyMember", back_populates="resident", cascade="all, delete-orphan"
    )
    emergency_contacts = db_relationship(
        "EmergencyContact", back_populates="resident", cascade="all, delete-orphan"
    )


# ── FamilyMember ──────────────────────────────────────────────────────────────

class FamilyMember(Base):
    __tablename__ = "family_members"

    member_id   = Column(String, primary_key=True, default=_uuid)
    resident_id = Column(String, ForeignKey("residents.resident_id"), nullable=False)
    name        = Column(String(100), nullable=False)
    relation    = Column(String(50), nullable=True)
    phone       = Column(String(15), nullable=True)

    resident = db_relationship("Resident", back_populates="family_members")


# ── EmergencyContact ──────────────────────────────────────────────────────────

class EmergencyContact(Base):
    __tablename__ = "emergency_contacts"

    contact_id   = Column(String, primary_key=True, default=_uuid)
    resident_id  = Column(String, ForeignKey("residents.resident_id"), nullable=False)
    name         = Column(String(100), nullable=False)
    phone        = Column(String(15), nullable=False)

    # Must be assigned before the `relationship` column below, otherwise that
    # column shadows the sqlalchemy.orm.relationship() name within this class
    # body and the call below resolves to a Column instead of a function.
    resident = db_relationship("Resident", back_populates="emergency_contacts")

    relationship = Column(String(50), nullable=True)
