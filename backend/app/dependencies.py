"""
FastAPI dependency functions.

Centralises all shared dependencies so routers stay clean.

BE-21 additions:
  get_current_user  - decode Bearer token, return the User ORM object
  require_roles     - factory that returns a dependency enforcing one or
                      more allowed roles (403 when the caller's role is not
                      in the allowed set)
"""

from collections.abc import Generator

from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import SessionLocal

_bearer = HTTPBearer(auto_error=False)


def get_db() -> Generator[Session, None, None]:
    """
    Yield a SQLAlchemy database session and guarantee it is closed
    after the request finishes (even on error).

    Usage in a router:
        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── BE-21 JWT dependencies ────────────────────────────────────────────────────

def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
    db: Session = Depends(get_db),
):
    """
    Decode the Bearer token and return the authenticated User ORM object.

    Raises:
      401 - no token supplied, token is malformed, expired, or has an
             invalid signature
      401 - user_id in the token no longer exists in the database

    Usage in a router:
        @router.get("/example")
        def example(current_user = Depends(get_current_user)):
            ...
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Inline import avoids a circular dependency:
    # dependencies → utils.security → config  (no cycle)
    # dependencies → crud.auth → models.user → database  (no cycle)
    from app.utils.security import decode_access_token
    from app.crud.auth import get_user_by_id

    payload = decode_access_token(credentials.credentials)
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload is missing subject claim.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_current_user_optional(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
    db: Session = Depends(get_db),
):
    """
    Same idea as get_current_user, but never raises - returns None when no
    token is supplied or the token is invalid/expired, instead of a 401.

    Used by endpoints (e.g. payments/billing) that want to attribute an
    action to the authenticated actor for audit logging when a token is
    present, but that historically have not required authentication and
    must keep working for callers that don't send one.

    Usage in a router:
        @router.post("/example")
        def example(current_user = Depends(get_current_user_optional)):
            actor_id = current_user.user_id if current_user else None
    """
    if credentials is None:
        return None

    from app.utils.security import decode_access_token
    from app.crud.auth import get_user_by_id

    try:
        payload = decode_access_token(credentials.credentials)
    except HTTPException:
        return None

    user_id: str | None = payload.get("sub")
    if not user_id:
        return None

    return get_user_by_id(db, user_id)


def require_roles(*allowed_roles: str):
    """
    Dependency factory - returns a dependency that enforces role membership.

    Usage in a router:
        @router.get("/admin-only")
        def admin_only(current_user = Depends(require_roles("admin", "president"))):
            ...

    Raises:
      401 - no valid token (propagated from get_current_user)
      403 - authenticated but role not in allowed_roles
    """
    def _check(current_user=Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Access denied. Required role(s): {', '.join(allowed_roles)}. "
                    f"Your role: {current_user.role}."
                ),
            )
        return current_user
    return _check
