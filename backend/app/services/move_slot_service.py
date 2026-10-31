"""Service layer for move-in/move-out slot booking (EN-22).

Doesn't commit - the caller (onboarding_service.approve() or
resident_service.update_resident()) commits as part of its own
transaction, so a slot conflict aborts that request atomically.
"""

from datetime import date, time

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import move_slots as crud
from app.models.move_slot import MoveSlot


def _overlaps(a_start, a_end, b_start, b_end) -> bool:
    """Two half-open time ranges overlap iff each starts before the other ends."""
    return a_start < b_end and b_start < a_end


def book_move_slot(
    db: Session,
    block: str,
    slot_date: date,
    start_time: time,
    end_time: time,
    move_type: str,
    reference_type: str,
    reference_id: str,
) -> MoveSlot:
    """Reserve a move slot, rejecting with 409 if it overlaps an existing
    slot for the same block and day."""
    existing = crud.get_slots_for_block_on_date(db, block, slot_date)
    for other in existing:
        if _overlaps(start_time, end_time, other.start_time, other.end_time):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    f"Move slot {start_time}-{end_time} on {slot_date} for block "
                    f"'{block}' conflicts with an existing {other.move_type} slot "
                    f"{other.start_time}-{other.end_time}."
                ),
            )

    return crud.create_move_slot(
        db,
        block=block,
        slot_date=slot_date,
        start_time=start_time,
        end_time=end_time,
        move_type=move_type,
        reference_type=reference_type,
        reference_id=reference_id,
    )
