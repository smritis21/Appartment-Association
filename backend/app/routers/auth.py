"""FastAPI router for the Authentication & Accounts module (BE-21)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_roles
from app.schemas.auth import (
    AccountStatusChangeRequest,
    ChangePassword,
    EmailChangeConfirm,
    EmailChangeRequest,
    ForgotPassword,
    MessageOut,
    ResetPassword,
    RoleChangeRequest,
    TokenOut,
    UserLogin,
    UserProfileOut,
    UserProfileUpdate,
    UserRegister,
)
from app.services import auth_service as service

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Public endpoints (no token required) ─────────────────────────────────────

@router.post(
    "/register",
    response_model=UserProfileOut,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new account",
    description=(
        "Creates a new user account. The account is created with "
        "`account_status = 'pending'` and cannot log in until an "
        "administrator activates it. Email addresses are case-insensitive "
        "and must be unique across the system."
    ),
    responses={
        201: {"description": "Account created successfully (pending activation)"},
        409: {"description": "Email address already registered"},
        422: {"description": "Validation error (invalid email, short password, etc.)"},
    },
)
def register(data: UserRegister, db: Session = Depends(get_db)):
    return service.register(db, data)


@router.post(
    "/login",
    response_model=TokenOut,
    summary="Login and receive a JWT",
    description=(
        "Validates credentials and returns a signed JWT access token. "
        "The token payload contains `sub` (user_id), `role`, and `exp`. "
        "Pending and suspended accounts are rejected with 403. After 5 "
        "failed attempts for the same email within 15 minutes, further "
        "attempts are rejected with 429 until the window elapses."
    ),
    responses={
        200: {"description": "Login successful - JWT returned"},
        401: {"description": "Incorrect email or password"},
        403: {"description": "Account is pending or suspended"},
        429: {"description": "Too many failed attempts - locked out temporarily"},
    },
)
def login(data: UserLogin, db: Session = Depends(get_db)):
    return service.login(db, data.email, data.password)


@router.post(
    "/forgot-password",
    response_model=MessageOut,
    summary="Request a password-reset token",
    description=(
        "Generates a single-use password-reset token (valid for 1 hour) "
        "and stores it on the user record. Always returns the same success "
        "message regardless of whether the email exists, to prevent user "
        "enumeration. In production the token would be emailed; in this "
        "prototype it is consumed directly by POST /auth/reset-password."
    ),
    responses={
        200: {"description": "Request acknowledged (token issued if email exists)"},
    },
)
def forgot_password(data: ForgotPassword, db: Session = Depends(get_db)):
    return service.forgot_password(db, data.email)


@router.post(
    "/reset-password",
    response_model=MessageOut,
    summary="Reset password using a reset token",
    description=(
        "Consumes the reset token issued by POST /auth/forgot-password and "
        "sets a new password. The token is single-use and expires after "
        "1 hour. After a successful reset the token is cleared and cannot "
        "be reused."
    ),
    responses={
        200: {"description": "Password reset successfully"},
        400: {"description": "Token is invalid, already used, or expired"},
        422: {"description": "Validation error (password too short)"},
    },
)
def reset_password(data: ResetPassword, db: Session = Depends(get_db)):
    return service.reset_password(db, data.token, data.new_password)


@router.post(
    "/email/confirm",
    response_model=MessageOut,
    summary="Confirm a pending email change",
    description=(
        "Consumes the email-change token issued by POST /auth/email/change "
        "and applies the pending new email address. The token is single-use "
        "and expires after 30 minutes."
    ),
    responses={
        200: {"description": "Email changed successfully"},
        400: {"description": "Token is invalid, already used, or expired"},
    },
)
def confirm_email_change(data: EmailChangeConfirm, db: Session = Depends(get_db)):
    return service.confirm_email_change(db, data.token)


# ── Protected endpoints (Bearer token required) ───────────────────────────────

@router.post(
    "/change-password",
    response_model=MessageOut,
    summary="Change password (authenticated)",
    description=(
        "Changes the password for the currently authenticated user. "
        "Requires the correct current password as confirmation."
    ),
    responses={
        200: {"description": "Password changed successfully"},
        401: {"description": "Missing/invalid token, or current password is wrong"},
        422: {"description": "Validation error (new password too short)"},
    },
)
def change_password(
    data: ChangePassword,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.change_password(
        db,
        user_id=current_user.user_id,
        current_password=data.current_password,
        new_password=data.new_password,
    )


@router.get(
    "/profile",
    response_model=UserProfileOut,
    summary="Get own profile",
    description="Returns the profile of the currently authenticated user.",
    responses={
        200: {"description": "Profile returned successfully"},
        401: {"description": "Missing or invalid token"},
    },
)
def get_profile(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.get_profile(db, current_user.user_id)


@router.put(
    "/profile",
    response_model=UserProfileOut,
    summary="Update own profile",
    description=(
        "Updates the profile of the currently authenticated user. "
        "Only `full_name` can be changed - email changes require "
        "re-verification and are out of scope for this endpoint."
    ),
    responses={
        200: {"description": "Profile updated successfully"},
        401: {"description": "Missing or invalid token"},
        422: {"description": "Validation error"},
    },
)
def update_profile(
    data: UserProfileUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.update_profile(db, current_user.user_id, data)


@router.post(
    "/email/change",
    response_model=MessageOut,
    summary="Request an email change (authenticated)",
    description=(
        "Generates a single-use email-change confirmation token (valid for "
        "30 minutes) and stores it, along with the requested new address, "
        "on the caller's user record. In production the token would be "
        "emailed to the new address; in this prototype it is consumed "
        "directly by POST /auth/email/confirm."
    ),
    responses={
        200: {"description": "Email change token issued"},
        400: {"description": "New email is the same as the current email"},
        401: {"description": "Missing or invalid token"},
        409: {"description": "New email is already in use by another account"},
        422: {"description": "Validation error (invalid email format)"},
    },
)
def request_email_change(
    data: EmailChangeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return service.request_email_change(db, current_user.user_id, data.new_email)


# ── Admin-only endpoints ───────────────────────────────────────────────────────

@router.put(
    "/users/{user_id}/role",
    response_model=UserProfileOut,
    summary="Change a user's role (admin only)",
    description=(
        "Changes the role of any user account. Restricted to administrators. "
        "The change and the previous role are recorded in the audit log."
    ),
    responses={
        200: {"description": "Role changed successfully"},
        401: {"description": "Missing or invalid token"},
        403: {"description": "Authenticated but not an admin"},
        404: {"description": "User not found"},
        422: {"description": "Validation error (role not one of the allowed values)"},
    },
)
def change_user_role(
    user_id: str,
    data: RoleChangeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin")),
):
    return service.change_user_role(
        db, user_id, data.role, current_user.user_id, current_user.role
    )


@router.put(
    "/users/{user_id}/status",
    response_model=UserProfileOut,
    summary="Change a user's account status (admin only)",
    description=(
        "Changes the account_status of any user account (e.g. suspend an "
        "active account, or reactivate a suspended one). Restricted to "
        "administrators. The change and the previous status are recorded "
        "in the audit log. This is the only way to move a status back to "
        "'active' outside of the onboarding-approval flow."
    ),
    responses={
        200: {"description": "Account status changed successfully"},
        401: {"description": "Missing or invalid token"},
        403: {"description": "Authenticated but not an admin"},
        404: {"description": "User not found"},
        422: {"description": "Validation error (status not one of the allowed values)"},
    },
)
def change_account_status(
    user_id: str,
    data: AccountStatusChangeRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles("admin")),
):
    return service.change_account_status(
        db, user_id, data.status, current_user.user_id, current_user.role
    )
