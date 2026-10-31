"""FastAPI router for the Payments & Billing module (BE-11)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user_optional, get_db
from app.schemas.payment import (
    BillCreate,
    BillOut,
    BillSummary,
    PaymentCreate,
    PaymentOut,
    PaymentReceipt,
)
from app.services import payment_service as service

router = APIRouter(tags=["Payments & Billing"])


# ── Bills ─────────────────────────────────────────────────────────────────────

@router.post(
    "/bills",
    response_model=BillOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a bill",
    description=(
        "Generates a maintenance bill for a resident. "
        "GST (18%) is automatically calculated on the taxable subtotal "
        "(maintenance + water + parking + miscellaneous − discount). "
        "The referenced `resident_id` must already exist."
    ),
    responses={
        201: {"description": "Bill created successfully"},
        404: {"description": "Resident not found"},
        422: {"description": "Validation error"},
    },
)
def create_bill(
    data: BillCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    return service.create_bill(
        db,
        data,
        actor_id=current_user.user_id if current_user else None,
        actor_role=current_user.role if current_user else None,
    )


@router.get(
    "/bills",
    response_model=list[BillSummary],
    summary="List bills",
    description=(
        "Returns a paginated list of bills. "
        "Filter by `resident_id` to get bills for a specific resident, "
        "or by `status` to get pending/paid/overdue bills."
    ),
)
def list_bills(
    resident_id: str | None = Query(None, description="Filter by resident UUID"),
    status_filter: str | None = Query(None, alias="status",
                                      description="Filter by status: pending / paid / overdue / partially_paid"),
    skip:  int = Query(0,  ge=0,        description="Records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Max records to return"),
    db:    Session = Depends(get_db),
):
    return service.list_bills(
        db,
        resident_id=resident_id,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/bills/{bill_id}",
    response_model=BillOut,
    summary="Get bill detail",
    description="Returns full bill detail including line items, GST, total, and all associated payments.",
    responses={404: {"description": "Bill not found"}},
)
def get_bill(bill_id: str, db: Session = Depends(get_db)):
    return service.get_bill(db, bill_id)


# ── Payments ──────────────────────────────────────────────────────────────────

@router.post(
    "/payments",
    response_model=PaymentReceipt,
    status_code=status.HTTP_201_CREATED,
    summary="Process a payment",
    description=(
        "Processes a payment against an existing bill via the mock gateway. "
        "Returns a payment receipt with a unique `receipt_no` and `transaction_ref`. "
        "Set `gateway.simulate_failure = true` to test failure handling. "
        "**No real card or banking details are accepted or stored.**"
    ),
    responses={
        201: {"description": "Payment processed successfully - receipt returned"},
        400: {"description": "Bill already paid or overpayment attempted"},
        402: {"description": "Gateway declined the payment"},
        404: {"description": "Bill not found"},
        422: {"description": "Validation error"},
    },
)
def process_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    return service.process_payment(
        db,
        data,
        actor_id=current_user.user_id if current_user else None,
        actor_role=current_user.role if current_user else None,
    )


@router.get(
    "/payments/resident/{resident_id}",
    response_model=list[PaymentOut],
    summary="Payment history for a resident",
    description="Returns all payments made by a resident, ordered by most recent first.",
    responses={200: {"description": "Payment history"}},
)
def list_payments_by_resident(
    resident_id: str,
    skip:  int = Query(0,  ge=0,        description="Records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Max records to return"),
    db:    Session = Depends(get_db),
):
    return service.list_payments_by_resident(db, resident_id, skip=skip, limit=limit)


@router.get(
    "/payments/{payment_id}",
    response_model=PaymentOut,
    summary="Get payment / receipt",
    description="Returns a single payment record including receipt number and gateway response.",
    responses={404: {"description": "Payment not found"}},
)
def get_payment(payment_id: str, db: Session = Depends(get_db)):
    return service.get_payment(db, payment_id)
