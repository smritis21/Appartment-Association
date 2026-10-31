from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from sqlalchemy import or_

from app.models.announcement import Announcement
from app.schemas.announcement import AnnouncementCreate, AnnouncementUpdate


def get_announcement(db: Session, announcement_id: int) -> Announcement | None:
    return db.query(Announcement).filter(Announcement.id == announcement_id).first()


def _visible(query):
    """
    Narrow a query to what residents may see.

    A draft has not been sent yet, and a notice scheduled for later should not
    appear until its time arrives, so both are held back from the list.
    """
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    return query.filter(
        Announcement.status == "published",
        or_(Announcement.scheduled_for.is_(None), Announcement.scheduled_for <= now),
    )


def get_announcements(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    filter_type: str = "all",
    status: str | None = None,
) -> list[Announcement]:
    """
    List announcements.

    By default this is what a resident may see: published notices whose
    scheduled time has arrived. Passing `status="draft"` returns the drafts
    instead, so a notice saved for later can be found and finished.
    """
    if status is None:
        query = _visible(db.query(Announcement))
    else:
        query = db.query(Announcement).filter(Announcement.status == status)
    if filter_type == "current":
        thirty_days_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
        query = query.filter(Announcement.created_at >= thirty_days_ago)
    elif filter_type == "historical":
        thirty_days_ago = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
        query = query.filter(Announcement.created_at < thirty_days_ago)
    # Pinned notices first, then newest - the order the dashboard renders in,
    # so the client does not have to re-sort what the API already knows.
    return (
        query.order_by(Announcement.pinned.desc(), Announcement.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def search_announcements(
    db: Session,
    keyword: str | None = None,
    category: str | None = None,
    date_str: str | None = None
) -> list[Announcement]:
    # Search runs over the same visible set as the list, so a draft cannot be
    # surfaced by guessing its title.
    query = _visible(db.query(Announcement))
    
    if keyword:
        query = query.filter(
            (Announcement.title.ilike(f"%{keyword}%")) | 
            (Announcement.body.ilike(f"%{keyword}%"))
        )
    
    if category:
        query = query.filter(Announcement.category.ilike(f"%{category}%"))
        
    if date_str:
        try:
            # date_str is 'YYYY-MM-DD'; filter by the day's range rather than
            # an exact timestamp match.
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            next_day = target_date + timedelta(days=1)
            query = query.filter(
                Announcement.created_at >= target_date,
                Announcement.created_at < next_day
            )
        except ValueError:
            pass  # invalid date format - skip the filter
            
    return query.order_by(Announcement.created_at.desc()).all()


def create_announcement(db: Session, obj_in: AnnouncementCreate) -> Announcement:
    db_obj = Announcement(
        title=obj_in.title,
        body=obj_in.body,
        author=obj_in.author,
        visibility=obj_in.visibility,
        category=obj_in.category,
        pinned=obj_in.pinned,
        status=obj_in.status,
        scheduled_for=obj_in.scheduled_for,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def update_announcement(db: Session, db_obj: Announcement, obj_in: AnnouncementUpdate) -> Announcement:
    update_data = obj_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj
