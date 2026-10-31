"""
CRUD operations for the Resident Billing API (BE-28).

Kept separate from crud/payments.py (BE-11) so the write path used by payment
processing stays untouched while BE-28 adds read/filter queries on top of the
same two tables.
"""

from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.payment import Bill, Payment
from app.models.resident import Resident

# Payment rows that represent money actually received. A `failed` or
# `cancelled` row is kept for audit but must never reduce what is owed.
SETTLED_PAYMENT_STATUSES = ("paid",)

# Bill statuses that still have money outstanding against them.
OUTSTANDING_BILL_STATUSES = ("pending", "overdue", "partially_paid")


# ── Bill reads ────────────────────────────────────────────────────────────────

def get_bill_with_payments(db: Session, bill_id: str) -> Bill | None:
    return (
        db.query(Bill)
        .options(joinedload(Bill.payments))
        .filter(Bill.bill_id == bill_id)
        .first()
    )


def filter_bills_by_resident(
    db: Session,
    resident_id: str,
    status: str | None = None,
    billing_month: str | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
    unpaid_only: bool = False,
    skip: int = 0,
    limit: int = 20,
) -> tuple[int, list[Bill]]:
    """
    Returns (total_matching, page_of_bills) for one resident.

    The count is taken before offset/limit so the caller can paginate without
    a second query and without the total shrinking as the client pages.
    """
    q = db.query(Bill).filter(Bill.resident_id == resident_id)

    if status:
        q = q.filter(Bill.status == status)
    if billing_month:
        q = q.filter(Bill.billing_month == billing_month)
    if due_from:
        q = q.filter(Bill.due_date >= due_from)
    if due_to:
        q = q.filter(Bill.due_date <= due_to)
    if unpaid_only:
        q = q.filter(Bill.status.in_(OUTSTANDING_BILL_STATUSES))

    total = q.with_entities(func.count(Bill.bill_id)).scalar() or 0
    bills = (
        q.order_by(Bill.due_date.desc(), Bill.bill_id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    return total, bills


def get_bill_for_resident_and_month(db: Session, resident_id: str, billing_month: str) -> Bill | None:
    """Return an existing bill for a resident+month combination, or None."""
    return (
        db.query(Bill)
        .filter(Bill.resident_id == resident_id, Bill.billing_month == billing_month)
        .first()
    )


def get_outstanding_bills(db: Session) -> list[Bill]:
    """Every bill that still has money owed on it - the input to bulk accrual."""
    return (
        db.query(Bill)
        .filter(Bill.status.in_(OUTSTANDING_BILL_STATUSES))
        .order_by(Bill.due_date)
        .all()
    )


def get_resident_with_flat(db: Session, resident_id: str) -> Resident | None:
    """Resident joined to their flat - used for the name/flat block on a receipt."""
    return (
        db.query(Resident)
        .options(joinedload(Resident.flat))
        .filter(Resident.resident_id == resident_id)
        .first()
    )


# ── Paid-amount aggregates ────────────────────────────────────────────────────

def get_paid_total_for_bill(db: Session, bill_id: str, upto: datetime | None = None) -> Decimal:
    """
    Sum of settled payments against one bill.

    `upto` restricts the sum to payments made at or before a moment in time,
    which is how a receipt reports the balance as it stood right after that
    payment rather than as it stands today.
    """
    q = db.query(func.coalesce(func.sum(Payment.amount_paid), 0)).filter(
        Payment.bill_id == bill_id,
        Payment.status.in_(SETTLED_PAYMENT_STATUSES),
    )
    if upto is not None:
        q = q.filter(Payment.paid_on <= upto)
    return Decimal(str(q.scalar() or 0))


def get_paid_totals_for_bills(db: Session, bill_ids: list[str]) -> dict[str, Decimal]:
    """
    Paid-to-date for many bills in one query.

    Used by the bill list and the bulk accrual run so neither degrades into
    one SUM per bill.
    """
    if not bill_ids:
        return {}
    rows = (
        db.query(Payment.bill_id, func.coalesce(func.sum(Payment.amount_paid), 0))
        .filter(
            Payment.bill_id.in_(bill_ids),
            Payment.status.in_(SETTLED_PAYMENT_STATUSES),
        )
        .group_by(Payment.bill_id)
        .all()
    )
    return {bill_id: Decimal(str(total or 0)) for bill_id, total in rows}


# ── Payment reads ─────────────────────────────────────────────────────────────

def get_payment(db: Session, payment_id: str) -> Payment | None:
    return db.query(Payment).filter(Payment.payment_id == payment_id).first()


def get_payment_by_receipt_no(db: Session, receipt_no: str) -> Payment | None:
    return db.query(Payment).filter(Payment.receipt_no == receipt_no).first()


def filter_payments(
    db: Session,
    resident_id: str | None = None,
    bill_id: str | None = None,
    payment_method: str | None = None,
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    min_amount: Decimal | None = None,
    max_amount: Decimal | None = None,
    sort: str = "paid_on_desc",
    skip: int = 0,
    limit: int = 20,
) -> tuple[int, Decimal, list[Payment]]:
    """
    Returns (total_matching, settled_amount, page_of_payments).

    `date_to` is a calendar date but paid_on is a timestamp, so it's widened
    to 23:59:59.999999 on that day - otherwise a payment made at 14:00 would
    be excluded from a filter ending on its own date. `settled_amount` only
    counts `paid` rows, so a failed attempt in the history doesn't overstate
    what the resident has paid.
    """
    q = db.query(Payment)

    if resident_id:
        q = q.filter(Payment.resident_id == resident_id)
    if bill_id:
        q = q.filter(Payment.bill_id == bill_id)
    if payment_method:
        q = q.filter(Payment.payment_method == payment_method)
    if status:
        q = q.filter(Payment.status == status)
    if date_from:
        q = q.filter(Payment.paid_on >= datetime.combine(date_from, time.min))
    if date_to:
        q = q.filter(Payment.paid_on <= datetime.combine(date_to, time.max))
    if min_amount is not None:
        q = q.filter(Payment.amount_paid >= min_amount)
    if max_amount is not None:
        q = q.filter(Payment.amount_paid <= max_amount)

    total = q.with_entities(func.count(Payment.payment_id)).scalar() or 0
    settled = (
        q.filter(Payment.status.in_(SETTLED_PAYMENT_STATUSES))
        .with_entities(func.coalesce(func.sum(Payment.amount_paid), 0))
        .scalar()
    )

    order_by = {
        "paid_on_desc": (Payment.paid_on.desc(), Payment.payment_id),
        "paid_on_asc":  (Payment.paid_on.asc(), Payment.payment_id),
        "amount_desc":  (Payment.amount_paid.desc(), Payment.payment_id),
        "amount_asc":   (Payment.amount_paid.asc(), Payment.payment_id),
    }[sort]

    payments = q.order_by(*order_by).offset(skip).limit(limit).all()
    return total, Decimal(str(settled or 0)), payments
