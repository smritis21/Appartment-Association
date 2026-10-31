"""
FastAPI router for the Visitors module (BE-05, BE-25).

Literal paths (/passes, /passes/verify) are declared before /{visitor_id}
so they are not swallowed by the path parameter.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.visitor import (
    VisitorCreate,
    VisitorDecisionRequest,
    VisitorOut,
    VisitorPassCreate,
    VisitorPassVerifyRequest,
)
from app.services import visitor_service as service

router = APIRouter(prefix="/visitors", tags=["Visitors"])


@router.post(
    "",
    response_model=VisitorOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a visitor entry",
    description=(
        "Logs a visitor arriving at the gate and raises an approval request for "
        "the resident of the given flat.\n\n"
        "The record is created with `status = \"pending\"` so it appears in the "
        "resident's approval queue, where it is resolved through "
        "`POST /visitors/{visitor_id}/decision`. When `resident_id` is supplied "
        "it must reference an existing resident."
    ),
    responses={
        201: {"description": "Visitor entry logged"},
        404: {"description": "Resident not found"},
        422: {"description": "Validation error"},
    },
)
def log_visitor_entry(data: VisitorCreate, db: Session = Depends(get_db)):
    return service.create_visitor(db, data)


@router.post(
    "/passes",
    response_model=VisitorOut,
    status_code=status.HTTP_201_CREATED,
    summary="Issue a visitor pass",
    description=(
        "Issues a pre-authorised visitor pass on behalf of a resident (BE-25). "
        "The record is created already `approved` with a unique, single-use "
        "`pass_code` valid for the given window. It is redeemed at the gate "
        "through `POST /visitors/passes/verify`."
    ),
    responses={
        201: {"description": "Pass issued"},
        400: {"description": "valid_until is not after valid_from"},
        404: {"description": "Resident not found"},
        422: {"description": "Validation error"},
    },
)
def issue_pass(data: VisitorPassCreate, db: Session = Depends(get_db)):
    return service.issue_pass(db, data)


@router.get(
    "/passes/{pass_code}",
    response_model=VisitorOut,
    summary="Look up a visitor pass by code (read-only)",
    description=(
        "Returns pass details for the gate desk to preview before deciding "
        "whether to approve entry. Unlike POST /visitors/passes/verify, this "
        "does not stamp entry_time or consume the pass's single use."
    ),
    responses={404: {"description": "No pass found with this code"}},
)
def get_pass(pass_code: str, db: Session = Depends(get_db)):
    return service.get_pass_by_code(db, pass_code)


@router.post(
    "/passes/verify",
    response_model=VisitorOut,
    summary="Verify a visitor pass at the gate",
    description=(
        "Redeems a pass code at the gate and stamps `entry_time` (BE-25). "
        "A pass is single-use: verifying it a second time returns 409. "
        "Verifying outside the pass's [valid_from, valid_until] window "
        "returns 400."
    ),
    responses={
        200: {"description": "Pass verified and entry logged"},
        400: {"description": "Pass is not yet valid or has expired"},
        404: {"description": "No pass found with this code"},
        409: {"description": "Pass has already been used"},
    },
)
def verify_pass(data: VisitorPassVerifyRequest, db: Session = Depends(get_db)):
    return service.verify_pass(db, data)


@router.put(
    "/{visitor_id}/exit",
    response_model=VisitorOut,
    summary="Log a visitor's exit",
    description=(
        "Stamps `exit_time` for a visitor who has already been logged in "
        "(BE-25). Requires a prior entry; a second exit call returns 409."
    ),
    responses={
        200: {"description": "Exit logged"},
        400: {"description": "No entry has been logged for this visitor yet"},
        404: {"description": "Visitor request not found"},
        409: {"description": "Exit has already been logged"},
    },
)
def log_exit(visitor_id: str, db: Session = Depends(get_db)):
    return service.log_exit(db, visitor_id)


@router.get(
    "",
    response_model=list[VisitorOut],
    summary="List / search visitor history",
    description=(
        "Returns visitor requests newest-first (BE-05 / BE-25). Pass "
        "`resident_id` to scope the list to a single resident's flat - this "
        "is what the resident-facing approval queue uses. `status`, "
        "`purpose`, `gate`, `date_from` and `date_to` narrow the general "
        "filterable history view."
    ),
)
def list_visitors(
    resident_id: str | None = Query(
        None, description="Only return requests raised for this resident"
    ),
    status_filter: str | None = Query(
        None, alias="status", description="pending / approved / rejected / left_at_gate / expired"
    ),
    purpose: str | None = Query(None, description="e.g. Delivery, Guest Visit"),
    gate: str | None = Query(None, description="e.g. Main Gate"),
    date_from: datetime | None = Query(None, description="Only requests raised on/after this timestamp"),
    date_to: datetime | None = Query(None, description="Only requests raised on/before this timestamp"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db),
):
    return service.list_visitors(
        db,
        resident_id=resident_id,
        status_filter=status_filter,
        purpose=purpose,
        gate=gate,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/{visitor_id}",
    response_model=VisitorOut,
    summary="Get a visitor request",
    responses={404: {"description": "Visitor request not found"}},
)
def get_visitor(visitor_id: str, db: Session = Depends(get_db)):
    return service.get_visitor(db, visitor_id)


@router.post(
    "/{visitor_id}/decision",
    response_model=VisitorOut,
    summary="Record a resident's decision on a visitor request",
    description=(
        "Records an `approved`, `rejected` or `left_at_gate` decision against a "
        "pending visitor request, stamped with a UTC timestamp (`decided_at`).\n\n"
        "A decision is final: posting a second decision to the same request "
        "returns 409. `left_at_gate` is only accepted for delivery requests, and "
        "for it the response also carries the guard who took the parcel "
        "(`collected_by`) and where to collect it (`pickup_location`)."
    ),
    responses={
        200: {"description": "Decision recorded successfully"},
        400: {"description": "Request has expired, or left_at_gate used on a non-delivery"},
        404: {"description": "Visitor request not found"},
        409: {"description": "A decision has already been recorded for this request"},
        422: {"description": "Validation error - decision value not allowed"},
    },
)
def record_decision(
    visitor_id: str,
    data: VisitorDecisionRequest,
    db: Session = Depends(get_db),
):
    return service.record_decision(db, visitor_id, data)
