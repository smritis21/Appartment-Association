"""Service layer for the Community Corners module (BE-34)."""

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import community as crud
from app.crud import residents as resident_crud
from app.models.community import CommunityActivity
from app.schemas.community import (
    ActivitySignupCreate,
    ActivitySignupOut,
    CommunityActivityCreate,
    CommunityActivityOut,
)
from app.services import audit_service

# ── Window rules ──────────────────────────────────────────────────────────────
# A signup can only be recorded against an activity that hasn't happened or
# been called off yet.
CLOSED_STATUSES: set[str] = {"completed", "cancelled"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_activity_or_404(db: Session, activity_id: str) -> CommunityActivity:
    activity = crud.get_activity(db, activity_id)
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Activity '{activity_id}' not found.",
        )
    return activity


def _to_out(db: Session, activity: CommunityActivity) -> CommunityActivityOut:
    """
    Attach the derived signup_count/spots_remaining fields. These are never
    stored on the row (see model docstring), so every read recomputes them.
    """
    signup_count = crud.count_signups(db, activity.activity_id)
    spots_remaining = (
        None if activity.capacity is None else max(activity.capacity - signup_count, 0)
    )
    return CommunityActivityOut(
        activity_id=activity.activity_id,
        corner=activity.corner,
        title=activity.title,
        description=activity.description,
        activity_date=activity.activity_date,
        capacity=activity.capacity,
        status=activity.status,
        signup_count=signup_count,
        spots_remaining=spots_remaining,
        created_at=activity.created_at,
        updated_at=activity.updated_at,
    )


# ── Activities ────────────────────────────────────────────────────────────────

def list_activities(
    db: Session,
    corner: str | None = None,
    status_filter: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[CommunityActivityOut]:
    rows = crud.list_activities(db, corner, status_filter, date_from, date_to)
    return [_to_out(db, row) for row in rows]


def get_activity(db: Session, activity_id: str) -> CommunityActivityOut:
    activity = _get_activity_or_404(db, activity_id)
    return _to_out(db, activity)


def create_activity(db: Session, data: CommunityActivityCreate) -> CommunityActivityOut:
    """
    Not exposed by a router endpoint - BE-34's acceptance criteria covers
    listing and signups, not creation. Used by tests and demo-data seeding.
    """
    activity = crud.create_activity(db, data)
    db.commit()
    db.refresh(activity)
    return _to_out(db, activity)


# ── Signups ───────────────────────────────────────────────────────────────────

def create_signup(
    db: Session, activity_id: str, data: ActivitySignupCreate
) -> ActivitySignupOut:
    """
    Record a resident's signup for an activity.

    Errors:
      404 - activity or resident does not exist
      400 - activity is completed/cancelled, or its date has already passed
      400 - activity is at capacity
      409 - resident has already signed up for this activity
    """
    activity = _get_activity_or_404(db, activity_id)

    if not resident_crud.get_resident(db, data.resident_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Resident '{data.resident_id}' not found.",
        )

    if activity.status in CLOSED_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Activity '{activity_id}' is {activity.status} and no "
                "longer accepting signups."
            ),
        )
    if activity.activity_date is not None and activity.activity_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Activity '{activity_id}' already took place on "
                f"{activity.activity_date.isoformat()}."
            ),
        )

    if crud.get_signup(db, activity_id, data.resident_id):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Resident '{data.resident_id}' has already signed up for this activity.",
        )

    if activity.capacity is not None:
        current = crud.count_signups(db, activity_id)
        if current >= activity.capacity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Activity '{activity_id}' is at capacity ({activity.capacity}).",
            )

    signup = crud.create_signup(db, activity_id, data.resident_id, data.notes)
    # Flush (not commit) so signup_id is populated for the audit row while
    # the signup and its audit entry stay inside one transaction - mirrors
    # crud/alerts.py::create_alert's flush-before-fan-out pattern.
    db.flush()
    audit_service.log_action(
        db,
        actor_id=data.resident_id,
        actor_role="resident",
        module="community",
        action="activity_signup_created",
        target_type="activity_signup",
        target_id=signup.signup_id,
        description=f"Signup for activity '{activity_id}'.",
    )
    db.commit()
    db.refresh(signup)
    return ActivitySignupOut.model_validate(signup)


def list_signups(db: Session, activity_id: str) -> list[ActivitySignupOut]:
    _get_activity_or_404(db, activity_id)
    rows = crud.list_signups(db, activity_id)
    return [ActivitySignupOut.model_validate(row) for row in rows]
