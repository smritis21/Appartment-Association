"""Pydantic schemas for the Payments & Billing module (BE-11)."""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ── Enums ─────────────────────────────────────────────────────────────────────

class PaymentMethod(str, Enum):
    upi              = "upi"
    online_transfer  = "online_transfer"
    cheque           = "cheque"
    cash             = "cash"


class PaymentStatus(str, Enum):
    pending   = "pending"
    paid      = "paid"
    failed    = "failed"
    cancelled = "cancelled"
    refunded  = "refunded"


class BillStatus(str, Enum):
    pending         = "pending"
    paid            = "paid"
    overdue         = "overdue"
    partially_paid  = "partially_paid"


# ── Bill schemas ──────────────────────────────────────────────────────────────

class BillCreate(BaseModel):
    resident_id:   str            = Field(..., description="UUID of the resident being billed")
    billing_month: str            = Field(..., pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
                                          description="Billing month in YYYY-MM format")
    maintenance:   Decimal        = Field(Decimal("0"), ge=0)
    water:         Decimal        = Field(Decimal("0"), ge=0)
    parking:       Decimal        = Field(Decimal("0"), ge=0)
    miscellaneous: Decimal        = Field(Decimal("0"), ge=0)
    discount:      Decimal        = Field(Decimal("0"), ge=0)
    due_date:      date           = Field(..., description="Payment due date")

    @field_validator("due_date")
    @classmethod
    def due_date_must_be_future(cls, v: date) -> date:
        if v < date.today():
            raise ValueError("due_date must be today or a future date.")
        return v


class BillOut(BaseModel):
    bill_id:       str
    bill_no:       Optional[str] = None
    resident_id:   str
    billing_month: str
    maintenance:   Decimal
    water:         Decimal
    parking:       Decimal
    miscellaneous: Decimal
    discount:      Decimal
    gst:           Decimal
    total_amount:  Decimal
    due_date:      date
    status:        BillStatus
    payments:      list["PaymentOut"] = []

    model_config = ConfigDict(from_attributes=True)


class BillSummary(BaseModel):
    bill_id:       str
    bill_no:       Optional[str] = None
    resident_id:   str
    billing_month: str
    total_amount:  Decimal
    due_date:      date
    status:        BillStatus

    model_config = ConfigDict(from_attributes=True)


# ── Mock payment gateway input ────────────────────────────────────────────────
# No real card numbers, CVVs, or bank details are accepted - only mock/
# simulated payment information.

class MockPaymentDetails(BaseModel):
    """Simulated payment gateway input; would be a real gateway token (e.g. Razorpay order_id) in production."""
    # UPI: mock VPA like "resident@mockupi"
    # Online transfer: mock UTR like "UTR123456789"
    # Cheque: mock cheque number like "CHQ001234"
    # Cash: no reference needed
    mock_reference: Optional[str] = Field(
        None,
        max_length=100,
        description="Mock payment reference (UPI VPA, UTR, cheque number, etc.)",
    )
    simulate_failure: bool = Field(
        False,
        description="Set to true to simulate a gateway failure (for testing only)",
    )
    simulate_timeout: bool = Field(
        False,
        description="Set to true to simulate a gateway timeout/interrupted payment (for testing only)",
    )


# ── Payment schemas ───────────────────────────────────────────────────────────

class PaymentCreate(BaseModel):
    bill_id:        str           = Field(..., description="UUID of the bill being paid")
    amount_paid:    Decimal       = Field(..., gt=0, description="Amount being paid (must be > 0)")
    payment_method: PaymentMethod = Field(..., description="Payment method")
    gateway:        MockPaymentDetails = Field(
        default_factory=MockPaymentDetails,
        description="Mock gateway details - no real financial data",
    )


class PaymentOut(BaseModel):
    payment_id:      str
    bill_id:         str
    resident_id:     str
    amount_paid:     Decimal
    payment_method:  PaymentMethod
    paid_on:         datetime
    receipt_no:      str
    transaction_ref: Optional[str]
    status:          PaymentStatus
    gateway_message: Optional[str]

    model_config = ConfigDict(from_attributes=True)


class PaymentReceipt(BaseModel):
    """Returned after a successful payment - the full receipt."""
    payment_id:      str
    receipt_no:      str
    transaction_ref: str
    bill_id:         str
    resident_id:     str
    billing_month:   str
    amount_paid:     Decimal
    payment_method:  PaymentMethod
    paid_on:         datetime
    status:          PaymentStatus
    gateway_message: str

    model_config = ConfigDict(from_attributes=True)


# Required for BillOut forward reference
BillOut.model_rebuild()
