"""CRUD operations for move-in/move-out slot booking (EN-22)."""

from datetime import date

from sqlalchemy.orm import Session

from app.models.move_slot import MoveSlot


def get_slots_for_block_on_date(db: Session, block: str, slot_date: date) -> list[MoveSlot]:
    return (
        db.query(MoveSlot)
        .filter(MoveSlot.block == block, MoveSlot.slot_date == slot_date)
        .all()
    )


def create_move_slot(
    db: Session,
    block: str,
    slot_date: date,
    start_time,
    end_time,
    move_type: str,
    reference_type: str,
    reference_id: str,
) -> MoveSlot:
    slot = MoveSlot(
        block=block,
        slot_date=slot_date,
        start_time=start_time,
        end_time=end_time,
        move_type=move_type,
        reference_type=reference_type,
        reference_id=reference_id,
    )
    db.add(slot)
    return slot
