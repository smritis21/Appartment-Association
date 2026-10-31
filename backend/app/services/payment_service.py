"""Service layer for the Payments & Billing module (BE-11)."""

import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import payments as crud
from app.crud import residents as resident_crud
from app.crud import billing as billing_crud
from app.models.payment import Bill, Payment
from app.schemas.payment import (
    BillCreate,
    BillOut,
    BillSummary,
    PaymentCreate,
    PaymentReceipt,
    PaymentOut,
)
from app.services import audit_service, mock_gateway

GST_RATE = Decimal("0.18")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_bill_or_404(db: Session, bill_id: str) -> Bill:
    bill = crud.get_bill(db, bill_id)
    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bill '{bill_id}' not found.",
        )
    return bill


def _get_payment_or_404(db: Session, payment_id: str) -> Payment:
    payment = crud.get_payment(db, payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment '{payment_id}' not found.",
        )
    return payment


def _generate_receipt_no() -> str:
    """Generate a human-readable unique receipt number: PAY-YYYYMMDD-XXXXXXXX."""
    date_str = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y%m%d")
    uid      = uuid.uuid4().hex[:8].upper()
    return f"PAY-{date_str}-{uid}"


def _generate_bill_no(billing_month: str) -> str:
    """
    Generate a human-readable unique invoice number: INV-YYYYMM-XXXXXX.

    Mirrors _generate_receipt_no()'s convention (a readable prefix + a short
    random suffix for uniqueness) so a Bill has the same kind of
    human-facing identifier a Payment already gets via receipt_no, instead
    of only the raw UUID primary key.
    """
    month_str = billing_month.replace("-", "")
    uid       = uuid.uuid4().hex[:6].upper()
    return f"INV-{month_str}-{uid}"


def _calculate_totals(data: BillCreate) -> tuple[Decimal, Decimal]:
    """
    Returns (gst_amount, total_amount).
    GST is 18% of (maintenance + water + parking + miscellaneous - discount).
    """
    subtotal = (
        data.maintenance + data.water + data.parking + data.miscellaneous - data.discount
    )
    if subtotal < 0:
        subtotal = Decimal("0")
    gst   = (subtotal * GST_RATE).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    total = (subtotal + gst).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return gst, total


# ── Bill operations ───────────────────────────────────────────────────────────

def create_bill(
    db: Session,
    data: BillCreate,
    actor_id: str | None = None,
    actor_role: str | None = None,
) -> BillOut:
    # Resident must exist
    resident = resident_crud.get_resident(db, data.resident_id)
    if not resident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{data.resident_id}' not found.",
        )

    # Prevent duplicate bills for the same resident and billing period.
    existing = billing_crud.get_bill_for_resident_and_month(
        db, data.resident_id, data.billing_month
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"A bill for resident '{data.resident_id}' and billing month "
                f"'{data.billing_month}' already exists (bill_id: {existing.bill_id})."
            ),
        )

    gst, total = _calculate_totals(data)
    bill = crud.create_bill(db, data, gst=float(gst), total=float(total))
    bill.bill_no = _generate_bill_no(data.billing_month)
    db.flush()

    audit_service.log_action(
        db,
        actor_id=actor_id,
        actor_role=actor_role,
        module="billing",
        action="bill_generated",
        target_type="bill",
        target_id=bill.bill_id,
        description=(
            f"Bill {bill.bill_no} generated for resident {bill.resident_id}, "
            f"billing month {bill.billing_month}, total ₹{total}."
        ),
    )

    db.commit()
    db.refresh(bill)
    return BillOut.model_validate(bill)


def get_bill(db: Session, bill_id: str) -> BillOut:
    bill = _get_bill_or_404(db, bill_id)
    return BillOut.model_validate(bill)


