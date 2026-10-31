"""
Pydantic schemas for the Resident Billing API (BE-28).

BE-11 already covers "create a bill" and "process a payment"; this is the
resident-facing read side on top of it. Late-fee figures are recomputed on
read - `late_fee_accrued_till` on the statement tells the client what was
last persisted onto the bill. Enums (PaymentMethod, PaymentStatus,
BillStatus) are reused from schemas/payment.py rather than redeclared.
"""

from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.payment import (
    BillStatus,
    PaymentMethod,
    PaymentOut,
    PaymentStatus,
)


# ── Enums ─────────────────────────────────────────────────────────────────────

class ProrationBasis(str, Enum):
    """
    How a monthly late-fee rate is spread over a part-month.

      daily   - the rate is prorated per overdue day (rate / 30 per day)
      monthly - the rate is charged in whole months; any part month counts
                as a full month (no proration)
    """
    daily   = "daily"
    monthly = "monthly"


class PaymentHistorySort(str, Enum):
    paid_on_desc = "paid_on_desc"
    paid_on_asc  = "paid_on_asc"
    amount_desc  = "amount_desc"
    amount_asc   = "amount_asc"


# ── Late-fee rules & breakdown ────────────────────────────────────────────────

class LateFeeRules(BaseModel):
    """
    The society-wide late-fee rules that were in force for a calculation.

    Sourced from apartment_config (BE-40) keys `late_fee_grace_days`,
    `late_fee_rate_percent`, `late_fee_max_percent` and `late_fee_proration`,
    falling back to billing_service.DEFAULT_LATE_FEE_RULES when unset.
    """
    grace_days:   int            = Field(..., ge=0, description="Days after due_date before a fee starts")
    rate_percent: Decimal        = Field(..., ge=0, description="Late fee rate, percent per month")
    max_percent:  Decimal        = Field(..., ge=0, description="Cap on the fee, percent of bill total")
    proration:    ProrationBasis = Field(..., description="How a part-month is charged")


class LateFeeBreakdown(BaseModel):
    """
    Every figure behind a late fee, so the amount can be explained to a
    resident line by line rather than appearing as an unexplained number.
    """
    bill_id:               str
    due_date:              date
    as_of:                 date            = Field(..., description="Date the fee was computed up to")
    rules:                 LateFeeRules
    days_overdue:          int             = Field(..., description="Calendar days past due_date (0 if not yet due)")
    chargeable_days:       int             = Field(..., description="Overdue days remaining after the grace period")
    within_grace:          bool            = Field(..., description="True while the grace period is still running")
    principal_outstanding: Decimal         = Field(..., description="Bill total minus payments received - the amount the fee is charged on")
    uncapped_late_fee:     Decimal         = Field(..., description="Fee before the cap is applied")
    cap_amount:            Decimal         = Field(..., description="Maximum fee allowed for this bill")
    capped:                bool            = Field(..., description="True when the cap reduced the fee")
    late_fee:              Decimal         = Field(..., description="Late fee payable as of `as_of`")
    total_payable:         Decimal         = Field(..., description="principal_outstanding + late_fee")


class LateFeeAccrualOut(BaseModel):
    """Result of persisting a late-fee snapshot onto a bill."""
    bill_id:              str
    previous_late_fee:    Decimal
    late_fee:             Decimal
    late_fee_accrued_till: date
    status:               BillStatus
    breakdown:            LateFeeBreakdown


class LateFeeAccrualSummary(BaseModel):
    """Result of the bulk accrual run across every outstanding bill."""
    as_of:                date
    bills_evaluated:      int
    bills_updated:        int
    total_late_fee_added: Decimal
    bills_marked_overdue: int


# ── Bill statement ────────────────────────────────────────────────────────────

class BillLineItems(BaseModel):
    """The charge breakdown of a bill, kept separate so the statement reads cleanly."""
    maintenance:   Decimal
    water:         Decimal
    parking:       Decimal
    miscellaneous: Decimal
    discount:      Decimal
    taxable_subtotal: Decimal = Field(..., description="maintenance + water + parking + misc − discount")
    gst:           Decimal
    total_amount:  Decimal


