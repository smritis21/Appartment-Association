"""Service layer for the Authentication & Accounts module (BE-21)."""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import auth as crud
from app.models.user import User
from app.schemas.auth import (
    MessageOut,
    TokenOut,
    UserProfileOut,
    UserProfileUpdate,
    UserRegister,
)
from app.services import audit_service
from app.utils.security import (
    create_access_token,
    hash_password,
    verify_password,
)

# Reset tokens expire after 1 hour.
RESET_TOKEN_TTL_MINUTES = 60

# Email-change confirmation tokens expire after 30 minutes.
EMAIL_CHANGE_TOKEN_TTL_MINUTES = 30

# ── Login lockout (EN-21) ─────────────────────────────────────────────────────
#
# In-process, per-email sliding-window counter - enough to blunt naive
# credential-stuffing / brute-force attempts against a single-instance
# deployment without adding new infrastructure (Redis, etc.). It resets on
# process restart and isn't shared across multiple app instances; a
# production multi-instance deployment would need a shared store instead.

MAX_FAILED_LOGIN_ATTEMPTS = 5
LOGIN_LOCKOUT_WINDOW_MINUTES = 15

_failed_login_attempts: dict[str, list[datetime]] = {}


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _recent_failed_attempts(email: str, now: datetime) -> list[datetime]:
    window_start = now - timedelta(minutes=LOGIN_LOCKOUT_WINDOW_MINUTES)
    key = _normalize_email(email)
    return [t for t in _failed_login_attempts.get(key, []) if t > window_start]


def _record_failed_login(email: str, now: datetime) -> None:
    key = _normalize_email(email)
    _failed_login_attempts[key] = _recent_failed_attempts(email, now) + [now]


def _clear_failed_logins(email: str) -> None:
    _failed_login_attempts.pop(_normalize_email(email), None)


def reset_login_lockout_state() -> None:
    """Test-only helper - clears all tracked failed-attempt state."""
    _failed_login_attempts.clear()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_user_or_404(db: Session, user_id: str) -> User:
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User '{user_id}' not found.",
        )
    return user


