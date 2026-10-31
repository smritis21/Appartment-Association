"""CRUD operations for the Residents module (BE-18)."""

from datetime import date

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.resident import EmergencyContact, FamilyMember, Flat, Resident
from app.schemas.resident import (
    EmergencyContactCreate,
    FamilyMemberCreate,
    FlatCreate,
    ResidentCreate,
    ResidentUpdate,
)


# ── Flat CRUD ─────────────────────────────────────────────────────────────────

def get_flat(db: Session, flat_id: str) -> Flat | None:
    return db.query(Flat).filter(Flat.flat_id == flat_id).first()


def create_flat(db: Session, data: FlatCreate) -> Flat:
    flat = Flat(**data.model_dump())
    db.add(flat)
    return flat


def get_flat_by_block_and_number(db: Session, block: str, flat_number: str) -> Flat | None:
    return (
        db.query(Flat)
        .filter(Flat.block == block, Flat.flat_number == flat_number)
        .first()
    )


# ── Resident CRUD ─────────────────────────────────────────────────────────────

def _resident_query(db: Session):
    """Base query with all relationships eagerly loaded."""
    return db.query(Resident).options(
        joinedload(Resident.flat),
        joinedload(Resident.family_members),
        joinedload(Resident.emergency_contacts),
    )


def get_resident(db: Session, resident_id: str) -> Resident | None:
    return _resident_query(db).filter(Resident.resident_id == resident_id).first()


def get_residents(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    status: str | None = None,
) -> list[Resident]:
    q = _resident_query(db)
    if status:
        q = q.filter(Resident.status == status)
    return q.offset(skip).limit(limit).all()


def get_residents_filtered(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    status: str | None = None,
    block: str | None = None,
    ownership_type: str | None = None,
) -> list[Resident]:
    """Paginated resident list with block and ownership_type filters (BE-23)."""
    q = _resident_query(db)
    if status:
        q = q.filter(Resident.status == status)
    if block or ownership_type:
        q = q.join(Flat, Flat.flat_id == Resident.flat_id)
        if block:
            q = q.filter(Flat.block == block)
        if ownership_type:
            q = q.filter(Flat.ownership_type == ownership_type)
    return q.offset(skip).limit(limit).all()


def search_residents(db: Session, query: str, limit: int = 20) -> list[Resident]:
    """Case-insensitive search across name and phone."""
    pattern = f"%{query.lower()}%"
    return (
        _resident_query(db)
        .filter(
            or_(
                Resident.name.ilike(pattern),
                Resident.phone.ilike(pattern),
            )
        )
        .limit(limit)
        .all()
    )


def get_active_resident_by_flat_and_phone(
    db: Session, flat_id: str, phone: str
) -> Resident | None:
    """Used to catch the same person being added to a flat twice."""
    return (
        db.query(Resident)
        .filter(
            Resident.flat_id == flat_id,
            Resident.phone == phone,
            Resident.status == "active",
        )
        .first()
    )


def create_resident(db: Session, data: ResidentCreate) -> Resident:
    # Extract nested lists before creating the resident
    family_data: list[FamilyMemberCreate]     = data.family_members
    contact_data: list[EmergencyContactCreate] = data.emergency_contacts

    resident_data = data.model_dump(exclude={"family_members", "emergency_contacts"})
    resident = Resident(**resident_data)
    db.add(resident)
    db.flush()  # get resident_id before inserting children

    for fm in family_data:
        db.add(FamilyMember(resident_id=resident.resident_id, **fm.model_dump()))

    for ec in contact_data:
        db.add(EmergencyContact(resident_id=resident.resident_id, **ec.model_dump()))

    return resident


def update_resident(db: Session, resident: Resident, data: ResidentUpdate) -> Resident:
    # move_slot_* fields aren't columns on Resident - they're transient
    # request fields the service layer consumes separately (EN-22 move-slot
    # booking) before/after this blind setattr loop.
    update_data = data.model_dump(
        exclude_unset=True,
        exclude={"move_slot_date", "move_slot_start", "move_slot_end"},
    )
    for field, value in update_data.items():
        setattr(resident, field, value)
    return resident


