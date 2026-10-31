"""Service layer for the Communication module (BE-27)."""

from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import communication as crud
from app.crud import residents as resident_crud
from app.models.communication import Circular, Poll
from app.schemas.communication import (
    MAX_ATTACHMENTS,
    CircularCreate,
    CircularOut,
    PollCreate,
    PollOut,
    PollResponseCreate,
    PollResponseOut,
    PollResultsOut,
)
from app.services import audit_service


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_circular_or_404(db: Session, circular_id: str) -> Circular:
    circular = crud.get_circular(db, circular_id)
    if not circular:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Circular '{circular_id}' not found.",
        )
    return circular


def _get_poll_or_404(db: Session, poll_id: str) -> Poll:
    poll = crud.get_poll(db, poll_id)
    if not poll:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Poll '{poll_id}' not found.",
        )
    return poll


def _build_tally(db: Session, poll: Poll) -> dict:
    """
    Build a complete tally dict (every option present, even with 0 votes).
    """
    raw = crud.count_votes_by_option(db, poll.poll_id)
    return {opt: raw.get(opt, 0) for opt in poll.options}


def _poll_to_out(db: Session, poll: Poll) -> PollOut:
    tally = _build_tally(db, poll)
    total = sum(tally.values())
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    is_open = poll.open_at <= now <= poll.close_at
    return PollOut(
        poll_id=poll.poll_id,
        question=poll.question,
        options=poll.options,
        open_at=poll.open_at,
        close_at=poll.close_at,
        created_by=poll.created_by,
        created_at=poll.created_at,
        tally=tally,
        total_votes=total,
        is_open=is_open,
    )


# ── Circulars ─────────────────────────────────────────────────────────────────

def create_circular(db: Session, data: CircularCreate) -> CircularOut:
    """
    Errors:
      400 - more than MAX_ATTACHMENTS attachment paths provided
      400 - meeting_date is in the past
    """
    # Attachment limit (also checked by schema validator, but enforce here
    # too for defence-in-depth)
    if len(data.attachments) > MAX_ATTACHMENTS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"A circular may have at most {MAX_ATTACHMENTS} attachments "
                f"({len(data.attachments)} provided)."
            ),
        )

    # Meeting-date validity
    if data.meeting_date is not None and data.meeting_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"meeting_date '{data.meeting_date.isoformat()}' is in the past. "
                "It must be today or a future date."
            ),
        )

    circular = crud.create_circular(db, data)
    db.flush()
    audit_service.log_action(
        db,
        actor_id=data.created_by,
        actor_role="admin",
        module="communication",
        action="circular_created",
        target_type="circular",
        target_id=circular.circular_id,
        description=f"Circular '{data.title}' created.",
    )
    db.commit()
    db.refresh(circular)
    return _circular_to_out(circular)


def _circular_to_out(circular: Circular) -> CircularOut:
    return CircularOut(
        circular_id=circular.circular_id,
        title=circular.title,
        body=circular.body,
        category=circular.category,
        meeting_date=(
            date.fromisoformat(circular.meeting_date)
            if circular.meeting_date
            else None
        ),
        attachments=circular.attachments or [],
        created_by=circular.created_by,
        created_at=circular.created_at,
        updated_at=circular.updated_at,
    )


def list_circulars(db: Session, category: str | None = None) -> list[CircularOut]:
    rows = crud.list_circulars(db, category)
    return [_circular_to_out(r) for r in rows]


def get_circular(db: Session, circular_id: str) -> CircularOut:
    circular = _get_circular_or_404(db, circular_id)
    return _circular_to_out(circular)


# ── Polls ─────────────────────────────────────────────────────────────────────

def create_poll(db: Session, data: PollCreate) -> PollOut:
    """Schema already validates that close_at > open_at and options >= 2."""
    poll = crud.create_poll(db, data)
    db.flush()
    audit_service.log_action(
        db,
        actor_id=data.created_by,
        actor_role="admin",
        module="communication",
        action="poll_created",
        target_type="poll",
        target_id=poll.poll_id,
        description=f"Poll '{data.question[:60]}' created.",
    )
    db.commit()
    db.refresh(poll)
    return _poll_to_out(db, poll)


def list_polls(db: Session) -> list[PollOut]:
    polls = crud.list_polls(db)
    return [_poll_to_out(db, p) for p in polls]


def get_poll(db: Session, poll_id: str) -> PollOut:
    poll = _get_poll_or_404(db, poll_id)
    return _poll_to_out(db, poll)


def get_poll_results(db: Session, poll_id: str) -> PollResultsOut:
    poll = _get_poll_or_404(db, poll_id)
    tally = _build_tally(db, poll)
    total = sum(tally.values())
    winner = max(tally, key=tally.get) if total > 0 else None
    return PollResultsOut(
        poll_id=poll.poll_id,
        question=poll.question,
        options=poll.options,
        open_at=poll.open_at,
        close_at=poll.close_at,
        tally=tally,
        total_votes=total,
        winner=winner,
    )


# ── Voting ────────────────────────────────────────────────────────────────────

def cast_vote(
    db: Session, poll_id: str, data: PollResponseCreate
) -> PollResponseOut:
    """
    Record a resident's vote on a poll.

    Errors:
      404 - poll not found
      404 - resident not found
      400 - poll is not currently open (before open_at or after close_at)
      400 - chosen_option is not one of the poll's options
      409 - resident has already voted on this poll
    """
    poll = _get_poll_or_404(db, poll_id)

    # Resident must exist
    if not resident_crud.get_resident(db, data.resident_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{data.resident_id}' not found.",
        )

    # Open/close window check (compare naive datetimes)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if now < poll.open_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Poll '{poll_id}' has not opened yet. "
                f"Voting opens at {poll.open_at.isoformat()}."
            ),
        )
    if now > poll.close_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Poll '{poll_id}' is closed. "
                f"Voting closed at {poll.close_at.isoformat()}."
            ),
        )

    # Chosen option must be one of the declared options
    if data.chosen_option not in poll.options:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"'{data.chosen_option}' is not a valid option for this poll. "
                f"Valid options: {poll.options}."
            ),
        )

    # Duplicate vote check
    if crud.get_poll_response(db, poll_id, data.resident_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Resident '{data.resident_id}' has already voted on poll '{poll_id}'."
            ),
        )

    response = crud.create_poll_response(
        db, poll_id, data.resident_id, data.chosen_option
    )
    db.flush()
    audit_service.log_action(
        db,
        actor_id=data.resident_id,
        actor_role="resident",
        module="communication",
        action="poll_vote_cast",
        target_type="poll",
        target_id=poll_id,
        description=(
            f"Resident '{data.resident_id}' voted '{data.chosen_option}' "
            f"on poll '{poll_id}'."
        ),
    )
    db.commit()
    db.refresh(response)
    return PollResponseOut.model_validate(response)
