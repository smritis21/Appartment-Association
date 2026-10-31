from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Literal
from sqlalchemy.orm import Session

from app.crud import announcements as crud_announcements
from app.dependencies import get_db
from app.schemas.announcement import AnnouncementCreate, AnnouncementResponse, AnnouncementUpdate

router = APIRouter(
    prefix="/announcements",
    tags=["Announcements"],
)


@router.post("/", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
def create_announcement(
    announcement: AnnouncementCreate,
    db: Session = Depends(get_db),
):
    """Title and body are required fields."""
    return crud_announcements.create_announcement(db=db, obj_in=announcement)


@router.put("/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(
    announcement_id: int,
    announcement: AnnouncementUpdate,
    db: Session = Depends(get_db),
):
    db_announcement = crud_announcements.get_announcement(db, announcement_id=announcement_id)
    if not db_announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found"
        )
    return crud_announcements.update_announcement(db, db_obj=db_announcement, obj_in=announcement)


@router.get("/", response_model=list[AnnouncementResponse])
def read_announcements(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    filter_type: Literal["all", "current", "historical"] = Query("all", description="Filter by current or historical announcements"),
    status_filter: Literal["draft"] | None = Query(
        None,
        alias="status",
        description="Omit for the resident view. 'draft' returns saved drafts instead.",
    ),
    db: Session = Depends(get_db),
):
    """
    Without `status` this returns what residents see: published notices whose
    scheduled time has passed. Drafts are retrieved with `status=draft`.
    """
    return crud_announcements.get_announcements(
        db, skip=skip, limit=limit, filter_type=filter_type, status=status_filter
    )


@router.get("/search", response_model=list[AnnouncementResponse])
def search_announcements(
    keyword: str | None = Query(None, description="Search keyword in title or body"),
    category: str | None = Query(None, description="Category of the announcement"),
    date: str | None = Query(None, description="Date in YYYY-MM-DD format"),
    db: Session = Depends(get_db),
):
    """Returns an empty list if nothing matches."""
    return crud_announcements.search_announcements(
        db, keyword=keyword, category=category, date_str=date
    )


@router.get("/{announcement_id}", response_model=AnnouncementResponse)
def read_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
):
    db_announcement = crud_announcements.get_announcement(db, announcement_id=announcement_id)
    if not db_announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Announcement not found"
        )
    return db_announcement