def _utcnow() -> datetime:
    """Naive UTC now - consistent with the rest of the codebase."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Register ──────────────────────────────────────────────────────────────────

def register(db: Session, data: UserRegister) -> UserProfileOut:
    """
    Create a new user account with account_status = 'pending'.

    Errors:
      409 - email already registered
    """
    if crud.get_user_by_email(db, data.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists.",
        )

    user = crud.create_user(
        db,
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=data.role,
    )
    db.flush()
    audit_service.log_action(
        db,
        actor_id=user.user_id,
        actor_role=user.role,
        module="auth",
        action="user_registered",
        target_type="user",
        target_id=user.user_id,
        description=f"New account registered: {user.email} (role={user.role}).",
    )
    db.commit()
    db.refresh(user)
    return UserProfileOut.model_validate(user)


# ── Login ─────────────────────────────────────────────────────────────────────

def login(db: Session, email: str, password: str) -> TokenOut:
    """
    Validate credentials and return a signed JWT.

    Errors:
      401 - email not found or password wrong (same message to prevent
            user enumeration)
      403 - account is pending or suspended
      429 - too many recent failed attempts for this email (lockout)
    """
    now = _utcnow()

    if len(_recent_failed_attempts(email, now)) >= MAX_FAILED_LOGIN_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Too many failed login attempts. Try again in up to "
                f"{LOGIN_LOCKOUT_WINDOW_MINUTES} minutes."
            ),
        )

    user = crud.get_user_by_email(db, email)

    # Deliberate: same error for "not found" and "wrong password" so an
    # attacker cannot enumerate registered emails.
    if not user or not verify_password(password, user.hashed_password):
        _record_failed_login(email, now)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    _clear_failed_logins(email)

    if user.account_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is pending approval. Please wait for an administrator to activate it.",
        )

    if user.account_status == "suspended":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been suspended. Please contact the association office.",
        )

    token = create_access_token({"sub": user.user_id, "role": user.role})

    audit_service.log_action(
        db,
        actor_id=user.user_id,
        actor_role=user.role,
        module="auth",
        action="user_login",
        target_type="user",
        target_id=user.user_id,
        description=f"Successful login: {user.email}.",
    )
    db.commit()

    return TokenOut(
        access_token=token,
        token_type="bearer",
        user_id=user.user_id,
        role=user.role,
        account_status=user.account_status,
    )


# ── Forgot password ───────────────────────────────────────────────────────────

def forgot_password(db: Session, email: str) -> MessageOut:
    """
    Generate a password-reset token and store it on the user row.

    Always returns the same success message regardless of whether the email
    exists - prevents user enumeration.

    In production the token would be emailed; here it is stored in the DB
    and the reset endpoint accepts it directly (no email infrastructure
    required for the prototype).
    """
    user = crud.get_user_by_email(db, email)
    if user:
        token = str(uuid.uuid4())
        expires_at = _utcnow() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
        crud.set_reset_token(db, user, token, expires_at)
        audit_service.log_action(
            db,
            actor_id=user.user_id,
            actor_role=user.role,
            module="auth",
            action="password_reset_requested",
            target_type="user",
            target_id=user.user_id,
            description=f"Password reset token issued for {user.email}.",
        )
        db.commit()

    return MessageOut(
        detail="If that email is registered, a password reset token has been issued."
    )


# ── Reset password ────────────────────────────────────────────────────────────

def reset_password(db: Session, token: str, new_password: str) -> MessageOut:
    """
    Consume a reset token and update the password.

    Errors:
      400 - token not found or already expired
    """
    user = crud.get_user_by_reset_token(db, token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token is invalid or has already been used.",
        )

    if user.reset_token_expires_at is None or _utcnow() > user.reset_token_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token has expired. Please request a new one.",
        )

    crud.update_password(db, user, hash_password(new_password))
    crud.clear_reset_token(db, user)
    audit_service.log_action(
        db,
        actor_id=user.user_id,
        actor_role=user.role,
        module="auth",
        action="password_reset_completed",
        target_type="user",
        target_id=user.user_id,
        description=f"Password reset completed for {user.email}.",
    )
    db.commit()
    return MessageOut(detail="Password has been reset successfully.")


# ── Change password ───────────────────────────────────────────────────────────

def change_password(
    db: Session,
    user_id: str,
    current_password: str,
    new_password: str,
) -> MessageOut:
    """
    Change password for an authenticated user.

    Errors:
      401 - current password is wrong
      404 - user not found (should not happen if token is valid)
    """
    user = _get_user_or_404(db, user_id)

    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Current password is incorrect.",
        )

    crud.update_password(db, user, hash_password(new_password))
    audit_service.log_action(
        db,
        actor_id=user.user_id,
        actor_role=user.role,
        module="auth",
        action="password_changed",
        target_type="user",
        target_id=user.user_id,
        description=f"Password changed for {user.email}.",
    )
    db.commit()
    return MessageOut(detail="Password changed successfully.")


# ── Profile ───────────────────────────────────────────────────────────────────

def get_profile(db: Session, user_id: str) -> UserProfileOut:
    user = _get_user_or_404(db, user_id)
    return UserProfileOut.model_validate(user)


def update_profile(
    db: Session,
    user_id: str,
    data: UserProfileUpdate,
) -> UserProfileOut:
    """
    Partial profile update - only full_name for now.

    Errors:
      404 - user not found
    """
    user = _get_user_or_404(db, user_id)

    if data.full_name is not None:
        crud.update_full_name(db, user, data.full_name)

    audit_service.log_action(
        db,
        actor_id=user.user_id,
        actor_role=user.role,
        module="auth",
        action="profile_updated",
        target_type="user",
        target_id=user.user_id,
        description=f"Profile updated for {user.email}.",
    )
    db.commit()
    db.refresh(user)
    return UserProfileOut.model_validate(user)


# ── Email change (EN-21 - sensitive-field change auditing) ───────────────────

def request_email_change(db: Session, user_id: str, new_email: str) -> MessageOut:
    """
    Generate an email-change confirmation token and store it on the user row,
    alongside the requested new address.

    In production the token would be emailed to the new address; here it is
    stored in the DB and the confirm endpoint accepts it directly (no email
    infrastructure required for the prototype) - same convention as
    forgot_password / reset_password above.

    Errors:
      400 - new_email is the same as the current email
      404 - user not found
      409 - new_email is already in use by a different account
    """
    user = _get_user_or_404(db, user_id)

    if new_email.lower() == user.email.lower():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New email must be different from current email.",
        )

    existing = crud.get_user_by_email(db, new_email)
    if existing and existing.user_id != user.user_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already in use.",
        )

    token = str(uuid.uuid4())
    expires_at = _utcnow() + timedelta(minutes=EMAIL_CHANGE_TOKEN_TTL_MINUTES)
    crud.set_email_change_token(db, user, new_email, token, expires_at)
    audit_service.log_action(
        db,
        actor_id=user.user_id,
        actor_role=user.role,
        module="auth",
        action="email_change_requested",
        target_type="user",
        target_id=user.user_id,
        description=f"Email change requested for {user.email} -> {new_email}.",
    )
    db.commit()
    return MessageOut(
        detail="Email change token issued. Confirm with the token to complete the change."
    )


def confirm_email_change(db: Session, token: str) -> MessageOut:
    """
    Consume an email-change token and apply the pending email address.

    Errors:
      400 - token not found or already expired
    """
    user = crud.get_user_by_email_change_token(db, token)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email change token is invalid or has already been used.",
        )

    if (
        user.email_change_token_expires_at is None
        or _utcnow() > user.email_change_token_expires_at
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email change token has expired. Please request a new one.",
        )

    old_email = user.email
    crud.apply_email_change(db, user, user.pending_email)
    audit_service.log_action(
        db,
        actor_id=user.user_id,
        actor_role=user.role,
        module="auth",
        action="email_changed",
        target_type="user",
        target_id=user.user_id,
        description=f"Email changed: {old_email} -> {user.email}.",
    )
    db.commit()
    return MessageOut(detail="Email changed successfully.")


# ── Role change (EN-21 - sensitive-field change auditing) ────────────────────

def change_user_role(
    db: Session,
    target_user_id: str,
    new_role: str,
    actor_id: str,
    actor_role: str,
) -> UserProfileOut:
    """
    Change another user's role. Restricted to admins at the router level
    (Depends(require_roles("admin"))).

    Errors:
      404 - target user not found
    """
    user = _get_user_or_404(db, target_user_id)
    old_role = user.role
    crud.update_role(db, user, new_role)
    audit_service.log_action(
        db,
        actor_id=actor_id,
        actor_role=actor_role,
        module="auth",
        action="role_changed",
        target_type="user",
        target_id=user.user_id,
        description=f"Role changed for {user.email}: {old_role} -> {new_role} (by admin {actor_id}).",
    )
    db.commit()
    db.refresh(user)
    return UserProfileOut.model_validate(user)


# ── Account status change (Bug 34 - admin can suspend/reactivate) ────────────

def change_account_status(
    db: Session,
    target_user_id: str,
    new_status: str,
    actor_id: str,
    actor_role: str,
) -> UserProfileOut:
    """
    Change another user's account_status (e.g. "active" <-> "suspended").
    Restricted to admins at the router level (Depends(require_roles("admin"))).

    This is the only way to move a status back to "active" outside the
    onboarding-approval flow (onboarding_service.approve() sets it directly
    on first activation), and the only production-code path that can
    suspend an account at all.

    Errors:
      404 - target user not found
    """
    user = _get_user_or_404(db, target_user_id)
    old_status = user.account_status
    crud.update_account_status(db, user, new_status)
    audit_service.log_action(
        db,
        actor_id=actor_id,
        actor_role=actor_role,
        module="auth",
        action="account_status_changed",
        target_type="user",
        target_id=user.user_id,
        description=f"Account status changed for {user.email}: {old_status} -> {new_status} (by admin {actor_id}).",
    )
    db.commit()
    db.refresh(user)
    return UserProfileOut.model_validate(user)
