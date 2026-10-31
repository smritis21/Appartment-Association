"""Service layer for the Forum & Lost-and-Found module (BE-29)."""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import forum as crud
from app.models.forum import ForumComment, ForumPost, LostFoundItem, MAX_IMAGE_REFS
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
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_post_or_404(db: Session, post_id: str) -> ForumPost:
    post = crud.get_post(db, post_id)
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Forum post '{post_id}' not found.",
        )
    return post


def _get_item_or_404(db: Session, item_id: str) -> LostFoundItem:
    item = crud.get_lost_found_item(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lost-and-found item '{item_id}' not found.",
        )
    return item


def _post_to_out(db: Session, post: ForumPost) -> ForumPostOut:
    comment_count = crud.count_comments_for_post(db, post.post_id)
    return ForumPostOut(
        post_id=post.post_id,
        title=post.title,
        body=post.body,
        category=post.category,
        image_refs=post.image_refs or [],
        author_id=post.author_id,
        comment_count=comment_count,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )


# ── Forum Posts ───────────────────────────────────────────────────────────────

def create_post(db: Session, data: ForumPostCreate) -> ForumPostOut:
    """Re-checks the image_refs limit here as defence-in-depth, even though
    the schema already validates it."""
    if len(data.image_refs) > MAX_IMAGE_REFS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"A post may have at most {MAX_IMAGE_REFS} image references "
                f"({len(data.image_refs)} provided)."
            ),
        )
    post = crud.create_post(db, data)
    db.commit()
    db.refresh(post)
    return _post_to_out(db, post)


def list_posts(
    db: Session,
    category: str | None,
    skip: int,
    limit: int,
) -> ForumPostListResponse:
    posts = crud.list_posts(db, category=category, skip=skip, limit=limit)
    total = crud.count_posts(db, category=category)
    return ForumPostListResponse(
        total=total,
        skip=skip,
        limit=limit,
        posts=[_post_to_out(db, p) for p in posts],
    )


def get_post(db: Session, post_id: str) -> ForumPostOut:
    post = _get_post_or_404(db, post_id)
    return _post_to_out(db, post)


# ── Forum Comments ────────────────────────────────────────────────────────────

def create_comment(
    db: Session, post_id: str, data: ForumCommentCreate
) -> ForumCommentOut:
    """Errors: 404 - post not found."""
    _get_post_or_404(db, post_id)
    comment = crud.create_comment(db, post_id, data)
    db.commit()
    db.refresh(comment)
    return ForumCommentOut.model_validate(comment)


def list_comments(
    db: Session,
    post_id: str,
    skip: int,
    limit: int,
) -> ForumCommentListResponse:
    """Comments for a post, oldest-first. Errors: 404 - post not found."""
    _get_post_or_404(db, post_id)
    comments = crud.list_comments(db, post_id=post_id, skip=skip, limit=limit)
    total = crud.count_comments(db, post_id=post_id)
    return ForumCommentListResponse(
        total=total,
        skip=skip,
        limit=limit,
        comments=[ForumCommentOut.model_validate(c) for c in comments],
    )


# ── Lost & Found Items ────────────────────────────────────────────────────────

def create_lost_found_item(
    db: Session, data: LostFoundItemCreate
) -> LostFoundItemOut:
    item = crud.create_lost_found_item(db, data)
    db.commit()
    db.refresh(item)
    return LostFoundItemOut.model_validate(item)


def list_lost_found_items(
    db: Session,
    item_type: str | None,
    status: str | None,
    skip: int,
    limit: int,
) -> LostFoundListResponse:
    items = crud.list_lost_found_items(
        db, item_type=item_type, status=status, skip=skip, limit=limit
    )
    total = crud.count_lost_found_items(db, item_type=item_type, status=status)
    return LostFoundListResponse(
        total=total,
        skip=skip,
        limit=limit,
        items=[LostFoundItemOut.model_validate(i) for i in items],
    )


def get_lost_found_item(db: Session, item_id: str) -> LostFoundItemOut:
    item = _get_item_or_404(db, item_id)
    return LostFoundItemOut.model_validate(item)


def update_lost_found_status(
    db: Session, item_id: str, data: LostFoundStatusUpdate
) -> LostFoundItemOut:
    """Errors: 404 - item not found."""
    item = _get_item_or_404(db, item_id)
    crud.update_lost_found_status(db, item, data.status)
    db.commit()
    db.refresh(item)
    return LostFoundItemOut.model_validate(item)
