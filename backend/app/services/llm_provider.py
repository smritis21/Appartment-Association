"""
Optional LLM seam for the AI/ML analytics layer (BE-41).

The team's AI/ML plan sets a hard constraint: the platform must run for
anyone from a clean clone, with no API key, no paid service and no
install. This module is how that constraint is honoured while still
allowing a real model when one is available.

Two rules make it safe:

  1. The LLM never computes anything. Every number (trend, anomalies,
     forecast, risk) is produced deterministically by aiml.py before this
     module is called. The model only rephrases an already-correct
     summary sentence, so it cannot invent or alter a figure.

  2. Any failure falls back to the deterministic template. No key, no
     network, a timeout, a bad response - all end up on the same path
     that runs when the feature is switched off entirely.

Enabling it (all optional, all free):
    AI_PROVIDER=ollama   AI_BASE_URL=http://localhost:11434   AI_MODEL=llama3.2
    AI_PROVIDER=openai_compatible  AI_BASE_URL=...  AI_API_KEY=...  AI_MODEL=...

`openai_compatible` covers the free hosted tiers (Groq, Gemini's
OpenAI-compatible endpoint) without a vendor SDK - it is a plain HTTPS
POST, so nothing new is added to requirements.txt.
"""

import json
import logging
import ssl
import urllib.error
import urllib.request

from app.config import settings

logger = logging.getLogger(__name__)

# Kept short on purpose: this call sits in a request path, and a slow model
# must never make the analytics endpoint feel broken. On timeout we fall
# back to the template, which was already computed.
_REQUEST_TIMEOUT_SECONDS = 8

_SYSTEM_PROMPT = (
    "You rewrite one sentence of apartment-society analytics into plain, "
    "neutral English for a committee member. Keep every number exactly as "
    "given. Do not add figures, predictions or advice that are not present. "
    "Reply with the rewritten sentence only, under 40 words."
)


def is_enabled() -> bool:
    """True only when a provider is configured. Default is off."""
    return bool(settings.AI_PROVIDER) and settings.AI_PROVIDER.lower() != "none"


def _ssl_context() -> ssl.SSLContext | None:
    """
    A context that can actually verify the hosted provider's certificate.

    Python installed from python.org does not use the system keychain, so on a
    fresh macOS machine every HTTPS call here fails with CERTIFICATE_VERIFY_
    FAILED and the assistant silently falls back. certifi ships the CA bundle
    and is already a dependency, so it is used when present; otherwise the
    default context is left alone.
    """
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:  # noqa: BLE001 - no certifi, or an unreadable bundle
        return None


def _post_json(url: str, payload: dict, headers: dict) -> dict:
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    with urllib.request.urlopen(
        request, timeout=_REQUEST_TIMEOUT_SECONDS, context=_ssl_context()
    ) as response:
        return json.loads(response.read().decode("utf-8"))


def _call_ollama(prompt: str, system: str = _SYSTEM_PROMPT) -> str:
    body = _post_json(
        f"{settings.AI_BASE_URL.rstrip('/')}/api/chat",
        {
            "model": settings.AI_MODEL,
            "stream": False,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        },
        headers={},
    )
    return body["message"]["content"]


def _call_openai_compatible(prompt: str, system: str = _SYSTEM_PROMPT) -> str:
    headers = {}
    if settings.AI_API_KEY:
        headers["Authorization"] = f"Bearer {settings.AI_API_KEY}"

    body = _post_json(
        f"{settings.AI_BASE_URL.rstrip('/')}/chat/completions",
        {
            "model": settings.AI_MODEL,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
        },
        headers=headers,
    )
    return body["choices"][0]["message"]["content"]


def _complete(prompt: str, system: str) -> str | None:
    """One completion from whichever provider is configured, or None."""
    if not is_enabled():
        return None
    provider = settings.AI_PROVIDER.lower()
    try:
        if provider == "ollama":
            return _call_ollama(prompt, system)
        if provider == "openai_compatible":
            return _call_openai_compatible(prompt, system)
        logger.warning("Unknown AI_PROVIDER %r.", provider)
        return None
    except (urllib.error.URLError, TimeoutError, KeyError, ValueError, OSError) as exc:
        logger.warning("LLM call failed (%s).", exc)
        return None


_INTERPRET_PROMPT = (
    "You read a message from a resident or staff member of an apartment "
    "society and decide which single action or question it corresponds to.\n\n"
    "Reply with JSON only, no prose, no code fences, in exactly this form:\n"
    '{"intent": "<one of the listed intents or unknown>", "params": {}}\n\n'
    "Rules:\n"
    "- Choose the intent only from the list you are given. If nothing fits, "
    'use "unknown". Never invent an intent.\n'
    "- Fill params only with details actually present in the message. Never "
    "guess a flat number, a name, an amount or a date that was not stated.\n"
    "- Leave a param out entirely rather than filling it with a placeholder.\n"
    "- A question about how something works, or what the options are, is NOT "
    "a request to do it. \"What categories can I complain about?\" is asking "
    "for information; \"my tap is leaking\" is asking for a complaint to be "
    'raised. When in doubt about a question, answer "unknown".\n'
)


def interpret(message: str, intents: list[dict], history: list[str] | None = None) -> dict | None:
    """
    Work out what the user means, using the model rather than keywords.

    `intents` describes what the assistant can do - each entry has a name, a
    description and the params that intent accepts. Returning None means the
    model is unavailable or gave something unusable, and the caller should
    fall back to the deterministic classifier.

    The result is a suggestion, not a decision: the caller still checks the
    role, still asks for anything missing, and still requires the user to
    confirm before anything is written.
    """
    catalogue = "\n".join(
        f"- {i['name']}: {i['description']} "
        f"(params: {', '.join(i.get('described_params') or i['params']) or 'none'})"
        for i in intents
    )
    recent = ""
    if history:
        # Only the last few turns: enough for "that page" or "the second one"
        # to mean something, short enough to stay cheap.
        recent = "Recent conversation:\n" + "\n".join(history[-4:]) + "\n\n"
    prompt = f"Available intents:\n{catalogue}\n\n{recent}Message: {message}"

    raw = _complete(prompt, _INTERPRET_PROMPT)
    if not raw:
        return None

    text = raw.strip()
    # Models often wrap JSON in ```json fences despite being asked not to.
    if text.startswith("```"):
        text = text.strip("`")
        text = text.split("\n", 1)[-1] if "\n" in text else text
        if text.lstrip().startswith("json"):
            text = text.lstrip()[4:]
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        logger.warning("LLM interpret returned no JSON object.")
        return None

    try:
        parsed = json.loads(text[start:end + 1])
    except ValueError:
        logger.warning("LLM interpret returned invalid JSON.")
        return None

    intent = parsed.get("intent")
    known = {i["name"] for i in intents}
    if intent not in known:
        # Includes "unknown", which is a legitimate answer.
        return None

    params = parsed.get("params")
    if not isinstance(params, dict):
        params = {}
    # Keep only params this intent actually accepts, and only real values.
    allowed = {i["name"]: set(i["params"]) for i in intents}[intent]
    params = {
        k: v for k, v in params.items()
        if k in allowed and isinstance(v, (str, int, float)) and str(v).strip()
    }
    return {"intent": intent, "params": params}


def rephrase(template_summary: str) -> tuple[str, str]:
    """
    Return (summary_text, source) where source is "llm" or "template".

    `template_summary` is the deterministic sentence and is always a valid
    answer on its own - this function can only ever improve its wording or
    hand it straight back.
    """
    if not is_enabled():
        return template_summary, "template"

    provider = settings.AI_PROVIDER.lower()
    try:
        if provider == "ollama":
            text = _call_ollama(template_summary)
        elif provider == "openai_compatible":
            text = _call_openai_compatible(template_summary)
        else:
            logger.warning("Unknown AI_PROVIDER %r - using the deterministic summary.", provider)
            return template_summary, "template"

        text = (text or "").strip()
        if not text:
            return template_summary, "template"
        return text, "llm"

    except (urllib.error.URLError, TimeoutError, KeyError, ValueError, OSError) as exc:
        # Deliberately broad-but-enumerated: an unreachable model, a changed
        # response shape or a network hiccup are all "just use the template".
        logger.warning("LLM rephrase failed (%s) - using the deterministic summary.", exc)
        return template_summary, "template"


_ANSWER_PROMPT = (
    "You answer a resident's question about their apartment society portal.\n\n"
    "Answer ONLY from the facts given below. If the facts do not contain the "
    "answer, say you do not have that information and suggest which screen "
    "might. Never invent a figure, a name, a date or a policy.\n"
    "Two sentences at most, plain English, no markdown."
)


def answer_from_facts(question: str, facts: str) -> str | None:
    """
    Answer a general question using only the facts supplied.

    This exists so a question nobody wrote an intent for - "what categories
    can I complain about?" - still gets a real answer instead of a shrug. The
    facts come from the application, so the model is summarising rather than
    recalling, and it is told to refuse anything it cannot ground.
    """
    reply = _complete(f"Facts:\n{facts}\n\nQuestion: {question}", _ANSWER_PROMPT)
    if not reply:
        return None
    text = reply.strip()
    return text or None
