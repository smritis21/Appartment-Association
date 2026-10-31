"""Service layer for the Resident Billing API (BE-28).

Late-fee rules, in one place:

    days_overdue     = as_of − due_date                    (0 when not yet due)
    chargeable_days  = max(days_overdue − grace_days, 0)
    principal        = total_amount − payments received    (floored at 0)

    daily proration   fee = principal × rate% × chargeable_days / 30
    monthly proration fee = principal × rate% × ceil(chargeable_days / 30)

    fee = min(fee, total_amount × max_percent%)

Deliberate decisions:
  - The fee is charged on the *principal* outstanding, never on an earlier
    late fee. Fees do not compound.
  - A part payment immediately shrinks the base the fee is charged on, so
    paying something is always better for the resident than paying nothing.
  - A fully paid bill accrues nothing, whenever it was paid.
  - The live figure is recomputed on every read; accrual only writes the
    snapshot (and the rules used) so a later config change cannot rewrite a
    fee a resident has already been shown.
"""

from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import billing as crud
from app.crud import settings as config_crud
from app.models.payment import Bill, Payment
from app.schemas.billing import (
    BillHistoryPage,
    BillLineItems,
    BillStatement,
    BillWithLateFee,
    LateFeeAccrualOut,
    LateFeeAccrualSummary,
    LateFeeBreakdown,
    LateFeeRules,
    PaymentHistoryFilters,
    PaymentHistoryPage,
    ProrationBasis,
    Receipt,
    ReceiptBill,
    ReceiptPayer,
    ReceiptSociety,
)
from app.schemas.payment import PaymentOut

# ── Defaults ──────────────────────────────────────────────────────────────────
# Used when a society has never set the corresponding apartment_config key.
# The matching validators live in services/settings_service.py - that module
# stays the single source of truth for what a valid value looks like.

DEFAULT_LATE_FEE_RULES = LateFeeRules(
    grace_days=7,
    rate_percent=Decimal("2.0"),
    max_percent=Decimal("20.0"),
    proration=ProrationBasis.daily,
)

# A monthly rate spread over a nominal 30-day month. Fixed rather than
# calendar-accurate so two bills overdue by the same number of days always
# attract the same fee regardless of which months they fall in.
DAYS_PER_MONTH = Decimal("30")

DEFAULT_SOCIETY_NAME = "Jains Kences Retreat"


# ── Helpers ───────────────────────────────────────────────────────────────────

def _money(value: Decimal) -> Decimal:
    """Round to 2 dp, half-up - the same convention BE-11 uses for GST."""
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _get_bill_or_404(db: Session, bill_id: str) -> Bill:
    bill = crud.get_bill_with_payments(db, bill_id)
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


def _config_value(db: Session, key: str) -> str | None:
    row = config_crud.get_config(db, key)
    return row.value if row else None