def list_bills(
    db: Session,
    resident_id: str | None = None,
    status_filter: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[BillSummary]:
    if resident_id:
        bills = crud.get_bills_by_resident(
            db, resident_id, status=status_filter, skip=skip, limit=limit
        )
    else:
        bills = crud.get_all_bills(db, status=status_filter, skip=skip, limit=limit)
    return [BillSummary.model_validate(b) for b in bills]


# ── Payment processing ────────────────────────────────────────────────────────

def process_payment(
    db: Session,
    data: PaymentCreate,
    actor_id: str | None = None,
    actor_role: str | None = None,
) -> PaymentReceipt:
    """
    Process a payment against a bill, as one transaction.

    A payment record is written whether the gateway succeeds or fails -
    a failed attempt is still audit trail - but the bill status only
    advances on success.
    """
    bill = _get_bill_or_404(db, data.bill_id)

    # Bill must be in a payable state
    if bill.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This bill has already been paid in full.",
        )
    if bill.status == "cancelled":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This bill has been cancelled and cannot be paid.",
        )

    # Amount must not exceed the bill total
    amount_paid = Decimal(str(data.amount_paid))
    bill_total  = Decimal(str(bill.total_amount))
    if amount_paid > bill_total:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Amount paid (₹{amount_paid}) exceeds bill total (₹{bill_total}). "
                "Overpayment is not allowed."
            ),
        )

    # Call mock gateway
    gateway_result = mock_gateway.process(
        amount=float(amount_paid),
        payment_method=data.payment_method.value,
        mock_reference=data.gateway.mock_reference,
        simulate_failure=data.gateway.simulate_failure,
        simulate_timeout=data.gateway.simulate_timeout,
    )

    receipt_no      = _generate_receipt_no()
    payment_status  = "paid" if gateway_result.success else "failed"
    transaction_ref = gateway_result.transaction_ref

    # Create payment record regardless of success/failure (audit trail)
    payment = crud.create_payment(
        db=db,
        bill_id=bill.bill_id,
        resident_id=bill.resident_id,
        amount_paid=float(amount_paid),
        payment_method=data.payment_method.value,
        receipt_no=receipt_no,
        transaction_ref=transaction_ref,
        status=payment_status,
        gateway_message=gateway_result.message,
    )
    db.flush()  # populate payment.payment_id (PK default) before it's referenced below

    # Update bill status only on gateway success
    if gateway_result.success:
        if amount_paid >= bill_total:
            bill.status = "paid"
        else:
            bill.status = "partially_paid"

    # Audit log - written before commit so the entry and the payment/bill
    # update it describes land in the same transaction. Logged for both a
    # successful and a failed gateway attempt: a failed payment still
    # produces a persisted Payment row (audit trail) and is a "key action"
    # in its own right. Falls back to the bill's resident when the caller
    # isn't authenticated (payments/billing endpoints don't require a
    # token today).
    audit_service.log_action(
        db,
        actor_id=actor_id or bill.resident_id,
        actor_role=actor_role or "resident",
        module="payments",
        action="payment_processed",
        target_type="payment",
        target_id=payment.payment_id,
        description=(
            f"Payment of ₹{amount_paid} via {data.payment_method.value} against "
            f"bill {bill.bill_id} - status: {payment_status}."
        ),
    )

    # Atomic commit - both payment record and bill status saved together
    try:
        db.commit()
        db.refresh(payment)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Payment could not be saved. Please try again.",
        )

    # If gateway failed, raise after committing the failed payment record
    if not gateway_result.success:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=gateway_result.message,
        )

    return PaymentReceipt(
        payment_id=payment.payment_id,
        receipt_no=payment.receipt_no,
        transaction_ref=payment.transaction_ref,
        bill_id=payment.bill_id,
        resident_id=payment.resident_id,
        billing_month=bill.billing_month,
        amount_paid=Decimal(str(payment.amount_paid)),
        payment_method=data.payment_method,
        paid_on=payment.paid_on,
        status=payment_status,
        gateway_message=gateway_result.message,
    )


# ── Payment history ───────────────────────────────────────────────────────────

def get_payment(db: Session, payment_id: str) -> PaymentOut:
    payment = _get_payment_or_404(db, payment_id)
    return PaymentOut.model_validate(payment)


def list_payments_by_resident(
    db: Session,
    resident_id: str,
    skip: int = 0,
    limit: int = 20,
) -> list[PaymentOut]:
    payments = crud.get_payments_by_resident(db, resident_id, skip=skip, limit=limit)
    return [PaymentOut.model_validate(p) for p in payments]
