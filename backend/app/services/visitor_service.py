"""Service layer for the Visitors module (BE-05)."""

import secrets
import string
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import residents as resident_crud
from app.crud import visitors as crud
from app.models.visitor import Visitor
from app.schemas.visitor import (
    VisitorCreate,
    VisitorDecisionRequest,
    VisitorOut,
    VisitorPassCreate,
    VisitorPassVerifyRequest,
)

# ── Decision rules ────────────────────────────────────────────────────────────

# A decision can only be made on a request that is still waiting for one.
# Every other status already carries a terminal outcome, so a second POST to
# the decision endpoint is a duplicate, not an update.
DECIDABLE_STATUSES: set[str] = {"pending"}

# "Leave at gate" only makes sense for a parcel - you can't leave a person at
# the gate for later collection.
LEFT_AT_GATE_PURPOSES: set[str] = {"delivery"}

# Guard on duty and drop-off point per gate. Mirrors GATE_DESKS in the frontend
# (apartment-app/src/features/visitors/mock/visitors.js) so the API returns the
# same collection details the UI already renders.
GATE_DESKS: dict[str, dict[str, str]] = {
    "Main Gate":    {"guard": "Suresh Patil", "desk": "Security Desk · Main Gate"},
    "East Gate":    {"guard": "Ravi Teja",    "desk": "Security Cabin · East Gate"},
    "Service Gate": {"guard": "Mahesh Rao",   "desk": "Parcel Shelf · Service Gate"},
}

_DEFAULT_DESK = {"guard": "Gate Security", "desk": "Security Desk"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_visitor_or_404(db: Session, visitor_id: str) -> Visitor:
    visitor = crud.get_visitor(db, visitor_id)
    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Visitor request '{visitor_id}' not found.",
        )
    return visitor


def _to_visitor_out(visitor: Visitor) -> VisitorOut:
    """
    VisitorOut with resident_name and flat_number resolved from the linked
    Resident (and their Flat) - a pass or gate entry should always be able
    to show who the visitor is here to see, not just a resident_id, and
    flat_number shouldn't depend on whoever created the record having typed
    it correctly (or at all - the issue-pass flow never asks for it).
    """
    out = VisitorOut.model_validate(visitor)
    resident = visitor.resident
    if resident:
        out.resident_name = resident.name
        if not out.flat_number and resident.flat:
            out.flat_number = resident.flat.flat_number
    return out


def _as_naive_utc(value: datetime) -> datetime:
    """
    Normalise a datetime for comparison.

    SQLite hands back naive datetimes while PostgreSQL may hand back
    tz-aware ones. Comparing the two raises TypeError, so everything is
    reduced to naive UTC before comparison.
    """
    if value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def _reject_if_already_decided(visitor: Visitor) -> None:
    """
    409 on a duplicate decision.

    Two independent signals are checked because a request can be marked
    decided by either path: the status moving off "pending", or decided_at
    being stamped. Both must be clear for the request to be open.
    """
    if visitor.status not in DECIDABLE_STATUSES or visitor.decided_at is not None:
        existing = visitor.decision or visitor.status
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Visitor request '{visitor.visitor_id}' has already been "
                f"decided ('{existing}'). A decision cannot be changed."
            ),
        )


def _reject_if_expired(visitor: Visitor, now: datetime) -> None:
    """400 when the visit window has already closed."""
    if visitor.valid_until is None:
        return
    if _as_naive_utc(visitor.valid_until) < _as_naive_utc(now):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Visitor request '{visitor.visitor_id}' expired at "
                f"{visitor.valid_until.isoformat()} and can no longer be decided."
            ),
        )


def _reject_if_left_at_gate_not_allowed(visitor: Visitor, decision: str) -> None:
    """400 when 'left_at_gate' is used on a non-delivery request."""
    if decision != "left_at_gate":
        return
    purpose = (visitor.purpose or "").strip().lower()
    if purpose not in LEFT_AT_GATE_PURPOSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "'left_at_gate' is only valid for delivery requests. "
                f"This request's purpose is '{visitor.purpose or 'unspecified'}'."
            ),
        )


# ── Entry (BE-05) ─────────────────────────────────────────────────────────────

def create_visitor(db: Session, data: VisitorCreate) -> VisitorOut:
    """
    Log a visitor arriving at the gate (BE-05).

    The record is created in the `pending` state so it lands in the resident's
    approval queue. If a resident_id is supplied it must reference a real
    resident, otherwise the request would be raised against nobody and could
    never be decided on.
    """
    if data.resident_id and not resident_crud.get_resident(db, data.resident_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{data.resident_id}' not found.",
        )

    visitor = crud.create_visitor(db, data)
    db.commit()
    db.refresh(visitor)
    return _to_visitor_out(visitor)


# ── Decision (BE-05) ──────────────────────────────────────────────────────────

def record_decision(
    db: Session, visitor_id: str, data: VisitorDecisionRequest
) -> VisitorOut:
    """
    Record a resident's approve / reject / left_at_gate decision on a visitor
    request, stamped with a UTC timestamp.

    Errors:
      404 - visitor request does not exist
      409 - a decision was already recorded (duplicate)
      400 - the request has expired, or 'left_at_gate' was used on a
            non-delivery request
      422 - decision value is not one of the allowed options (Pydantic)
    """
    visitor = _get_visitor_or_404(db, visitor_id)
    now = datetime.now(timezone.utc)

    _reject_if_already_decided(visitor)
    _reject_if_expired(visitor, now)
    _reject_if_left_at_gate_not_allowed(visitor, data.decision)

    collected_by = None
    pickup_location = None
    if data.decision == "left_at_gate":
        desk = GATE_DESKS.get(visitor.gate)
        if desk:
            collected_by = desk["guard"]
            pickup_location = desk["desk"]
        else:
            collected_by = _DEFAULT_DESK["guard"]
            pickup_location = visitor.gate or _DEFAULT_DESK["desk"]

    crud.record_decision(
        db,
        visitor=visitor,
        decision=data.decision,
        decided_by=data.decided_by,
        notes=data.notes,
        decided_at=now,
        collected_by=collected_by,
        pickup_location=pickup_location,
    )

    db.commit()
    db.refresh(visitor)
    return _to_visitor_out(visitor)


