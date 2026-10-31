"""CRUD operations for the Payments & Billing module (BE-11)."""

from datetime import date

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.models.payment import Bill, Payment
from app.schemas.payment import BillCreate, PaymentCreate


# ── Bill CRUD ─────────────────────────────────────────────────────────────────

def get_bill(db: Session, bill_id: str) -> Bill | None:
    return (
        db.query(Bill)
        .options(joinedload(Bill.payments))
        .filter(Bill.bill_id == bill_id)
        .first()
    )


def get_bills_by_resident(
    db: Session,
    resident_id: str,
    status: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[Bill]:
    q = db.query(Bill).filter(Bill.resident_id == resident_id)
    if status:
        q = q.filter(Bill.status == status)
    return q.order_by(Bill.due_date.desc()).offset(skip).limit(limit).all()


def get_all_bills(
    db: Session,
    status: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[Bill]:
    q = db.query(Bill)
    if status:
        q = q.filter(Bill.status == status)
    return q.order_by(Bill.due_date.desc()).offset(skip).limit(limit).all()


def get_overdue_bills(db: Session, as_of: date) -> list[Bill]:
    """Return all pending bills whose due_date has passed."""
    return (
        db.query(Bill)
        .filter(Bill.status == "pending", Bill.due_date < as_of)
        .all()
    )


def create_bill(db: Session, data: BillCreate, gst: float, total: float) -> Bill:
    bill = Bill(
        resident_id=data.resident_id,
        billing_month=data.billing_month,
        maintenance=data.maintenance,
        water=data.water,
        parking=data.parking,
        miscellaneous=data.miscellaneous,
        discount=data.discount,
        gst=gst,
        total_amount=total,
        due_date=data.due_date,
        status="pending",
    )
    db.add(bill)
    return bill


# ── Payment CRUD ──────────────────────────────────────────────────────────────

def get_payment(db: Session, payment_id: str) -> Payment | None:
    return db.query(Payment).filter(Payment.payment_id == payment_id).first()


def get_payments_by_resident(
    db: Session,
    resident_id: str,
    skip: int = 0,
    limit: int = 20,
) -> list[Payment]:
    return (
        db.query(Payment)
        .filter(Payment.resident_id == resident_id)
        .order_by(Payment.paid_on.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def get_payments_by_bill(db: Session, bill_id: str) -> list[Payment]:
    return (
        db.query(Payment)
        .filter(Payment.bill_id == bill_id)
        .order_by(Payment.paid_on.desc())
        .all()
    )


def create_payment(
    db: Session,
    bill_id: str,
    resident_id: str,
    amount_paid: float,
    payment_method: str,
    receipt_no: str,
    transaction_ref: str,
    status: str,
    gateway_message: str,
) -> Payment:
    payment = Payment(
        bill_id=bill_id,
        resident_id=resident_id,
        amount_paid=amount_paid,
        payment_method=payment_method,
        receipt_no=receipt_no,
        transaction_ref=transaction_ref,
        status=status,
        gateway_message=gateway_message,
    )
    db.add(payment)
    return payment


# ── Report aggregates (BE-36) ───────────────────────────────────────────────────

def get_billing_totals(db: Session, date_from: date, date_to: date) -> dict:
    """Raw billing aggregates for GET /reports/payments, scoped to bills due in range."""
    in_range = db.query(Bill).filter(Bill.due_date >= date_from, Bill.due_date <= date_to)

    total_billed = in_range.with_entities(func.coalesce(func.sum(Bill.total_amount), 0)).scalar()
    bill_count = in_range.with_entities(func.count(Bill.bill_id)).scalar()
    total_outstanding = (
        in_range.filter(Bill.status.in_(["pending", "overdue", "partially_paid"]))
        .with_entities(func.coalesce(func.sum(Bill.total_amount), 0))
        .scalar()
    )
    by_status = (
        in_range.with_entities(Bill.status, func.count(Bill.bill_id)).group_by(Bill.status).all()
    )
    return {
        "total_billed": total_billed,
        "bill_count": bill_count,
        "total_outstanding": total_outstanding,
        "by_status": by_status,
    }


def get_collected_summary(db: Session, date_from, date_to) -> tuple[int, object]:
    """(count, total amount) of successfully paid Payment rows, paid_on in range."""
    query = db.query(Payment).filter(
        Payment.status == "paid", Payment.paid_on >= date_from, Payment.paid_on <= date_to
    )
    count = query.with_entities(func.count(Payment.payment_id)).scalar()
    total = query.with_entities(func.coalesce(func.sum(Payment.amount_paid), 0)).scalar()
    return count, total


def get_current_outstanding_summary(db: Session) -> tuple[int, object]:
    """
    Point-in-time (not range-scoped) count + amount of bills that are not
    fully paid - the headline figure for GET /reports/summary, which asks
    "what's owed right now", not "what was billed in this window".
    """
    query = db.query(Bill).filter(Bill.status.in_(["pending", "overdue", "partially_paid"]))
    count = query.with_entities(func.count(Bill.bill_id)).scalar()
    amount = query.with_entities(func.coalesce(func.sum(Bill.total_amount), 0)).scalar()
    return count, amount