def _ceil_div(numerator: int, denominator: int) -> int:
    return -(-numerator // denominator)


# ── Rule resolution ───────────────────────────────────────────────────────────

def resolve_late_fee_rules(db: Session) -> LateFeeRules:
    """
    Read the four late-fee keys from apartment_config, falling back to
    DEFAULT_LATE_FEE_RULES per key.

    Values are validated on write by settings_service, so a bad value here can
    only come from a direct database edit. We fall back rather than raise -
    a mistyped config row should not take the whole billing API down.
    """
    rules = DEFAULT_LATE_FEE_RULES

    grace = _config_value(db, "late_fee_grace_days")
    rate = _config_value(db, "late_fee_rate_percent")
    cap = _config_value(db, "late_fee_max_percent")
    proration = _config_value(db, "late_fee_proration")

    try:
        grace_days = int(grace) if grace is not None else rules.grace_days
        if grace_days < 0:
            grace_days = rules.grace_days
    except (TypeError, ValueError):
        grace_days = rules.grace_days

    try:
        rate_percent = Decimal(rate) if rate is not None else rules.rate_percent
        if rate_percent < 0:
            rate_percent = rules.rate_percent
    except (TypeError, ArithmeticError, ValueError):
        rate_percent = rules.rate_percent

    try:
        max_percent = Decimal(cap) if cap is not None else rules.max_percent
        if max_percent < 0:
            max_percent = rules.max_percent
    except (TypeError, ArithmeticError, ValueError):
        max_percent = rules.max_percent

    basis = (
        ProrationBasis(proration)
        if proration in (ProrationBasis.daily.value, ProrationBasis.monthly.value)
        else rules.proration
    )

    return LateFeeRules(
        grace_days=grace_days,
        rate_percent=rate_percent,
        max_percent=max_percent,
        proration=basis,
    )


# ── Late-fee computation ──────────────────────────────────────────────────────

def compute_late_fee(
    bill: Bill,
    paid_to_date: Decimal,
    rules: LateFeeRules,
    as_of: date,
) -> LateFeeBreakdown:
    """
    Pure calculation - no database access, no side effects.

    Kept free of the session on purpose: the accrual run calls this once per
    bill, and the tests exercise the rules directly without going through HTTP.
    """
    total = Decimal(str(bill.total_amount))
    principal = _money(max(total - paid_to_date, Decimal("0")))

    days_overdue = max((as_of - bill.due_date).days, 0)
    chargeable_days = max(days_overdue - rules.grace_days, 0)
    within_grace = days_overdue > 0 and chargeable_days == 0

    cap_amount = _money(total * rules.max_percent / Decimal("100"))

    # Nothing owed, or nothing chargeable yet - a paid bill never accrues,
    # however long ago it was settled.
    if principal <= 0 or chargeable_days == 0 or rules.rate_percent == 0:
        uncapped = Decimal("0.00")
        late_fee = Decimal("0.00")
        capped = False
    else:
        monthly_charge = principal * rules.rate_percent / Decimal("100")
        if rules.proration is ProrationBasis.daily:
            periods = Decimal(chargeable_days) / DAYS_PER_MONTH
        else:
            periods = Decimal(_ceil_div(chargeable_days, int(DAYS_PER_MONTH)))
        uncapped = _money(monthly_charge * periods)
        late_fee = min(uncapped, cap_amount)
        capped = uncapped > cap_amount

    return LateFeeBreakdown(
        bill_id=bill.bill_id,
        due_date=bill.due_date,
        as_of=as_of,
        rules=rules,
        days_overdue=days_overdue,
        chargeable_days=chargeable_days,
        within_grace=within_grace,
        principal_outstanding=principal,
        uncapped_late_fee=uncapped,
        cap_amount=cap_amount,
        capped=capped,
        late_fee=_money(late_fee),
        total_payable=_money(principal + late_fee),
    )


def get_late_fee(db: Session, bill_id: str, as_of: date | None = None) -> LateFeeBreakdown:
    """Live late-fee breakdown for one bill. Read-only - nothing is persisted."""
    # `as_of` in the future is allowed on purpose: a resident asking "what
    # will I owe if I pay on the 20th?" is the main reason this endpoint
    # exists separately from the statement.
    bill = _get_bill_or_404(db, bill_id)
    as_of = as_of or date.today()
    paid = crud.get_paid_total_for_bill(db, bill_id)
    return compute_late_fee(bill, paid, resolve_late_fee_rules(db), as_of)


# ── Late-fee accrual (persisting the snapshot) ────────────────────────────────

def _apply_accrual(bill: Bill, breakdown: LateFeeBreakdown, rules: LateFeeRules) -> bool:
    """
    Write the snapshot onto the bill. Returns True when anything changed.

    A bill still in `pending` that is past its grace period is also moved to
    `overdue`, which is what BE-12's reminder rules and BE-36's reports read.
    A `partially_paid` bill keeps its status - the resident has paid something
    and that fact is more useful than re-flagging it.
    """
    changed = False
    previous = Decimal(str(bill.late_fee or 0))

    if previous != breakdown.late_fee:
        bill.late_fee = breakdown.late_fee
        changed = True
    if bill.late_fee_accrued_till != breakdown.as_of:
        bill.late_fee_accrued_till = breakdown.as_of
        changed = True

    bill.late_fee_grace_days = rules.grace_days
    bill.late_fee_rate_percent = rules.rate_percent

    if bill.status == "pending" and breakdown.chargeable_days > 0:
        bill.status = "overdue"
        changed = True

    return changed


def accrue_late_fee(db: Session, bill_id: str, as_of: date | None = None) -> LateFeeAccrualOut:
    """Compute and persist the late-fee snapshot for a single bill."""
    bill = _get_bill_or_404(db, bill_id)
    as_of = as_of or date.today()
    rules = resolve_late_fee_rules(db)

    if bill.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This bill is already paid in full - no late fee can accrue on it.",
        )

    previous = Decimal(str(bill.late_fee or 0))
    paid = crud.get_paid_total_for_bill(db, bill_id)
    breakdown = compute_late_fee(bill, paid, rules, as_of)
    _apply_accrual(bill, breakdown, rules)

    try:
        db.commit()
        db.refresh(bill)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Late fee could not be saved. Please try again.",
        )

    return LateFeeAccrualOut(
        bill_id=bill.bill_id,
        previous_late_fee=_money(previous),
        late_fee=_money(Decimal(str(bill.late_fee or 0))),
        late_fee_accrued_till=bill.late_fee_accrued_till,
        status=bill.status,
        breakdown=breakdown,
    )


