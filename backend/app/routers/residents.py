"""
FastAPI router for the Residents module (BE-18).

Every endpoint requires a valid Bearer token; write endpoints additionally
require the admin, president, or secretary role.
"""

from math import ceil

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_roles
from app.schemas.resident import (
    FlatCreate,
    FlatOut,
    ResidentCreate,
    ResidentOut,
    ResidentSummary,
    ResidentUpdate,
)
from app.schemas.complaint import ComplaintOut
from app.services import resident_service as service

router = APIRouter(prefix="/residents", tags=["Residents"])


@router.post(
    "/flats",
    response_model=FlatOut,
    status_code=status.HTTP_200_OK,
    summary="Find or create a flat",
    description=(
        "Resolves a flat by (block, flat_number), creating it if it doesn't "
        "already exist. Idempotent - calling it twice for the same "
        "block/flat_number returns the same flat. Use this to obtain a "
        "flat_id before POST /residents, which requires one to already exist."
    ),
    responses={
        200: {"description": "Existing or newly created flat returned"},
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient role"},
    },
)
def find_or_create_flat(
    data: FlatCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_roles("admin", "president", "secretary")),
):
    return service.find_or_create_flat(db, data)


@router.get(
    "",
    response_model=list[ResidentSummary],
    summary="List all residents",
    description=(
        "Returns a paginated list of residents. "
        "Optionally filter by status: `active`, `inactive`, or `moved_out`."
    ),
    responses={401: {"description": "Authentication required"}},
)
def list_residents(
    skip:   int         = Query(0,  ge=0,        description="Number of records to skip"),
    limit:  int         = Query(20, ge=1, le=100, description="Max records to return (capped at 100)"),
    status: str | None  = Query(None, description="Filter by status: active / inactive / moved_out"),
    db:     Session     = Depends(get_db),
    _:      object      = Depends(get_current_user),
):
    return service.list_residents(db, skip=skip, limit=limit, status_filter=status)


@router.get(
    "/search",
    response_model=list[ResidentSummary],
    summary="Search residents",
    description="Case-insensitive search across resident name and phone number.",
    responses={401: {"description": "Authentication required"}},
)
def search_residents(
    q:     str     = Query(..., min_length=2, description="Search term (name or phone)"),
    limit: int     = Query(20, ge=1, le=100, description="Max records to return (capped at 100)"),
    db:    Session = Depends(get_db),
    _:     object  = Depends(get_current_user),
):
    return service.search_residents(db, query=q, limit=limit)


DEFAULT_HISTORY_PAGE_SIZE = 20


@router.get(
    "/{resident_id}/complaints",
    response_model=list[ComplaintOut],
    summary="Get resident complaint history",
    description=(
        "Returns the resident's complaint history, newest first (ties broken by "
        "complaint id so the order is stable across pages). Resolved and closed "
        "complaints remain accessible.\n\n"
        "By default the full history is returned. Pass `page` and/or `page_size` "
        "to page through a long history: the response is that page's slice, and "
        "the total, current page, page size, and page count are returned in the "
        "`X-Total-Count`, `X-Page`, `X-Page-Size`, and `X-Total-Pages` response "
        "headers. A page past the end is an empty list, not a 404."
    ),
    responses={
        200: {"description": "Complaint history (a page of it when paginated)"},
        404: {"description": "Resident not found"},
        422: {"description": "Invalid page or page_size"},
    },
)
def get_resident_complaints(
    resident_id: str,
    response: Response,
    page: int | None = Query(
        None, ge=1, description="1-based page number. Omit for the full history."
    ),
    page_size: int | None = Query(
        None, ge=1, le=100,
        description="Items per page (1–100). Defaults to 20 when only `page` is given.",
    ),
    db: Session = Depends(get_db),
):
    # No pagination params → unchanged contract: the full history in one array.
    if page is None and page_size is None:
        items = service.get_complaint_history(db, resident_id)
        response.headers["X-Total-Count"] = str(len(items))
        return items

    page = page or 1
    page_size = page_size or DEFAULT_HISTORY_PAGE_SIZE
    items, total = service.get_complaint_history_page(db, resident_id, page, page_size)

    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Page"] = str(page)
    response.headers["X-Page-Size"] = str(page_size)
    response.headers["X-Total-Pages"] = str(ceil(total / page_size) if total else 0)
    return items


@router.get(
    "/{resident_id}",
    response_model=ResidentOut,
    summary="Get resident by ID",
    description="Returns full resident profile including flat, family members, and emergency contacts.",
    responses={
        401: {"description": "Authentication required"},
        404: {"description": "Resident not found"},
    },
)
def get_resident(
    resident_id: str,
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    return service.get_resident(db, resident_id)


@router.post(
    "",
    response_model=ResidentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new resident",
    description=(
        "Creates a resident and optionally their family members and emergency contacts. "
        "The referenced `flat_id` must already exist."
    ),
    responses={
        201: {"description": "Resident created successfully"},
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient role"},
        404: {"description": "Flat not found"},
        422: {"description": "Validation error"},
    },
)
def create_resident(
    data: ResidentCreate,
    db: Session = Depends(get_db),
    _: object = Depends(require_roles("admin", "president", "secretary")),
):
    return service.create_resident(db, data)


@router.put(
    "/{resident_id}",
    response_model=ResidentOut,
    summary="Update a resident",
    description=(
        "Partially updates a resident record. Only fields provided in the request body are updated. "
        "Setting status to `moved_out` automatically records today as `move_out_date` if not provided."
    ),
    responses={
        200: {"description": "Resident updated successfully"},
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient role"},
        404: {"description": "Resident or flat not found"},
        422: {"description": "Validation error"},
    },
)
def update_resident(
    resident_id: str,
    data:        ResidentUpdate,
    db:          Session = Depends(get_db),
    _:           object  = Depends(require_roles("admin", "president", "secretary")),
):
    return service.update_resident(db, resident_id, data)


@router.delete(
    "/{resident_id}",
    status_code=status.HTTP_200_OK,
    summary="Deactivate a resident (soft delete)",
    description=(
        "Sets the resident's status to `inactive`. "
        "The record is retained for audit and billing history. "
        "This is a soft delete - the row is never permanently removed."
    ),
    responses={
        200: {"description": "Resident deactivated successfully"},
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient role"},
        404: {"description": "Resident not found"},
    },
)
def delete_resident(
    resident_id: str,
    db: Session = Depends(get_db),
    _: object = Depends(require_roles("admin", "president", "secretary")),
):
    return service.delete_resident(db, resident_id)
