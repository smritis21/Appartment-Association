"""FastAPI router for the Communication module (BE-27)."""

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.communication import (
    CircularCategory,
    CircularCreate,
    CircularOut,
    PollCreate,
    PollOut,
    PollResponseCreate,
    PollResponseOut,
    PollResultsOut,
)
from app.services import communication_service as service

router = APIRouter(prefix="/communication", tags=["Communication"])


# ── Circulars ─────────────────────────────────────────────────────────────────

@router.post(
    "/circulars",
    response_model=CircularOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a circular / notice",
    description=(
        "Admin endpoint to publish a new circular or notice. "
        "Attachment paths are limited to 5. "
        "If meeting_date is provided it must be today or in the future."
    ),
    responses={
        201: {"description": "Circular created"},
        400: {"description": "Too many attachments or past meeting_date"},
        422: {"description": "Validation error"},
    },
)
def create_circular(data: CircularCreate, db: Session = Depends(get_db)):
    return service.create_circular(db, data)


@router.get(
    "/circulars",
    response_model=list[CircularOut],
    summary="List circulars / notices",
    description="Returns all circulars, newest first. Optionally filter by category.",
    responses={422: {"description": "Invalid category filter"}},
)
def list_circulars(
    category: CircularCategory | None = Query(
        None, description="general / meeting / notice / urgent"
    ),
    db: Session = Depends(get_db),
):
    return service.list_circulars(db, category)


@router.get(
    "/circulars/{circular_id}",
    response_model=CircularOut,
    summary="Get a circular",
    responses={404: {"description": "Circular not found"}},
)
def get_circular(circular_id: str, db: Session = Depends(get_db)):
    return service.get_circular(db, circular_id)


# ── Polls ─────────────────────────────────────────────────────────────────────

@router.post(
    "/polls",
    response_model=PollOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a poll / survey",
    description=(
        "Admin endpoint to create a new poll. "
        "Requires at least 2 options and a valid open/close window "
        "(close_at must be after open_at)."
    ),
    responses={
        201: {"description": "Poll created"},
        422: {"description": "Validation error (< 2 options, bad window, etc.)"},
    },
)
def create_poll(data: PollCreate, db: Session = Depends(get_db)):
    return service.create_poll(db, data)


@router.get(
    "/polls",
    response_model=list[PollOut],
    summary="List polls / surveys",
    description="Returns all polls, newest first, each with a live vote tally.",
)
def list_polls(db: Session = Depends(get_db)):
    return service.list_polls(db)


@router.get(
    "/polls/{poll_id}",
    response_model=PollOut,
    summary="Get a poll with live tally",
    responses={404: {"description": "Poll not found"}},
)
def get_poll(poll_id: str, db: Session = Depends(get_db)):
    return service.get_poll(db, poll_id)


@router.post(
    "/polls/{poll_id}/vote",
    response_model=PollResponseOut,
    status_code=status.HTTP_201_CREATED,
    summary="Cast a vote on a poll",
    description=(
        "Record a resident's vote. Each resident may vote only once per poll. "
        "Voting is rejected if the poll has not opened yet or has already closed, "
        "if the chosen option is not valid, or if the resident has already voted."
    ),
    responses={
        201: {"description": "Vote recorded"},
        400: {"description": "Poll not open, or invalid option"},
        404: {"description": "Poll or resident not found"},
        409: {"description": "Resident has already voted on this poll"},
        422: {"description": "Validation error"},
    },
)
def cast_vote(
    poll_id: str, data: PollResponseCreate, db: Session = Depends(get_db)
):
    return service.cast_vote(db, poll_id, data)


@router.get(
    "/polls/{poll_id}/results",
    response_model=PollResultsOut,
    summary="Get poll results",
    description=(
        "Returns the complete tally for a poll (all options, vote counts, "
        "total votes cast, and the current winner). Available at any time - "
        "results are not restricted to closed polls."
    ),
    responses={404: {"description": "Poll not found"}},
)
def get_poll_results(poll_id: str, db: Session = Depends(get_db)):
    return service.get_poll_results(db, poll_id)
