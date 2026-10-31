"""
CRUD operations for the Community Corners module (BE-34).

create_activity() exists for tests and demo-data seeding - BE-34's acceptance
criteria covers listing activities and recording signups, not creating
activities, so there is no public router endpoint for it.
"""

from datetime import date, datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.community import ActivitySignup, CommunityActivity
from app.schemas.community import CommunityActivityCreate


def get_activity(db: Session, activity_id: str) -> CommunityActivity | None:
    return (
        db.query(CommunityActivity)
        .filter(CommunityActivity.activity_id == activity_id)
        .first()
    )


def list_activities(
    db: Session,
    corner: str | None = None,
    status: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[CommunityActivity]:
    query = db.query(CommunityActivity)
    if corner:
        query = query.filter(CommunityActivity.corner == corner)
    if status:
        query = query.filter(CommunityActivity.status == status)
    if date_from:
        query = query.filter(CommunityActivity.activity_date >= date_from)
    if date_to:
        query = query.filter(CommunityActivity.activity_date <= date_to)
    return query.order_by(CommunityActivity.activity_date.asc()).all()


def create_activity(db: Session, data: CommunityActivityCreate) -> CommunityActivity:
    activity = CommunityActivity(**data.model_dump())
    db.add(activity)
    return activity


def count_signups(db: Session, activity_id: str) -> int:
    return (
        db.query(ActivitySignup)
        .filter(ActivitySignup.activity_id == activity_id)
        .count()
    )


def get_signup(db: Session, activity_id: str, resident_id: str) -> ActivitySignup | None:
    return (
        db.query(ActivitySignup)
        .filter(
            ActivitySignup.activity_id == activity_id,
            ActivitySignup.resident_id == resident_id,
        )
        .first()
    )


def list_signups(db: Session, activity_id: str) -> list[ActivitySignup]:
    return (
        db.query(ActivitySignup)
        .filter(ActivitySignup.activity_id == activity_id)
        .order_by(ActivitySignup.signed_up_at.asc())
        .all()
    )


def create_signup(
    db: Session, activity_id: str, resident_id: str, notes: str | None
) -> ActivitySignup:
    signup = ActivitySignup(activity_id=activity_id, resident_id=resident_id, notes=notes)
    db.add(signup)
    return signup


# ── Report aggregates (BE-36) ───────────────────────────────────────────────────

def get_activity_report(db: Session, date_from: date, date_to: date) -> dict:
    q = db.query(CommunityActivity).filter(
        CommunityActivity.activity_date >= date_from, CommunityActivity.activity_date <= date_to
    )
    total = q.with_entities(func.count(CommunityActivity.activity_id)).scalar()
    by_corner = (
        q.with_entities(CommunityActivity.corner, func.count(CommunityActivity.activity_id))
        .group_by(CommunityActivity.corner)
        .all()
    )
    return {"total": total, "by_corner": by_corner}


def get_signup_report(db: Session, date_from: datetime, date_to: datetime) -> dict:
    q = db.query(ActivitySignup).filter(
        ActivitySignup.signed_up_at >= date_from, ActivitySignup.signed_up_at <= date_to
    )
    total = q.with_entities(func.count(ActivitySignup.signup_id)).scalar()
    residents = [r[0] for r in q.with_entities(ActivitySignup.resident_id).distinct().all()]
    return {"total": total, "residents": residents}
