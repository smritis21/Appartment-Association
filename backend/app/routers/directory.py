"""
FastAPI router for the Directory module (BE-23).

Every endpoint requires a valid Bearer token. Phone masking and
emergency-contact visibility are enforced in the service layer.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db
from app.schemas.directory import DirectoryFlatOut, DirectoryOverview, DirectorySearchResult
from app.schemas.resident import EmergencyContactOut, FamilyMemberOut, ResidentOut, ResidentSummary
from app.services import directory_service as service

router = APIRouter(prefix="/directory", tags=["Directory"])


@router.get(
    "",
    response_model=DirectoryOverview,
    summary="Directory overview",
    description="Returns flat counts, resident counts, and the list of blocks in the society.",
)
def get_overview(
    db: Session = Depends(get_db),
    _: object = Depends(get_current_user),
):
    return service.get_overview(db)


@router.get(
    "/residents",
    response_model=list[ResidentSummary],
    summary="List residents",
    description=(
        "Paginated resident list. Filter by `status`, `block`, or `resident_type` "
        "(owner / tenant). Phone numbers are masked for non-management roles "
        "viewing other residents."
    ),
)
def list_residents(
    skip:          int         = Query(0,    ge=0,         description="Records to skip"),
    limit:         int         = Query(20,   ge=1, le=100, description="Max records to return"),
    status:        str | None  = Query(None, description="Filter by status: active / inactive / moved_out"),
    block:         str | None  = Query(None, description="Filter by block/wing, e.g. 'A'"),
    resident_type: str | None  = Query(None, description="Filter by type: owner / tenant"),
    db:            Session     = Depends(get_db),
    current_user:  object      = Depends(get_current_user),
):
    return service.list_residents(
        db, current_user,
        skip=skip, limit=limit,
        status_filter=status, block=block, resident_type=resident_type,
    )


@router.get(
    "/residents/{resident_id}",
    response_model=ResidentOut,
    summary="Get resident profile",
    description=(
        "Returns full resident profile including flat, family members, and emergency contacts. "
        "Phone and emergency contacts are masked/hidden for non-management roles "
        "viewing other residents."
    ),
    responses={404: {"description": "Resident not found"}},
)
def get_resident(
    resident_id:  str,
    db:           Session = Depends(get_db),
    current_user: object  = Depends(get_current_user),
):
    return service.get_resident(db, resident_id, current_user)


@router.get(
    "/flats",
    response_model=list[DirectoryFlatOut],
    summary="List flats",
    description=(
        "Paginated flat list with optional filters for block, ownership type, "
        "and occupancy status. Each flat includes its active residents."
    ),
)
def list_flats(
    skip:             int        = Query(0,    ge=0,         description="Records to skip"),
    limit:            int        = Query(20,   ge=1, le=100, description="Max records to return"),
    block:            str | None = Query(None, description="Filter by block/wing"),
    ownership_type:   str | None = Query(None, description="Filter by ownership: owned / rented"),
    occupancy_status: str | None = Query(None, description="Filter by occupancy: occupied / vacant"),
    db:               Session    = Depends(get_db),
    current_user:     object     = Depends(get_current_user),
):
    return service.list_flats(
        db, current_user,
        skip=skip, limit=limit,
        block=block, ownership_type=ownership_type, occupancy_status=occupancy_status,
    )


@router.get(
    "/flats/{flat_id}",
    response_model=DirectoryFlatOut,
    summary="Get flat detail",
    description="Returns flat details including all active residents.",
    responses={404: {"description": "Flat not found"}},
)
def get_flat(
    flat_id:      str,
    db:           Session = Depends(get_db),
    current_user: object  = Depends(get_current_user),
):
    return service.get_flat(db, flat_id, current_user)


@router.get(
    "/household/{resident_id}",
    response_model=list[FamilyMemberOut],
    summary="Get household members",
    description="Returns the family members registered under a resident.",
    responses={404: {"description": "Resident not found"}},
)
def get_household(
    resident_id: str,
    db:          Session = Depends(get_db),
    _:           object  = Depends(get_current_user),
):
    return service.get_household(db, resident_id)


@router.get(
    "/emergency-contacts/{resident_id}",
    response_model=list[EmergencyContactOut],
    summary="Get emergency contacts",
    description=(
        "Returns emergency contacts for a resident. "
        "Only accessible by the resident themselves or management roles "
        "(admin, president, secretary)."
    ),
    responses={
        403: {"description": "Insufficient permissions"},
        404: {"description": "Resident not found"},
    },
)
def get_emergency_contacts(
    resident_id:  str,
    db:           Session = Depends(get_db),
    current_user: object  = Depends(get_current_user),
):
    return service.get_emergency_contacts(db, resident_id, current_user)


@router.get(
    "/search",
    response_model=DirectorySearchResult,
    summary="Search directory",
    description=(
        "Searches residents (by name/phone) and flats (by block/flat number) "
        "in a single call. Minimum 2 characters required."
    ),
    responses={422: {"description": "Query too short"}},
)
def search(
    q:            str    = Query(..., min_length=2, description="Search term"),
    limit:        int    = Query(20, ge=1, le=100,  description="Max results per category"),
    db:           Session = Depends(get_db),
    current_user: object  = Depends(get_current_user),
):
    return service.search(db, current_user, q=q, limit=limit)