def accrue_late_fees(db: Session, as_of: date | None = None) -> LateFeeAccrualSummary:
    """
    Bulk accrual across every outstanding bill.

    This is the endpoint a nightly job calls. It is deliberately idempotent:
    running it twice on the same day recomputes the same figures and reports
    zero bills updated the second time.
    """
    as_of = as_of or date.today()
    rules = resolve_late_fee_rules(db)

    bills = crud.get_outstanding_bills(db)
    paid_by_bill = crud.get_paid_totals_for_bills(db, [b.bill_id for b in bills])

    updated = 0
    marked_overdue = 0
    added = Decimal("0")

    for bill in bills:
        paid = paid_by_bill.get(bill.bill_id, Decimal("0"))
        breakdown = compute_late_fee(bill, paid, rules, as_of)
        previous = Decimal(str(bill.late_fee or 0))
        was_pending = bill.status == "pending"

        if _apply_accrual(bill, breakdown, rules):
            updated += 1
            added += breakdown.late_fee - previous
        if was_pending and bill.status == "overdue":
            marked_overdue += 1

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Late fee accrual could not be saved. Please try again.",
        )

    return LateFeeAccrualSummary(
        as_of=as_of,
        bills_evaluated=len(bills),
        bills_updated=updated,
        total_late_fee_added=_money(added),
        bills_marked_overdue=marked_overdue,
    )


# ── Bill statement ────────────────────────────────────────────────────────────

def get_bill_statement(db: Session, bill_id: str, as_of: date | None = None) -> BillStatement:
    """Serve one bill in full - charges, payments, live late fee, outstanding."""
    bill = _get_bill_or_404(db, bill_id)
    as_of = as_of or date.today()

    paid = crud.get_paid_total_for_bill(db, bill_id)
    breakdown = compute_late_fee(bill, paid, resolve_late_fee_rules(db), as_of)

    subtotal = _money(
        Decimal(str(bill.maintenance or 0))
        + Decimal(str(bill.water or 0))
        + Decimal(str(bill.parking or 0))
        + Decimal(str(bill.miscellaneous or 0))
        - Decimal(str(bill.discount or 0))
    )

    resident = crud.get_resident_with_flat(db, bill.resident_id)

    return BillStatement(
        bill_id=bill.bill_id,
        resident_id=bill.resident_id,
        resident_name=resident.name if resident else None,
        flat_number=resident.flat.flat_number if resident and resident.flat else None,
        billing_month=bill.billing_month,
        due_date=bill.due_date,
        status=bill.status,
        line_items=BillLineItems(
            maintenance=_money(Decimal(str(bill.maintenance or 0))),
            water=_money(Decimal(str(bill.water or 0))),
            parking=_money(Decimal(str(bill.parking or 0))),
            miscellaneous=_money(Decimal(str(bill.miscellaneous or 0))),
            discount=_money(Decimal(str(bill.discount or 0))),
            taxable_subtotal=max(subtotal, Decimal("0.00")),
            gst=_money(Decimal(str(bill.gst or 0))),
            total_amount=_money(Decimal(str(bill.total_amount))),
        ),
        amount_paid=_money(paid),
        late_fee=breakdown.late_fee,
        late_fee_accrued_till=bill.late_fee_accrued_till,
        outstanding=breakdown.total_payable,
        late_fee_breakdown=breakdown,
        payments=[PaymentOut.model_validate(p) for p in bill.payments],
    )


def list_resident_bills(
    db: Session,
    resident_id: str,
    status_filter: str | None = None,
    billing_month: str | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
    unpaid_only: bool = False,
    skip: int = 0,
    limit: int = 20,
) -> BillHistoryPage:
    """
    A resident's bills, filtered and paginated, each row carrying the live
    late fee and what is still outstanding.
    """
    total, bills = crud.filter_bills_by_resident(
        db,
        resident_id,
        status=status_filter,
        billing_month=billing_month,
        due_from=due_from,
        due_to=due_to,
        unpaid_only=unpaid_only,
        skip=skip,
        limit=limit,
    )

    rules = resolve_late_fee_rules(db)
    as_of = date.today()
    paid_by_bill = crud.get_paid_totals_for_bills(db, [b.bill_id for b in bills])

    items: list[BillWithLateFee] = []
    outstanding_total = Decimal("0")

    for bill in bills:
        paid = paid_by_bill.get(bill.bill_id, Decimal("0"))
        breakdown = compute_late_fee(bill, paid, rules, as_of)
        outstanding_total += breakdown.total_payable
        items.append(
            BillWithLateFee(
                bill_id=bill.bill_id,
                bill_no=bill.bill_no,
                resident_id=bill.resident_id,
                billing_month=bill.billing_month,
                total_amount=_money(Decimal(str(bill.total_amount))),
                late_fee=breakdown.late_fee,
                amount_paid=_money(paid),
                outstanding=breakdown.total_payable,
                due_date=bill.due_date,
                days_overdue=breakdown.days_overdue,
                status=bill.status,
            )
        )

    return BillHistoryPage(
        total=total,
        total_outstanding=_money(outstanding_total),
        items=items,
    )


