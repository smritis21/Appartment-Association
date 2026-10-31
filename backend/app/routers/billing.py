"""
FastAPI router for the Resident Billing API (BE-28).

Kept in its own router (rather than added to routers/payments.py) so BE-11's
write path stays untouched. Every path here is at least one segment deeper
than an existing route, so registration order in main.py does not matter,
and `/bills/late-fee/accrue` cannot shadow `/bills/{bill_id}/late-fee/accrue`.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.billing import (
    BillHistoryPage,
    BillStatement,
    LateFeeAccrualOut,
    LateFeeAccrualSummary,
    LateFeeBreakdown,
    PaymentHistoryFilters,
    PaymentHistoryPage,
    PaymentHistorySort,
    Receipt,
)
from app.schemas.payment import PaymentMethod, PaymentStatus
from app.services import billing_service as service

router = APIRouter(tags=["Payments & Billing"])


# ── Shared query dependency ───────────────────────────────────────────────────

def payment_history_filters(
    bill_id:        str | None            = Query(None, description="Only payments against this bill"),
    payment_method: PaymentMethod | None  = Query(None, description="Filter by method: upi / online_transfer / cheque / cash"),
    status_filter:  PaymentStatus | None  = Query(None, alias="status",
                                                  description="Filter by status: pending / paid / failed / cancelled / refunded"),
    date_from:      date | None           = Query(None, description="Payments made on or after this date (inclusive)"),
    date_to:        date | None           = Query(None, description="Payments made on or before this date (inclusive)"),
    min_amount:     float | None          = Query(None, ge=0, description="Minimum amount paid"),
    max_amount:     float | None          = Query(None, ge=0, description="Maximum amount paid"),
    sort:           PaymentHistorySort    = Query(PaymentHistorySort.paid_on_desc, description="Sort order"),
) -> PaymentHistoryFilters:
    """
    Collect the history filters once so the resident-scoped and society-wide
    endpoints cannot drift apart.

    Cross-field checks (date_from <= date_to, min_amount <= max_amount) live on
    the schema. A ValidationError raised inside a dependency is not converted by
    FastAPI, so it is caught here and re-raised as a 422 - the same status the
    client would get for any other bad query parameter.
    """
    try:
        return PaymentHistoryFilters(
            bill_id=bill_id,
            payment_method=payment_method,
            status=status_filter,
            date_from=date_from,
            date_to=date_to,
            min_amount=min_amount,
            max_amount=max_amount,
            sort=sort,
        )
    except ValidationError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=[err["msg"] for err in exc.errors()],
        )


# ── Bills ─────────────────────────────────────────────────────────────────────

@router.get(
    "/residents/{resident_id}/bills",
    response_model=BillHistoryPage,
    summary="List a resident's bills",
    description=(
        "Returns the resident's bills, newest due date first, each row carrying "
        "the **live** late fee and what is still outstanding. "
        "Filter by `status`, `billing_month`, a `due_from`/`due_to` range, or set "
        "`unpaid_only=true` for just the bills that still have money owed on them.\n\n"
        "`total` counts every bill matching the filters; `total_outstanding` sums "
        "only the rows on this page, since the late fee inside it is derived on "
        "read rather than stored."
    ),
)
def list_resident_bills(
    resident_id:   str,
    status_filter: str | None  = Query(None, alias="status",
                                       description="Filter by status: pending / paid / overdue / partially_paid"),
    billing_month: str | None  = Query(None, pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
                                       description="Exact billing month, YYYY-MM"),
    due_from:      date | None = Query(None, description="Bills due on or after this date"),
    due_to:        date | None = Query(None, description="Bills due on or before this date"),
    unpaid_only:   bool        = Query(False, description="Only bills that are pending / overdue / partially paid"),
    skip:          int         = Query(0,  ge=0,        description="Records to skip"),
    limit:         int         = Query(20, ge=1, le=100, description="Max records to return"),
    db:            Session     = Depends(get_db),
):
    return service.list_resident_bills(
        db,
        resident_id,
        status_filter=status_filter,
        billing_month=billing_month,
        due_from=due_from,
        due_to=due_to,
        unpaid_only=unpaid_only,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/bills/{bill_id}/statement",
    response_model=BillStatement,
    summary="Serve a bill statement",
    description=(
        "Serves one bill in full: the charge line items with their taxable subtotal "
        "and GST, every payment received against it, the live late fee with its full "
        "breakdown, and the outstanding balance. "
        "`late_fee` is recomputed on every read; `late_fee_accrued_till` tells you "
        "the date the last **persisted** snapshot was calculated up to."
    ),
    responses={404: {"description": "Bill not found"}},
)
def get_bill_statement(
    bill_id: str,
    as_of:   date | None = Query(None, description="Compute the late fee as of this date (defaults to today)"),
    db:      Session     = Depends(get_db),
):
    return service.get_bill_statement(db, bill_id, as_of=as_of)


# ── Late fees ─────────────────────────────────────────────────────────────────

@router.get(
    "/bills/{bill_id}/late-fee",
    response_model=LateFeeBreakdown,
    summary="Late-fee breakdown for a bill",
    description=(
        "Returns every figure behind the late fee so the amount can be explained "
        "line by line - days overdue, grace period consumed, chargeable days, the "
        "rate and proration basis in force, the principal the fee is charged on, "
        "the cap, and whether the cap bit.\n\n"
        "**Read-only** - nothing is written. `as_of` may be a future date, which is "
        "how a resident can ask what they will owe if they pay later.\n\n"
        "Rules come from `apartment_config` (BE-40): `late_fee_grace_days`, "
        "`late_fee_rate_percent`, `late_fee_max_percent`, `late_fee_proration`."
    ),
    responses={404: {"description": "Bill not found"}},
)
def get_late_fee(
    bill_id: str,
    as_of:   date | None = Query(None, description="Compute as of this date (defaults to today)"),
    db:      Session     = Depends(get_db),
):
    return service.get_late_fee(db, bill_id, as_of=as_of)


@router.post(
    "/bills/late-fee/accrue",
    response_model=LateFeeAccrualSummary,
    summary="Accrue late fees on all outstanding bills",
    description=(
        "Recomputes and persists the late-fee snapshot for every bill that is "
        "pending, overdue or partially paid. Bills still marked `pending` that are "
        "past their grace period are moved to `overdue`.\n\n"
        "Idempotent - running it twice on the same date reports `bills_updated: 0` "
        "the second time. This is the endpoint a nightly job should call."
    ),
)
def accrue_late_fees(
    as_of: date | None = Query(None, description="Accrue as of this date (defaults to today)"),
    db:    Session     = Depends(get_db),
):
    return service.accrue_late_fees(db, as_of=as_of)


@router.post(
    "/bills/{bill_id}/late-fee/accrue",
    response_model=LateFeeAccrualOut,
    summary="Accrue the late fee on one bill",
    description=(
        "Computes the late fee for a single bill and persists it, along with the "
        "grace period and rate that were in force at the time. Storing the rules "
        "used means a later change to `apartment_config` never retroactively "
        "rewrites a fee a resident has already been shown."
    ),
    responses={
        404: {"description": "Bill not found"},
        409: {"description": "Bill is already paid in full - nothing can accrue"},
    },
)
def accrue_late_fee(
    bill_id: str,
    as_of:   date | None = Query(None, description="Accrue as of this date (defaults to today)"),
    db:      Session     = Depends(get_db),
):
    return service.accrue_late_fee(db, bill_id, as_of=as_of)


# ── Receipts ──────────────────────────────────────────────────────────────────

@router.get(
    "/payments/{payment_id}/receipt",
    response_model=Receipt,
    summary="Serve a payment receipt",
    description=(
        "Generates the receipt for a successful payment - issuer, payer, the bill "
        "it settles, the amount, and the balance as it stood **immediately after** "
        "that payment. A receipt records a moment, so re-fetching it later returns "
        "the same figures.\n\n"
        "Only `paid` payments produce a receipt. A failed or cancelled attempt is "
        "kept for audit but returns 409 rather than a document implying money "
        "changed hands."
    ),
    responses={
        404: {"description": "Payment not found"},
        409: {"description": "Payment was not successful - no receipt is issued"},
    },
)
def get_receipt(payment_id: str, db: Session = Depends(get_db)):
    return service.get_receipt(db, payment_id)


# ── Payment history ───────────────────────────────────────────────────────────

@router.get(
    "/residents/{resident_id}/payments",
    response_model=PaymentHistoryPage,
    summary="Filterable payment history for a resident",
    description=(
        "The resident-facing payment history. Filter by bill, method, status, a "
        "`date_from`/`date_to` range and a `min_amount`/`max_amount` range, and sort "
        "by date or amount.\n\n"
        "`total_amount` counts only successful (`paid`) rows, so a history that "
        "includes a failed attempt does not overstate what the resident has paid."
    ),
    responses={422: {"description": "Invalid filter range (date_from > date_to, or min_amount > max_amount)"}},
)
def list_resident_payment_history(
    resident_id: str,
    filters: PaymentHistoryFilters = Depends(payment_history_filters),
    skip:    int     = Query(0,  ge=0,        description="Records to skip"),
    limit:   int     = Query(20, ge=1, le=100, description="Max records to return"),
    db:      Session = Depends(get_db),
):
    filters.resident_id = resident_id
    return service.list_payment_history(db, filters, skip=skip, limit=limit)


@router.get(
    "/billing/payments",
    response_model=PaymentHistoryPage,
    summary="Filterable payment history (society-wide)",
    description=(
        "The same filterable history as the resident endpoint, but across every "
        "resident - the management view. Pass `resident_id` to narrow it down."
    ),
    responses={422: {"description": "Invalid filter range (date_from > date_to, or min_amount > max_amount)"}},
)
def list_payment_history(
    resident_id: str | None = Query(None, description="Filter by resident UUID"),
    filters: PaymentHistoryFilters = Depends(payment_history_filters),
    skip:    int     = Query(0,  ge=0,        description="Records to skip"),
    limit:   int     = Query(20, ge=1, le=100, description="Max records to return"),
    db:      Session = Depends(get_db),
):
    filters.resident_id = resident_id
    return service.list_payment_history(db, filters, skip=skip, limit=limit)
