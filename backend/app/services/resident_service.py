"""Service layer for the Residents module (BE-18)."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import complaints as complaint_crud
from app.crud import residents as crud
from app.models.resident import Resident
from app.schemas.complaint import ComplaintOut
from app.schemas.resident import (
    FlatCreate,
    FlatOut,
    ResidentCreate,
    ResidentOut,
    ResidentSummary,
    ResidentUpdate,
)
from app.services import billing_service, move_slot_service


def _get_resident_or_404(db: Session, resident_id: str) -> Resident:
    resident = crud.get_resident(db, resident_id)
    if not resident:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{resident_id}' not found.",
        )
    return resident


# ── Read ──────────────────────────────────────────────────────────────────────

def list_residents(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    status_filter: str | None = None,
) -> list[ResidentSummary]:
    residents = crud.get_residents(db, skip=skip, limit=limit, status=status_filter)
    return [ResidentSummary.model_validate(r) for r in residents]


def get_resident(db: Session, resident_id: str) -> ResidentOut:
    resident = _get_resident_or_404(db, resident_id)
    return ResidentOut.model_validate(resident)


def get_complaint_history(db: Session, resident_id: str) -> list[ComplaintOut]:
    """Return all complaints for a resident, newest first."""
    _get_resident_or_404(db, resident_id)
    complaints = complaint_crud.get_complaints_by_resident(db, resident_id)
    return [ComplaintOut.model_validate(complaint) for complaint in complaints]


def get_complaint_history_page(
    db: Session, resident_id: str, page: int, page_size: int
) -> tuple[list[ComplaintOut], int]:
    """
    One page of a resident's complaint history, plus the total count so the
    caller can build pagination metadata. 404s if the resident does not exist -
    same as the full-history read - so an unknown id is never silently an empty
    page.
    """
    _get_resident_or_404(db, resident_id)
    skip = (page - 1) * page_size
    total, complaints = complaint_crud.get_complaints_by_resident_page(
        db, resident_id, skip=skip, limit=page_size
    )
    return [ComplaintOut.model_validate(c) for c in complaints], total


def search_residents(db: Session, query: str, limit: int = 20) -> list[ResidentSummary]:
    if not query or len(query.strip()) < 2:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Search query must be at least 2 characters.",
        )
    residents = crud.search_residents(db, query.strip(), limit=limit)
    return [ResidentSummary.model_validate(r) for r in residents]


# ── Flats ─────────────────────────────────────────────────────────────────────

def find_or_create_flat(db: Session, data: FlatCreate) -> FlatOut:
    """
    Resolve a flat by (block, flat_number), creating it if it doesn't exist yet.

    residents.py has no other way to obtain a flat_id - POST /residents
    deliberately requires an existing flat (see create_resident below) - so
    this is the entry point UIs use to turn a free-text "Block/Flat No."
    input into a flat_id before creating a resident. Mirrors the find-or-create
    logic onboarding_service.approve() already does for approved applications.
    """
    flat = crud.get_flat_by_block_and_number(db, data.block, data.flat_number)
    if not flat:
        flat = crud.create_flat(db, data)
        db.commit()
        db.refresh(flat)
    elif data.ownership_type and data.ownership_type != flat.ownership_type:
        # Reconcile a stale/unset ownership_type on a reused flat to match
        # the new resident actually being added (e.g. a flat left with
        # ownership_type=None after a previous resident moved out, or a
        # flat changing hands from rented to owned or vice versa) - mirrors
        # the same reconciliation onboarding_service.approve() does.
        flat.ownership_type = data.ownership_type
        db.commit()
        db.refresh(flat)
    return FlatOut.model_validate(flat)


# ── Create ────────────────────────────────────────────────────────────────────

def create_resident(db: Session, data: ResidentCreate) -> ResidentOut:
    # Flat must exist before a resident can be assigned to it
    flat = crud.get_flat(db, data.flat_id)
    if not flat:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Flat '{data.flat_id}' not found. Create the flat first.",
        )

    # Same phone number, same flat, both active -> almost certainly the same
    # person being added twice, not two different residents sharing a flat.
    if data.phone and crud.get_active_resident_by_flat_and_phone(db, data.flat_id, data.phone):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"An active resident with phone '{data.phone}' already exists "
                f"at this flat."
            ),
        )

    resident = crud.create_resident(db, data)

    # Mark flat as occupied when an active resident is added
    if data.status == "active":
        flat.occupancy_status = "occupied"

    db.commit()
    db.refresh(resident)
    return ResidentOut.model_validate(resident)


# ── Update ────────────────────────────────────────────────────────────────────

def update_resident(
    db: Session, resident_id: str, data: ResidentUpdate
) -> ResidentOut:
    resident = _get_resident_or_404(db, resident_id)

    # If flat_id is being changed, verify the new flat exists
    if data.flat_id and data.flat_id != resident.flat_id:
        new_flat = crud.get_flat(db, data.flat_id)
        if not new_flat:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Flat '{data.flat_id}' not found.",
            )

    is_new_move_out = data.status == "moved_out" and not resident.move_out_date

    # A resident carrying outstanding dues (including accrued late fees)
    # cannot be moved out.
    if is_new_move_out:
        outstanding = billing_service.get_outstanding_total(db, resident_id)
        if outstanding > 0:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Cannot move out: outstanding dues of ₹{outstanding} "
                    "must be cleared first."
                ),
            )

    crud.update_resident(db, resident, data)

    # If status changed to moved_out, set move_out occupancy logic
    if is_new_move_out:
        from datetime import date
        resident.move_out_date = date.today()

        # Optional move-out slot booking - reserves the shared moving
        # resource for the resident's block; aborts the whole request
        # atomically on a conflicting booking.
        if data.move_slot_date and data.move_slot_start and data.move_slot_end:
            flat_for_slot = resident.flat or crud.get_flat(db, resident.flat_id)
            move_slot_service.book_move_slot(
                db,
                block=flat_for_slot.block,
                slot_date=data.move_slot_date,
                start_time=data.move_slot_start,
                end_time=data.move_slot_end,
                move_type="move_out",
                reference_type="resident",
                reference_id=resident.resident_id,
            )

        # Vacate the flat on move-out completion, but only if no other
        # active resident remains there.
        flat = resident.flat or crud.get_flat(db, resident.flat_id)
        if flat and crud.count_active_residents_for_flat(
            db, resident.flat_id, exclude_resident_id=resident.resident_id
        ) == 0:
            flat.occupancy_status = "vacant"

    db.commit()
    db.refresh(resident)
    return ResidentOut.model_validate(resident)


# ── Delete ────────────────────────────────────────────────────────────────────

def delete_resident(db: Session, resident_id: str) -> dict:
    resident = _get_resident_or_404(db, resident_id)
    crud.delete_resident(db, resident)
    db.commit()
    return {"detail": f"Resident '{resident_id}' deactivated successfully."}
