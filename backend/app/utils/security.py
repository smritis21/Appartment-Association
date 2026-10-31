"""
utils/security.py - JWT and password hashing helpers for BE-21.

All values are read from app.config.settings so they stay in one place
and can be overridden via environment variables without touching code.

Functions:
  hash_password(plain)          -> hashed string
  verify_password(plain, hashed) -> bool
  create_access_token(data, expires_delta) -> JWT string
  decode_access_token(token)    -> payload dict  (raises HTTPException on failure)
"""

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings

# ── Password hashing ──────────────────────────────────────────────────────────
# bcrypt is the only scheme; deprecated="auto" means passlib will transparently
# re-hash any legacy scheme on next login if we ever add one later.

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Return a bcrypt hash of the plain-text password."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Return True when plain matches the stored bcrypt hash."""
    return _pwd_context.verify(plain, hashed)


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """
    Sign and return a JWT.

    `data` is copied so the caller's dict is never mutated.
    The token always carries an `exp` claim - either the supplied delta or
    settings.ACCESS_TOKEN_EXPIRE_MINUTES.
    """
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    payload["exp"] = expire
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    """
    Decode and validate a JWT.

    Raises:
      401 - token is missing, malformed, expired, or has an invalid signature.
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token is invalid or has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
