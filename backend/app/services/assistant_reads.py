"""
Read-only access to the rest of the API, for the assistant.

The assistant can already *do* a handful of things through curated tools. This
module is the other half: letting it *look things up* across every module
without a tool being hand-written for each question.

How it works, and why this way:

  - The catalogue is generated from the application's own routes, so a new
    GET endpoint becomes answerable without anyone editing a list here. Only
    GETs are included, which is what makes this safe to open up - there is no
    path through this module that writes anything.

  - Endpoints taking path parameters are left out. They need an id the user
    has not given, and guessing one is how an assistant ends up reading
    somebody else's record.

  - The call goes back through the HTTP API rather than reaching into the
    services underneath, so the endpoint's own auth, role checks, validation
    and response shaping all still apply. The assistant gets exactly what a
    resident would get, no more.

The alternative - one tool per endpoint - was rejected deliberately: a model
choosing between a hundred near-identical intents picks the wrong one often
enough to matter, and the whole catalogue would have to be sent on every
message.
"""

from __future__ import annotations

import logging
import re

import httpx

from app.config import settings
from app.utils.security import create_access_token

logger = logging.getLogger(__name__)

# Kept tight: this sits inside a request the user is waiting on.
_TIMEOUT_SECONDS = 6

# Endpoints that answer nothing a person would ask, or that belong to the
# assistant itself and would read strangely coming back through it.
_SKIP_PREFIXES = (
    "/api/v1/assistant",
    "/api/v1/auth",
)
_SKIP_EXACT = {
    "/api/v1/health",
    "/api/v1/",
}


def _topic_key(path: str) -> str:
    """/api/v1/complaints/stats -> complaints_stats"""
    trimmed = path.replace("/api/v1/", "").strip("/")
    return re.sub(r"[^a-z0-9]+", "_", trimmed.lower()).strip("_") or "root"


def catalogue() -> list[dict]:
    """
    Every readable topic, derived from the routes the app actually serves.

    Rebuilt on each call rather than cached: it is cheap, and a stale
    catalogue that offers a route which no longer exists is worse than the
    few microseconds saved.
    """
    from app.main import app

    topics: dict[str, dict] = {}
    for route in app.routes:
        methods = getattr(route, "methods", None) or set()
        path = getattr(route, "path", "")
        if "GET" not in methods or not path.startswith("/api/v1"):
            continue
        if "{" in path or path in _SKIP_EXACT:
            continue
        if any(path.startswith(prefix) for prefix in _SKIP_PREFIXES):
            continue

        key = _topic_key(path)
        summary = (getattr(route, "summary", None) or getattr(route, "name", "") or key)
        # Several routers register the same path for different response
        # models; the first description is as good as any.
        topics.setdefault(key, {"topic": key, "path": path, "description": str(summary)})
    return sorted(topics.values(), key=lambda t: t["topic"])


def fetch(topic: str, user, params: dict | None = None) -> dict | list | None:
    """
    Read one topic as the signed-in user.

    A token is minted for them so the endpoint applies the same role rules it
    would to any other request - the assistant is not a way around them.
    Returns None when the topic is unknown or the call does not succeed, which
    the caller treats as "I could not find that out".
    """
    entry = next((t for t in catalogue() if t["topic"] == topic), None)
    if entry is None:
        return None

    token = create_access_token({"sub": user.user_id, "role": user.role})
    url = f"{settings.SELF_BASE_URL.rstrip('/')}{entry['path']}"

    try:
        response = httpx.get(
            url,
            params=params or {},
            headers={"Authorization": f"Bearer {token}"},
            timeout=_TIMEOUT_SECONDS,
        )
    except httpx.HTTPError as exc:
        logger.warning("Assistant read of %s failed (%s).", topic, exc)
        return None

    if response.status_code >= 400:
        # A 403 here is the endpoint doing its job; the assistant simply
        # reports that it could not find out.
        logger.info("Assistant read of %s returned %s.", topic, response.status_code)
        return None

    try:
        return response.json()
    except ValueError:
        return None


def summarise(payload: dict | list, limit: int = 12) -> str:
    """
    Flatten a response into something a model can quote from.

    Long lists are truncated: the point is to answer a question, not to read
    the database aloud, and an oversized prompt costs latency on every turn.
    """
    import json

    if isinstance(payload, list):
        shown = payload[:limit]
        text = json.dumps(shown, default=str)[:2500]
        if len(payload) > limit:
            text += f"\n(showing {limit} of {len(payload)})"
        return text
    return json.dumps(payload, default=str)[:2500]
