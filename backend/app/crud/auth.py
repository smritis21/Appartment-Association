"""CRUD operations for the Authentication & Accounts module (BE-21)."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.models.user import User


# ── Read ──────────────────────────────────────────────────────────────────────

def get_user_by_id(db: Session, user_id: str) -> User | None:
    return db.query(User).filter(User.user_id == user_id).first()


def get_user_by_email(db: Session, email: str) -> User | None:
    """Case-insensitive lookup - email is normalised to lowercase on write."""
    return db.query(User).filter(User.email == email.lower()).first()


def get_user_by_reset_token(db: Session, token: str) -> User | None:
    return db.query(User).filter(User.reset_token == token).first()


def get_user_by_email_change_token(db: Session, token: str) -> User | None:
    return db.query(User).filter(User.email_change_token == token).first()


# ── Create ────────────────────────────────────────────────────────────────────

def create_user(
    db: Session,
    email: str,
    hashed_password: str,
    full_name: str,
    role: str,
) -> User:
    user = User(
        email=email.lower(),
        hashed_password=hashed_password,
        full_name=full_name,
        role=role,
        account_status="pending",
    )
    db.add(user)
    return user


# ── Update ────────────────────────────────────────────────────────────────────

def update_full_name(db: Session, user: User, full_name: str) -> User:
    user.full_name = full_name
    return user


def update_password(db: Session, user: User, hashed_password: str) -> User:
    user.hashed_password = hashed_password
    return user


def set_reset_token(
    db: Session,
    user: User,
    token: str,
    expires_at: datetime,
) -> User:
    user.reset_token = token
    user.reset_token_expires_at = expires_at
    return user


def clear_reset_token(db: Session, user: User) -> User:
    user.reset_token = None
    user.reset_token_expires_at = None
    return user


def set_email_change_token(
    db: Session,
    user: User,
    pending_email: str,
    token: str,
    expires_at: datetime,
) -> User:
    user.pending_email = pending_email
    user.email_change_token = token
    user.email_change_token_expires_at = expires_at
    return user


def apply_email_change(db: Session, user: User, new_email: str) -> User:
    user.email = new_email
    user.pending_email = None
    user.email_change_token = None
    user.email_change_token_expires_at = None
    return user


def update_role(db: Session, user: User, role: str) -> User:
    user.role = role
    return user


def update_account_status(db: Session, user: User, status: str) -> User:
    user.account_status = status
    return user
