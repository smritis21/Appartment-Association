"""FastAPI router for the Forum & Lost-and-Found module (BE-29)."""

from typing import Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.forum import (
    ForumCommentCreate,
    ForumCommentListResponse,
    ForumCommentOut,
    ForumPostCreate,
    ForumPostListResponse,
    ForumPostOut,
    LostFoundItemCreate,
    LostFoundItemOut,
    LostFoundListResponse,
    LostFoundStatusUpdate,
    PostCategory,
    LostFoundType,
    LostFoundStatus,
)
from app.services import forum_service as service

router = APIRouter(prefix="/forum", tags=["Forum & Lost-and-Found"])


# ── Forum Posts ───────────────────────────────────────────────────────────────

@router.post(
    "/posts",
    response_model=ForumPostOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a forum post",
    description=(
        "Create a new discussion post in one of the available categories. "
        "Up to 3 image URL references may be attached. "
        "The `author_id` field is optional - pass a resident ID or display name."
    ),
    responses={
        201: {"description": "Post created"},
        400: {"description": "Too many image references"},
        422: {"description": "Validation error"},
    },
)
def create_post(data: ForumPostCreate, db: Session = Depends(get_db)):
    return service.create_post(db, data)


@router.get(
    "/posts",
    response_model=ForumPostListResponse,
    summary="List forum posts",
    description=(
        "Returns a paginated list of forum posts, newest first. "
        "Optionally filter by `category`. "
        "Each post includes its current comment count."
    ),
    responses={422: {"description": "Invalid category value"}},
)
def list_posts(
    category: Optional[PostCategory] = Query(
        None,
        description="Filter by category: general | events | classifieds | safety | lost_found",
    ),
    skip:  int = Query(0,  ge=0,        description="Records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Max records to return (capped at 100)"),
    db: Session = Depends(get_db),
):
    return service.list_posts(db, category=category, skip=skip, limit=limit)


@router.get(
    "/posts/{post_id}",
    response_model=ForumPostOut,
    summary="Get a forum post",
    description="Returns a single post including its comment count.",
    responses={404: {"description": "Post not found"}},
)
def get_post(post_id: str, db: Session = Depends(get_db)):
    return service.get_post(db, post_id)


# ── Forum Comments ────────────────────────────────────────────────────────────

@router.post(
    "/posts/{post_id}/comments",
    response_model=ForumCommentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a comment to a post",
    description=(
        "Add a flat (non-nested) comment to an existing forum post. "
        "Returns 404 if the parent post does not exist."
    ),
    responses={
        201: {"description": "Comment created"},
        404: {"description": "Post not found"},
        422: {"description": "Validation error"},
    },
)
def create_comment(
    post_id: str,
    data: ForumCommentCreate,
    db: Session = Depends(get_db),
):
    return service.create_comment(db, post_id, data)


@router.get(
    "/posts/{post_id}/comments",
    response_model=ForumCommentListResponse,
    summary="List comments for a post",
    description=(
        "Returns a paginated list of comments for a post, ordered oldest-first. "
        "Returns 404 if the post does not exist."
    ),
    responses={
        200: {"description": "Paginated comments"},
        404: {"description": "Post not found"},
    },
)
def list_comments(
    post_id: str,
    skip:  int = Query(0,  ge=0,        description="Records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Max records to return"),
    db: Session = Depends(get_db),
):
    return service.list_comments(db, post_id=post_id, skip=skip, limit=limit)


# ── Lost & Found ──────────────────────────────────────────────────────────────

@router.post(
    "/lost-found",
    response_model=LostFoundItemOut,
    status_code=status.HTTP_201_CREATED,
    summary="Report a lost or found item",
    description=(
        "Report an item as either 'lost' or 'found'. "
        "An optional single image URL reference may be attached. "
        "New items always start with status 'open'."
    ),
    responses={
        201: {"description": "Item reported"},
        422: {"description": "Validation error (invalid item_type, etc.)"},
    },
)
def create_lost_found_item(data: LostFoundItemCreate, db: Session = Depends(get_db)):
    return service.create_lost_found_item(db, data)


@router.get(
    "/lost-found",
    response_model=LostFoundListResponse,
    summary="List lost and found items",
    description=(
        "Returns a paginated list of lost/found items, newest first. "
        "Optionally filter by `item_type` (lost | found) "
        "and/or `status` (open | resolved)."
    ),
)
def list_lost_found_items(
    item_type: Optional[LostFoundType]   = Query(None, description="Filter: lost | found"),
    status_filter: Optional[LostFoundStatus] = Query(
        None, alias="status", description="Filter: open | resolved"
    ),
    skip:  int = Query(0,  ge=0,        description="Records to skip"),
    limit: int = Query(20, ge=1, le=100, description="Max records to return"),
    db: Session = Depends(get_db),
):
    return service.list_lost_found_items(
        db, item_type=item_type, status=status_filter, skip=skip, limit=limit
    )


@router.get(
    "/lost-found/{item_id}",
    response_model=LostFoundItemOut,
    summary="Get a lost/found item",
    responses={404: {"description": "Item not found"}},
)
def get_lost_found_item(item_id: str, db: Session = Depends(get_db)):
    return service.get_lost_found_item(db, item_id)


@router.patch(
    "/lost-found/{item_id}/status",
    response_model=LostFoundItemOut,
    summary="Update lost/found item status",
    description=(
        "Update the status of a lost/found item to 'open' or 'resolved'. "
        "Updating an already-resolved item is idempotent (returns 200). "
        "Returns 404 if the item does not exist."
    ),
    responses={
        200: {"description": "Status updated"},
        404: {"description": "Item not found"},
        422: {"description": "Invalid status value"},
    },
)
def update_lost_found_status(
    item_id: str,
    data: LostFoundStatusUpdate,
    db: Session = Depends(get_db),
):
    return service.update_lost_found_status(db, item_id, data)
