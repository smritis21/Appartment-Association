"""
CRUD operations for the Forum & Lost-and-Found module (BE-29).

Comment count is derived via COUNT(forum_comments) grouped by post_id - never
stored on the post row.
"""

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.forum import ForumComment, ForumPost, LostFoundItem
from app.schemas.forum import (
    ForumCommentCreate,
    ForumPostCreate,
    LostFoundItemCreate,
)


# ── Forum Posts ───────────────────────────────────────────────────────────────

def get_post(db: Session, post_id: str) -> ForumPost | None:
    return db.query(ForumPost).filter(ForumPost.post_id == post_id).first()


def list_posts(
    db: Session,
    category: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[ForumPost]:
    q = db.query(ForumPost)
    if category:
        q = q.filter(ForumPost.category == category)
    return q.order_by(ForumPost.created_at.desc()).offset(skip).limit(limit).all()


def count_posts(db: Session, category: str | None = None) -> int:
    q = db.query(ForumPost)
    if category:
        q = q.filter(ForumPost.category == category)
    return q.count()


def create_post(db: Session, data: ForumPostCreate) -> ForumPost:
    post = ForumPost(
        title=data.title,
        body=data.body,
        category=data.category,
        image_refs=data.image_refs,
        author_id=data.author_id,
    )
    db.add(post)
    return post


def count_comments_for_post(db: Session, post_id: str) -> int:
    return (
        db.query(ForumComment)
        .filter(ForumComment.post_id == post_id)
        .count()
    )


# ── Forum Comments ────────────────────────────────────────────────────────────

def get_comment(db: Session, comment_id: str) -> ForumComment | None:
    return (
        db.query(ForumComment)
        .filter(ForumComment.comment_id == comment_id)
        .first()
    )


def list_comments(
    db: Session,
    post_id: str,
    skip: int = 0,
    limit: int = 20,
) -> list[ForumComment]:
    return (
        db.query(ForumComment)
        .filter(ForumComment.post_id == post_id)
        .order_by(ForumComment.created_at.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def count_comments(db: Session, post_id: str) -> int:
    return (
        db.query(ForumComment)
        .filter(ForumComment.post_id == post_id)
        .count()
    )


def create_comment(
    db: Session, post_id: str, data: ForumCommentCreate
) -> ForumComment:
    comment = ForumComment(
        post_id=post_id,
        body=data.body,
        author_id=data.author_id,
    )
    db.add(comment)
    return comment


# ── Lost & Found Items ────────────────────────────────────────────────────────

def get_lost_found_item(db: Session, item_id: str) -> LostFoundItem | None:
    return (
        db.query(LostFoundItem)
        .filter(LostFoundItem.item_id == item_id)
        .first()
    )


def list_lost_found_items(
    db: Session,
    item_type: str | None = None,
    status: str | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[LostFoundItem]:
    q = db.query(LostFoundItem)
    if item_type:
        q = q.filter(LostFoundItem.item_type == item_type)
    if status:
        q = q.filter(LostFoundItem.status == status)
    return q.order_by(LostFoundItem.created_at.desc()).offset(skip).limit(limit).all()


def count_lost_found_items(
    db: Session,
    item_type: str | None = None,
    status: str | None = None,
) -> int:
    q = db.query(LostFoundItem)
    if item_type:
        q = q.filter(LostFoundItem.item_type == item_type)
    if status:
        q = q.filter(LostFoundItem.status == status)
    return q.count()


def create_lost_found_item(
    db: Session, data: LostFoundItemCreate
) -> LostFoundItem:
    item = LostFoundItem(
        item_type=data.item_type,
        title=data.title,
        description=data.description,
        image_ref=data.image_ref,
        status="open",
        reported_by=data.reported_by,
    )
    db.add(item)
    return item


def update_lost_found_status(
    db: Session, item: LostFoundItem, new_status: str
) -> LostFoundItem:
    item.status = new_status
    return item
