"""
FastAPI router for the Community Corners module (BE-34).

Activity creation has no endpoint here - see app/crud/community.py.
"""

from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.community import (
    ActivitySignupCreate,
    ActivitySignupOut,
    ActivityStatus,
    CommunityActivityOut,
    Corner,
)
from app.services import community_service as service

router = APIRouter(prefix="/community", tags=["Community"])


@router.get(
    "/activities",
    response_model=list[CommunityActivityOut],
    summary="List community corner activities",
    description=(
        "Returns activities across all corners (kids, senior, recreational, "
        "social), soonest-first. Filter by corner, status or a date window."
    ),
    responses={422: {"description": "Invalid corner/status filter value"}},
)
def list_activities(
    corner: Corner | None = Query(None, description="kids / senior / recreational / social"),
    status_filter: ActivityStatus | None = Query(
        None, alias="status", description="upcoming / completed / cancelled"
    ),
    date_from: date | None = Query(None, description="Only activities on/after this date"),
    date_to: date | None = Query(None, description="Only activities on/before this date"),
    db: Session = Depends(get_db),
):
    return service.list_activities(db, corner, status_filter, date_from, date_to)


@router.get(
    "/activities/{activity_id}",
    response_model=CommunityActivityOut,
    summary="Get a community activity",
    responses={404: {"description": "Activity not found"}},
)
def get_activity(activity_id: str, db: Session = Depends(get_db)):
    return service.get_activity(db, activity_id)


@router.post(
    "/activities/{activity_id}/signup",
    response_model=ActivitySignupOut,
    status_code=status.HTTP_201_CREATED,
    summary="Sign up for a community activity",
    description=(
        "Records a resident's signup/registration for an activity. Rejected "
        "if the activity is completed/cancelled, already took place, is at "
        "capacity, or the resident has already signed up."
    ),
    responses={
        201: {"description": "Signup recorded"},
        400: {"description": "Activity closed, already occurred, or at capacity"},
        404: {"description": "Activity or resident not found"},
        409: {"description": "Resident already signed up for this activity"},
        422: {"description": "Validation error"},
    },
)
def signup_for_activity(
    activity_id: str, data: ActivitySignupCreate, db: Session = Depends(get_db)
):
    return service.create_signup(db, activity_id, data)


@router.get(
    "/activities/{activity_id}/signups",
    response_model=list[ActivitySignupOut],
    summary="List signups for an activity",
    responses={404: {"description": "Activity not found"}},
)
def list_signups(activity_id: str, db: Session = Depends(get_db)):
    return service.list_signups(db, activity_id)