def get_outstanding_total(db: Session, resident_id: str) -> Decimal:
    """
    Late-fee-aware sum of everything a resident still owes, across all bills.

    Reuses the same computation list_resident_bills() (BE-28) already does,
    rather than a naive sum of unpaid total_amount, so a caller gating a
    move-out (EN-22) on "outstanding dues" sees the real balance including
    accrued late fees and partial payments already made - not an
    over/understated figure.
    """
    _, bills = crud.filter_bills_by_resident(db, resident_id, unpaid_only=True, limit=10_000)
    if not bills:
        return Decimal("0")

    rules = resolve_late_fee_rules(db)
    as_of = date.today()
    paid_by_bill = crud.get_paid_totals_for_bills(db, [b.bill_id for b in bills])

    total = Decimal("0")
    for bill in bills:
        paid = paid_by_bill.get(bill.bill_id, Decimal("0"))
        breakdown = compute_late_fee(bill, paid, rules, as_of)
        total += breakdown.total_payable
    return _money(total)


# ── Receipt generation ────────────────────────────────────────────────────────

def get_receipt(db: Session, payment_id: str) -> Receipt:
    """
    Generate the receipt for a successful payment.

    A receipt is only issued for a `paid` payment - a failed or cancelled
    attempt is kept for audit but must not produce a document that implies
    money changed hands, so those return 409.

    `balance_after_payment` is the balance as it stood immediately after this
    payment, not as it stands today. A receipt is a record of a moment, so
    re-fetching it next month must return the same figures.
    """
    payment = _get_payment_or_404(db, payment_id)

    if payment.status != "paid":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Payment '{payment_id}' has status '{payment.status}' - a receipt "
                "is only issued for a successful payment."
            ),
        )

    bill = _get_bill_or_404(db, payment.bill_id)
    resident = crud.get_resident_with_flat(db, payment.resident_id)

    paid_at_that_point = crud.get_paid_total_for_bill(db, bill.bill_id, upto=payment.paid_on)
    late_fee = _money(Decimal(str(bill.late_fee or 0)))
    balance = _money(
        max(
            Decimal(str(bill.total_amount)) + late_fee - paid_at_that_point,
            Decimal("0"),
        )
    )

    society_name = _config_value(db, "society_name") or DEFAULT_SOCIETY_NAME
    contact = _config_value(db, "emergency_contact_number")

    return Receipt(
        receipt_no=payment.receipt_no,
        issued_at=payment.paid_on or datetime.now(timezone.utc).replace(tzinfo=None),
        society=ReceiptSociety(name=society_name, contact_number=contact),
        payer=ReceiptPayer(
            resident_id=payment.resident_id,
            name=resident.name if resident else None,
            flat_number=resident.flat.flat_number if resident and resident.flat else None,
        ),
        bill=ReceiptBill(
            bill_id=bill.bill_id,
            billing_month=bill.billing_month,
            due_date=bill.due_date,
            total_amount=_money(Decimal(str(bill.total_amount))),
            late_fee=late_fee,
        ),
        payment_id=payment.payment_id,
        amount_paid=_money(Decimal(str(payment.amount_paid))),
        payment_method=payment.payment_method,
        paid_on=payment.paid_on,
        transaction_ref=payment.transaction_ref,
        status=payment.status,
        balance_after_payment=balance,
        gateway_message=payment.gateway_message,
    )


# ── Filterable payment history ────────────────────────────────────────────────

def list_payment_history(
    db: Session,
    filters: PaymentHistoryFilters,
    skip: int = 0,
    limit: int = 20,
) -> PaymentHistoryPage:
    """
    Filterable, paginated payment history.

    `total` and `total_amount` describe the whole filtered set, not the page,
    so a resident on page 1 still sees what they have paid overall.
    """
    total, settled_amount, payments = crud.filter_payments(
        db,
        resident_id=filters.resident_id,
        bill_id=filters.bill_id,
        payment_method=filters.payment_method.value if filters.payment_method else None,
        status=filters.status.value if filters.status else None,
        date_from=filters.date_from,
        date_to=filters.date_to,
        min_amount=filters.min_amount,
        max_amount=filters.max_amount,
        sort=filters.sort.value,
        skip=skip,
        limit=limit,
    )

    return PaymentHistoryPage(
        total=total,
        total_amount=_money(settled_amount),
        filters=filters,
        items=[PaymentOut.model_validate(p) for p in payments],
    )
