"""
SQLAlchemy models for the Payments & Billing module (BE-11).

Bill and Payment are kept as separate tables (owed vs paid). The late-fee
snapshot columns (late_fee_grace_days, late_fee_rate_percent) record the
config that was in force when the fee was accrued, so a later change to the
society-wide late-fee settings never retroactively rewrites a fee a resident
has already been shown - the live figure is always recomputed on read by
billing_service.
"""

import uuid

from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


# ── Bill ──────────────────────────────────────────────────────────────────────

class Bill(Base):
    __tablename__ = "bills"

    bill_id        = Column(String, primary_key=True, default=_uuid)
    # Human-readable invoice number, e.g. "INV-202401-A1B2C3". Nullable so
    # existing rows created before this column existed don't break; every
    # bill created going forward gets one (see payment_service.create_bill()).
    bill_no        = Column(String(30), unique=True, nullable=True)
    resident_id    = Column(String, ForeignKey("residents.resident_id"), nullable=False)
    billing_month  = Column(String(20), nullable=False)   # e.g. "2024-01"
    maintenance    = Column(Numeric(10, 2), nullable=True, default=0)
    water          = Column(Numeric(10, 2), nullable=True, default=0)
    parking        = Column(Numeric(10, 2), nullable=True, default=0)
    miscellaneous  = Column(Numeric(10, 2), nullable=True, default=0)
    discount       = Column(Numeric(10, 2), nullable=True, default=0)
    gst            = Column(Numeric(10, 2), nullable=True, default=0)
    total_amount   = Column(Numeric(10, 2), nullable=False)
    due_date       = Column(Date, nullable=False)
    # ENUM values: pending / paid / overdue / partially_paid
    status         = Column(String(20), nullable=False, default="pending")

    # ── Late fee snapshot (BE-28) ─────────────────────────────────────────────
    late_fee               = Column(Numeric(10, 2), nullable=True, default=0)
    late_fee_accrued_till  = Column(Date, nullable=True)
    late_fee_grace_days    = Column(Integer, nullable=True)
    late_fee_rate_percent  = Column(Numeric(6, 3), nullable=True)

    # Relationships
    resident = relationship("Resident", backref="bills")
    payments = relationship("Payment", back_populates="bill", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_bills_resident_id", "resident_id"),
        Index("ix_bills_status", "status"),
        Index("ix_bills_due_date", "due_date"),
    )


# ── Payment ───────────────────────────────────────────────────────────────────

class Payment(Base):
    __tablename__ = "payments"

    payment_id      = Column(String, primary_key=True, default=_uuid)
    bill_id         = Column(String, ForeignKey("bills.bill_id"), nullable=False)
    resident_id     = Column(String, ForeignKey("residents.resident_id"), nullable=False)
    amount_paid     = Column(Numeric(10, 2), nullable=False)
    # ENUM values: upi / online_transfer / cheque / cash
    payment_method  = Column(String(20), nullable=False)
    paid_on         = Column(DateTime, nullable=False, default=func.now())
    receipt_no      = Column(String(50), unique=True, nullable=False)
    transaction_ref = Column(String(100), nullable=True)
    # ENUM values: pending / paid / failed / cancelled / refunded
    status          = Column(String(20), nullable=False, default="pending")
    # Mock gateway response stored for audit (no real card data ever stored)
    gateway_message = Column(String(200), nullable=True)

    # Relationships
    bill     = relationship("Bill", back_populates="payments")
    resident = relationship("Resident", backref="payments")

    __table_args__ = (
        Index("ix_payments_bill_id", "bill_id"),
        Index("ix_payments_resident_id", "resident_id"),
        Index("ix_payments_status", "status"),
        Index("ix_payments_paid_on", "paid_on"),
    )
