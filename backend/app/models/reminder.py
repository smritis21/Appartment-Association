"""SQLAlchemy model for the Payment Reminders module (BE-12)."""

import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class PaymentReminder(Base):
    __tablename__ = "payment_reminders"

    reminder_id   = Column(String, primary_key=True, default=_uuid)
    bill_id       = Column(String, ForeignKey("bills.bill_id"), nullable=False)
    resident_id   = Column(String, ForeignKey("residents.resident_id"), nullable=False)
    # ENUM values: first_notice / second_notice / final_notice / custom
    reminder_type = Column(String(30), nullable=False)
    # ENUM values: email / sms / push / in_app
    channel       = Column(String(20), nullable=False, default="in_app")
    # ENUM values: sent / dismissed / failed
    status        = Column(String(20), nullable=False, default="sent")
    sent_at       = Column(DateTime, nullable=False, default=func.now())
    dismissed_at  = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, nullable=False, default=func.now())

    # Relationships
    bill     = relationship("Bill", backref="reminders")
    resident = relationship("Resident", backref="reminders")

    __table_args__ = (
        Index("ix_reminders_bill_id", "bill_id"),
        Index("ix_reminders_resident_id", "resident_id"),
        Index("ix_reminders_status", "status"),
    )