# ── Pass issue / verify (BE-25) ─────────────────────────────────────────────────

_PASS_CODE_ALPHABET = string.ascii_uppercase + string.digits
_PASS_CODE_LENGTH = 8
_PASS_CODE_MAX_ATTEMPTS = 10


def _generate_unique_pass_code(db: Session) -> str:
    """
    Random 8-character alphanumeric code, checked against the DB for
    uniqueness. The pass_code column also carries a UNIQUE constraint as a
    backstop against a race between the check and the insert.
    """
    for _ in range(_PASS_CODE_MAX_ATTEMPTS):
        code = "".join(secrets.choice(_PASS_CODE_ALPHABET) for _ in range(_PASS_CODE_LENGTH))
        if not crud.get_visitor_by_pass_code(db, code):
            return code
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Could not generate a unique pass code. Please retry.",
    )


def issue_pass(db: Session, data: VisitorPassCreate) -> VisitorOut:
    """
    Issue a pre-authorised visitor pass (BE-25).

    Unlike a BE-05 gate entry, a pass is raised by the resident ahead of the
    visit, so it is created already `approved` - there is no separate
    decision step. It becomes single-use at the gate: the first successful
    `POST /visitors/passes/verify` stamps `entry_time`, and a second attempt
    is rejected as already used.
    """
    if not resident_crud.get_resident(db, data.resident_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{data.resident_id}' not found.",
        )

    now = datetime.now(timezone.utc)
    valid_from = data.valid_from or now
    if _as_naive_utc(data.valid_until) <= _as_naive_utc(valid_from):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="valid_until must be later than valid_from.",
        )

    create_data = VisitorCreate(
        **data.model_dump(exclude={"valid_from", "valid_until"}),
        pass_code=_generate_unique_pass_code(db),
        valid_from=valid_from,
        valid_until=data.valid_until,
    )
    visitor = crud.create_visitor(db, create_data)
    visitor.status = "approved"
    visitor.decision = "approved"
    visitor.decided_by = data.resident_id
    visitor.decided_at = now

    db.commit()
    db.refresh(visitor)
    return _to_visitor_out(visitor)


def verify_pass(db: Session, data: VisitorPassVerifyRequest) -> VisitorOut:
    """
    Verify a pass code at the gate (BE-25) and log entry.

    Errors:
      404 - no pass with this code exists
      409 - the pass has already been used (single-use enforcement)
      400 - the current time is outside [valid_from, valid_until]
    """
    visitor = crud.get_visitor_by_pass_code(db, data.pass_code)
    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No pass found with code '{data.pass_code}'.",
        )

    if visitor.entry_time is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Pass '{data.pass_code}' has already been used.",
        )

    now = datetime.now(timezone.utc)
    if visitor.valid_from and _as_naive_utc(visitor.valid_from) > _as_naive_utc(now):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Pass '{data.pass_code}' is not valid until {visitor.valid_from.isoformat()}.",
        )
    _reject_if_expired(visitor, now)

    visitor.entry_time = now
    if data.gate:
        visitor.gate = data.gate

    db.commit()
    db.refresh(visitor)
    return _to_visitor_out(visitor)


def log_exit(db: Session, visitor_id: str) -> VisitorOut:
    """Record a visitor's exit time (BE-25). Requires a logged entry first."""
    visitor = _get_visitor_or_404(db, visitor_id)

    if visitor.entry_time is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Visitor '{visitor_id}' has no logged entry to exit from.",
        )
    if visitor.exit_time is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Visitor '{visitor_id}' has already been logged as exited.",
        )

    visitor.exit_time = datetime.now(timezone.utc)
    db.commit()
    db.refresh(visitor)
    return _to_visitor_out(visitor)


# ── Read helpers (used by the frontend to load the approval queue) ────────────

def get_visitor(db: Session, visitor_id: str) -> VisitorOut:
    visitor = _get_visitor_or_404(db, visitor_id)
    return _to_visitor_out(visitor)


def get_pass_by_code(db: Session, pass_code: str) -> VisitorOut:
    """
    Read-only pass lookup - used by the gate desk to preview a pass (visitor
    name, purpose, validity window) before deciding to approve entry via
    POST /visitors/passes/verify, which is *not* read-only (it stamps
    entry_time as a side effect and is single-use).

    Errors:
      404 - no pass with this code exists
    """
    visitor = crud.get_visitor_by_pass_code(db, pass_code)
    if not visitor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No pass found with code '{pass_code}'.",
        )
    return _to_visitor_out(visitor)


def list_visitors(
    db: Session,
    resident_id: str | None = None,
    status_filter: str | None = None,
    purpose: str | None = None,
    gate: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[VisitorOut]:
    rows = crud.list_visitors(
        db,
        resident_id=resident_id,
        status=status_filter,
        purpose=purpose,
        gate=gate,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=limit,
    )
    return [_to_visitor_out(row) for row in rows]