class BillStatement(BaseModel):
    """
    A bill served in full - what was charged, what has been paid, what the
    late fee currently is, and what is still owed.
    """
    bill_id:               str
    resident_id:           str
    resident_name:         Optional[str] = None
    flat_number:           Optional[str] = None
    billing_month:         str
    due_date:              date
    status:                BillStatus
    line_items:            BillLineItems
    amount_paid:           Decimal = Field(..., description="Sum of successful payments against this bill")
    late_fee:              Decimal = Field(..., description="Live late fee as of today")
    late_fee_accrued_till: Optional[date] = Field(None, description="Date the persisted snapshot was computed up to")
    outstanding:           Decimal = Field(..., description="total_amount + late_fee − amount_paid")
    late_fee_breakdown:    LateFeeBreakdown
    payments:              list[PaymentOut] = []

    model_config = ConfigDict(from_attributes=True)


class BillWithLateFee(BaseModel):
    """List row for a resident's bills - summary figures plus the live late fee."""
    bill_id:       str
    bill_no:       Optional[str] = None
    resident_id:   str
    billing_month: str
    total_amount:  Decimal
    late_fee:      Decimal
    amount_paid:   Decimal
    outstanding:   Decimal
    due_date:      date
    days_overdue:  int
    status:        BillStatus

    model_config = ConfigDict(from_attributes=True)


class BillHistoryPage(BaseModel):
    """
    A page of a resident's bills.

    `total` counts every bill matching the filters. `total_outstanding` sums
    only the rows in `items` - it cannot be computed set-wide in SQL because
    the late fee inside it is derived on read, not stored.
    """
    total:             int     = Field(..., description="Bills matching the filters (not just this page)")
    total_outstanding: Decimal = Field(..., description="Outstanding across the bills on this page, late fee included")
    items:             list[BillWithLateFee]


# ── Receipt ───────────────────────────────────────────────────────────────────

class ReceiptSociety(BaseModel):
    """Issuer block on the receipt. `name` comes from apartment_config."""
    name:              str
    contact_number:    Optional[str] = None


class ReceiptPayer(BaseModel):
    """Payer block on the receipt."""
    resident_id:  str
    name:         Optional[str] = None
    flat_number:  Optional[str] = None


class ReceiptBill(BaseModel):
    """Bill block on the receipt - what the payment was made against."""
    bill_id:       str
    billing_month: str
    due_date:      date
    total_amount:  Decimal
    late_fee:      Decimal


class Receipt(BaseModel):
    """
    A generated receipt for a successful payment.

    Only payments with status `paid` produce a receipt - a failed or cancelled
    transaction has nothing to acknowledge, and the endpoint returns 409 for
    those rather than issuing a document that implies money changed hands.
    """
    receipt_no:              str = Field(..., description="Unique receipt number, PAY-YYYYMMDD-XXXXXXXX")
    issued_at:               datetime
    society:                 ReceiptSociety
    payer:                   ReceiptPayer
    bill:                    ReceiptBill
    payment_id:              str
    amount_paid:             Decimal
    payment_method:          PaymentMethod
    paid_on:                 datetime
    transaction_ref:         Optional[str] = None
    status:                  PaymentStatus
    balance_after_payment:   Decimal = Field(..., description="What was still owed on the bill immediately after this payment")
    gateway_message:         Optional[str] = None
    note:                    str = Field(
        "Computer-generated receipt. No signature required.",
        description="Standing footer text",
    )


# ── Filterable payment history ────────────────────────────────────────────────

class PaymentHistoryFilters(BaseModel):
    """
    Echoed back on the history response so a client can confirm what the
    server actually applied - useful when filters arrive from a saved view.
    """
    resident_id:    Optional[str]           = None
    bill_id:        Optional[str]           = None
    payment_method: Optional[PaymentMethod] = None
    status:         Optional[PaymentStatus] = None
    date_from:      Optional[date]          = None
    date_to:        Optional[date]          = None
    min_amount:     Optional[Decimal]       = None
    max_amount:     Optional[Decimal]       = None
    sort:           PaymentHistorySort      = PaymentHistorySort.paid_on_desc

    @model_validator(mode="after")
    def check_ranges(self) -> "PaymentHistoryFilters":
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must be on or before date_to.")
        if (
            self.min_amount is not None
            and self.max_amount is not None
            and self.min_amount > self.max_amount
        ):
            raise ValueError("min_amount must be less than or equal to max_amount.")
        return self


class PaymentHistoryPage(BaseModel):
    """
    A page of payment history.

    `total` and `total_amount` describe the *whole* filtered result set, not
    just the rows in `items` - a resident looking at page 1 of their history
    still needs to see what they have paid in total.
    """
    total:        int
    total_amount: Decimal = Field(..., description="Sum of `amount_paid` across all successful payments matching the filters")
    filters:      PaymentHistoryFilters
    items:        list[PaymentOut]
