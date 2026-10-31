"""Service layer for the Directory module (BE-23). Read-only - no commits.

Management roles (admin, president, secretary) see full phone numbers
and emergency contacts for all residents. Residents (owner, tenant) see
their own data in full; other residents' phone numbers are masked and
emergency contacts are hidden. All other roles (maintenance, security)
see masked phones, no contacts.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import residents as crud
from app.models.resident import Flat, Resident
from app.models.user import User
from app.schemas.directory import DirectoryFlatOut, DirectoryOverview, DirectorySearchResult
from app.schemas.resident import (
    EmergencyContactOut,
    FamilyMemberOut,
    FlatOut,
    ResidentOut,
    ResidentSummary,
)

# Roles that can see all phone numbers and emergency contacts
_MANAGEMENT_ROLES = {"admin", "president", "secretary"}


def _can_see_full(current_user: User, resident_id: str) -> bool:
    """True when the caller may see full contact details for this resident."""
    if current_user.role in _MANAGEMENT_ROLES:
        return True
    # Residents can see their own data in full
    return current_user.resident_id == resident_id


def _mask_phone(phone: str | None) -> str | None:
    """Replace all but the last 4 digits with asterisks."""
    if not phone:
        return phone
    visible = phone[-4:]
    return "*" * (len(phone) - 4) + visible


def _apply_phone_mask(summary: ResidentSummary, current_user: User) -> ResidentSummary:
    """Return a copy of ResidentSummary with phone masked if needed."""
    if _can_see_full(current_user, summary.resident_id):
        return summary
    return summary.model_copy(update={"phone": _mask_phone(summary.phone)})


def _get_resident_or_404(db: Session, resident_id: str) -> Resident:
    resident = crud.get_resident(db, resident_id)
    if not resident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{resident_id}' not found.",
        )
    return resident


def _get_flat_or_404(db: Session, flat_id: str) -> Flat:
    flat = crud.get_flat_with_residents(db, flat_id)
    if not flat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flat '{flat_id}' not found.",
        )
    return flat


def _flat_to_directory_out(flat: Flat, current_user: User) -> DirectoryFlatOut:
    active_residents = [r for r in flat.residents if r.status == "active"]
    resident_summaries = [
        _apply_phone_mask(ResidentSummary.model_validate(r), current_user)
        for r in active_residents
    ]
    flat_out = FlatOut.model_validate(flat)
    return DirectoryFlatOut(
        **flat_out.model_dump(),
        resident_count=len(resident_summaries),
        residents=resident_summaries,
    )


# ── Overview ──────────────────────────────────────────────────────────────────

def get_overview(db: Session) -> DirectoryOverview:
    occupied, total_flats = crud.get_occupancy_counts(db)
    status_counts = dict(crud.get_status_counts(db))
    total_residents = sum(status_counts.values())
    active_residents = status_counts.get("active", 0)
    blocks = crud.get_distinct_blocks(db)
    return DirectoryOverview(
        total_flats=total_flats,
        occupied_flats=occupied,
        vacant_flats=total_flats - occupied,
        total_residents=total_residents,
        active_residents=active_residents,
        blocks=blocks,
    )


# ── Residents list ────────────────────────────────────────────────────────────

def list_residents(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 20,
    status_filter: str | None = None,
    block: str | None = None,
    resident_type: str | None = None,
) -> list[ResidentSummary]:
    """block filters by flat.block; resident_type maps to
    flat.ownership_type (owner → owned, tenant → rented)."""
    ownership_type: str | None = None
    if resident_type == "owner":
        ownership_type = "owned"
    elif resident_type == "tenant":
        ownership_type = "rented"

    residents = crud.get_residents_filtered(
        db,
        skip=skip,
        limit=limit,
        status=status_filter,
        block=block,
        ownership_type=ownership_type,
    )
    return [
        _apply_phone_mask(ResidentSummary.model_validate(r), current_user)
        for r in residents
    ]


# ── Resident detail ───────────────────────────────────────────────────────────

def get_resident(db: Session, resident_id: str, current_user: User) -> ResidentOut:
    resident = _get_resident_or_404(db, resident_id)
    out = ResidentOut.model_validate(resident)
    if not _can_see_full(current_user, resident_id):
        out = out.model_copy(update={
            "phone": _mask_phone(out.phone),
            "emergency_contacts": [],
        })
    return out


# ── Household (family members) ────────────────────────────────────────────────

def get_household(db: Session, resident_id: str) -> list[FamilyMemberOut]:
    _get_resident_or_404(db, resident_id)
    members = crud.get_family_members(db, resident_id)
    return [FamilyMemberOut.model_validate(m) for m in members]


# ── Emergency contacts ────────────────────────────────────────────────────────

def get_emergency_contacts(
    db: Session, resident_id: str, current_user: User
) -> list[EmergencyContactOut]:
    _get_resident_or_404(db, resident_id)
    if not _can_see_full(current_user, resident_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Emergency contacts are only visible to the resident themselves or management.",
        )
    contacts = crud.get_emergency_contacts(db, resident_id)
    return [EmergencyContactOut.model_validate(c) for c in contacts]


# ── Flats list ────────────────────────────────────────────────────────────────

def list_flats(
    db: Session,
    current_user: User,
    skip: int = 0,
    limit: int = 20,
    block: str | None = None,
    ownership_type: str | None = None,
    occupancy_status: str | None = None,
) -> list[DirectoryFlatOut]:
    flats = crud.get_flats(
        db,
        skip=skip,
        limit=limit,
        block=block,
        ownership_type=ownership_type,
        occupancy_status=occupancy_status,
    )
    return [_flat_to_directory_out(f, current_user) for f in flats]


# ── Flat detail ───────────────────────────────────────────────────────────────

def get_flat(db: Session, flat_id: str, current_user: User) -> DirectoryFlatOut:
    flat = _get_flat_or_404(db, flat_id)
    return _flat_to_directory_out(flat, current_user)


# ── Search ────────────────────────────────────────────────────────────────────

def search(
    db: Session,
    current_user: User,
    q: str,
    limit: int = 20,
) -> DirectorySearchResult:
    residents = crud.search_residents(db, q, limit=limit)
    flats = crud.search_flats(db, q, limit=limit)

    resident_summaries = [
        _apply_phone_mask(ResidentSummary.model_validate(r), current_user)
        for r in residents
    ]
    flat_outs = [_flat_to_directory_out(f, current_user) for f in flats]

    return DirectorySearchResult(residents=resident_summaries, flats=flat_outs)