def count_active_residents_for_flat(
    db: Session, flat_id: str, exclude_resident_id: str | None = None
) -> int:
    """Used to decide whether a flat can be marked vacant on move-out."""
    q = db.query(func.count(Resident.resident_id)).filter(
        Resident.flat_id == flat_id, Resident.status == "active"
    )
    if exclude_resident_id:
        q = q.filter(Resident.resident_id != exclude_resident_id)
    return q.scalar() or 0


def delete_resident(db: Session, resident: Resident) -> None:
    """Soft delete - marks resident inactive instead of removing the row."""
    resident.status = "inactive"


# ── FamilyMember CRUD ─────────────────────────────────────────────────────────

def get_family_members(db: Session, resident_id: str) -> list[FamilyMember]:
    return (
        db.query(FamilyMember)
        .filter(FamilyMember.resident_id == resident_id)
        .all()
    )


# ── EmergencyContact CRUD ─────────────────────────────────────────────────────

def get_emergency_contacts(db: Session, resident_id: str) -> list[EmergencyContact]:
    return (
        db.query(EmergencyContact)
        .filter(EmergencyContact.resident_id == resident_id)
        .all()
    )


# ── Flat listing / filtering / search (BE-23) ───────────────────────────────────

def get_flats(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    block: str | None = None,
    ownership_type: str | None = None,
    occupancy_status: str | None = None,
) -> list[Flat]:
    """Paginated flat list with optional filters."""
    q = db.query(Flat).options(joinedload(Flat.residents))
    if block:
        q = q.filter(Flat.block == block)
    if ownership_type:
        q = q.filter(Flat.ownership_type == ownership_type)
    if occupancy_status:
        q = q.filter(Flat.occupancy_status == occupancy_status)
    return q.order_by(Flat.block, Flat.flat_number).offset(skip).limit(limit).all()


def search_flats(db: Session, query: str, limit: int = 20) -> list[Flat]:
    """Case-insensitive search across block and flat_number."""
    pattern = f"%{query.lower()}%"
    return (
        db.query(Flat)
        .options(joinedload(Flat.residents))
        .filter(
            or_(
                Flat.block.ilike(pattern),
                Flat.flat_number.ilike(pattern),
            )
        )
        .limit(limit)
        .all()
    )


def get_flat_with_residents(db: Session, flat_id: str) -> Flat | None:
    """Fetch a flat with its residents eagerly loaded."""
    return (
        db.query(Flat)
        .options(
            joinedload(Flat.residents).joinedload(Resident.family_members),
            joinedload(Flat.residents).joinedload(Resident.emergency_contacts),
        )
        .filter(Flat.flat_id == flat_id)
        .first()
    )


def get_distinct_blocks(db: Session) -> list[str]:
    """Sorted list of all distinct block values."""
    rows = db.query(Flat.block).distinct().order_by(Flat.block).all()
    return [r[0] for r in rows]


# ── Report aggregates (BE-36) ───────────────────────────────────────────────────

def get_status_counts(db: Session) -> list[tuple[str, int]]:
    """Point-in-time - residency status isn't something a date range scopes."""
    return db.query(Resident.status, func.count(Resident.resident_id)).group_by(Resident.status).all()


def get_active_count(db: Session) -> int:
    return (
        db.query(func.count(Resident.resident_id)).filter(Resident.status == "active").scalar()
    )


def get_occupancy_counts(db: Session) -> tuple[int, int]:
    """(occupied flats, total flats) - point-in-time."""
    total = db.query(func.count(Flat.flat_id)).scalar()
    occupied = db.query(func.count(Flat.flat_id)).filter(Flat.occupancy_status == "occupied").scalar()
    return occupied, total


def get_block_counts(db: Session) -> list[tuple[str, int]]:
    """Resident count per block - point-in-time."""
    return (
        db.query(Flat.block, func.count(Resident.resident_id))
        .join(Resident, Resident.flat_id == Flat.flat_id)
        .group_by(Flat.block)
        .all()
    )


def get_new_move_ins_count(db: Session, date_from: date, date_to: date) -> int:
    return (
        db.query(func.count(Resident.resident_id))
        .filter(Resident.move_in_date >= date_from, Resident.move_in_date <= date_to)
        .scalar()
    )
