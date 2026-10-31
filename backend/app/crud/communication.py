"""
CRUD operations for the Communication module (BE-27).

Vote tallies are derived from COUNT(poll_responses) grouped by chosen_option;
they are never stored on the poll row.
"""

from datetime import datetime
from typing import Dict

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.communication import Circular, Poll, PollResponse
from app.schemas.communication import CircularCreate, PollCreate


# ── Circular ──────────────────────────────────────────────────────────────────

def get_circular(db: Session, circular_id: str) -> Circular | None:
    return (
        db.query(Circular)
        .filter(Circular.circular_id == circular_id)
        .first()
    )


def list_circulars(
    db: Session,
    category: str | None = None,
) -> list[Circular]:
    query = db.query(Circular)
    if category:
        query = query.filter(Circular.category == category)
    return query.order_by(Circular.created_at.desc()).all()


def create_circular(db: Session, data: CircularCreate) -> Circular:
    # Pydantic date → ISO string for storage
    meeting_date_str = (
        data.meeting_date.isoformat() if data.meeting_date else None
    )
    circular = Circular(
        title=data.title,
        body=data.body,
        category=data.category,
        meeting_date=meeting_date_str,
        attachments=data.attachments,
        created_by=data.created_by,
    )
    db.add(circular)
    return circular


# ── Poll ──────────────────────────────────────────────────────────────────────

def get_poll(db: Session, poll_id: str) -> Poll | None:
    return db.query(Poll).filter(Poll.poll_id == poll_id).first()


def list_polls(db: Session) -> list[Poll]:
    return db.query(Poll).order_by(Poll.created_at.desc()).all()


def create_poll(db: Session, data: PollCreate) -> Poll:
    poll = Poll(
        question=data.question,
        options=data.options,
        open_at=data.open_at,
        close_at=data.close_at,
        created_by=data.created_by,
    )
    db.add(poll)
    return poll


# ── PollResponse ──────────────────────────────────────────────────────────────

def get_poll_response(
    db: Session, poll_id: str, resident_id: str
) -> PollResponse | None:
    """Return an existing response for (poll_id, resident_id) or None."""
    return (
        db.query(PollResponse)
        .filter(
            PollResponse.poll_id == poll_id,
            PollResponse.resident_id == resident_id,
        )
        .first()
    )


def create_poll_response(
    db: Session, poll_id: str, resident_id: str, chosen_option: str
) -> PollResponse:
    response = PollResponse(
        poll_id=poll_id,
        resident_id=resident_id,
        chosen_option=chosen_option,
    )
    db.add(response)
    return response


def count_votes_by_option(db: Session, poll_id: str) -> Dict[str, int]:
    """
    Return a mapping of option_string → vote_count for the given poll.
    Options with zero votes are intentionally absent from the raw DB result;
    the service layer fills them in from poll.options so the response always
    shows every option.
    """
    rows = (
        db.query(PollResponse.chosen_option, func.count(PollResponse.response_id))
        .filter(PollResponse.poll_id == poll_id)
        .group_by(PollResponse.chosen_option)
        .all()
    )
    return {option: count for option, count in rows}


def total_votes(db: Session, poll_id: str) -> int:
    return (
        db.query(PollResponse)
        .filter(PollResponse.poll_id == poll_id)
        .count()
    )
