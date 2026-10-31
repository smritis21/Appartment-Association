"""Service layer for the agentic assistant (BE-42).

A chat message never writes to the database. The flow is:

    POST /assistant/chat                 -> classify, fill slots, PROPOSE
    POST /assistant/actions/{id}/confirm -> execute
    POST /assistant/actions/{id}/reject  -> discard

An agent's mistakes are database writes, not awkward sentences. Putting
a human between the interpretation and the effect means a misread
message costs one click, not a wrong complaint filed against another
resident's flat, and it lets the user see exactly which fields were
extracted before anything happens.

Four checks guard execution, all re-run at CONFIRM time rather than
just at propose time: ownership (only the user it was proposed to can
confirm it), role (re-checked, since it can change between the two
calls), freshness (proposals expire, so a stale one can't be replayed),
and single-use (a confirmed or rejected action is terminal).

Read-only answers come straight back from the existing services and
never create an action at all.
"""

import json
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import announcements as announcements_crud
from app.crud import assistant as crud
from app.schemas.assistant import ActionOut, ChatReply, ProposedActionOut, ToolInfo
from app.schemas.complaint import COMPLAINT_CATEGORIES
from app.services import assistant_intent as intent_engine
from app.services import assistant_nav
from app.services import assistant_reads
from app.services import assistant_tools as tools
from app.services import (
    community_service,
    complaint_service,
    llm_provider,
    payment_service,
    resident_service,
    temple_service,
    visitor_service,
)

# How long a proposal stays confirmable. Long enough to read and think,
# short enough that a forgotten proposal cannot be executed hours later
# against data that has since changed.
PROPOSAL_TTL_MINUTES = 15

_SUGGESTIONS = [
    "Raise a complaint about a leaking tap in A-101",
    "Issue a visitor pass for Ramesh for 3 hours",
    "What is the status of my complaints?",
    "Switch me to dark mode",
]


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _plural(count: int, singular: str, plural: str | None = None) -> str:
    """'1 complaint' / '2 complaints' - this text is read aloud by the UI."""
    return f"{count} {singular if count == 1 else (plural or singular + 's')}"


def _params(action) -> dict:
    try:
        return json.loads(action.params)
    except (TypeError, ValueError):
        return {}


def _to_action_out(action) -> ActionOut:
    return ActionOut(
        action_id=action.action_id,
        tool=action.tool,
        params=_params(action),
        summary=action.summary,
        status=action.status,
        result_ref=action.result_ref,
        error=action.error,
        created_at=action.created_at,
        expires_at=action.expires_at,
        resolved_at=action.resolved_at,
    )


# ── Capability listing ───────────────────────────────────────────────────────

def list_tools(role: str) -> list[ToolInfo]:
    """Only what this role may actually run, so the UI cannot offer a dead button."""
    return [
        ToolInfo(
            tool=name,
            label=meta["label"],
            description=meta["description"],
            required=meta["required"],
            optional=meta["optional"],
        )
        for name, meta in sorted(tools.visible_tools(role).items())
    ]


# ── Read-only answers ────────────────────────────────────────────────────────

def _answer_complaint_status(db: Session, user) -> ChatReply:
    if not user.resident_id:
        return ChatReply(
            kind="answer",
            text="Your login is not linked to a flat yet, so I cannot look up your complaints.",
        )
    history = resident_service.get_complaint_history(db, user.resident_id)
    if not history:
        return ChatReply(kind="answer", text="You have not raised any complaints yet.")

    latest = history[0]
    return ChatReply(
        kind="answer",
        text=(
            f"You have {_plural(len(history), 'complaint')}. The most recent is "
            f"{latest.category} at {latest.location}, currently '{latest.status}'."
        ),
        data={"total": len(history), "latest_status": latest.status},
    )


def _answer_complaint_stats(db: Session) -> ChatReply:
    stats = complaint_service.get_complaint_stats(db)
    return ChatReply(
        kind="answer",
        text=(
            f"There {'is' if stats.total == 1 else 'are'} {_plural(stats.total, 'complaint')} "
            f"on record: {stats.pending} pending, {stats.ongoing} in progress "
            f"and {stats.completed} completed."
        ),
        data={
            "total": stats.total,
            "pending": stats.pending,
            "ongoing": stats.ongoing,
            "completed": stats.completed,
        },
    )


def _answer_visitor_status(db: Session, user) -> ChatReply:
    if not user.resident_id:
        return ChatReply(
            kind="answer",
            text="Your login is not linked to a flat yet, so I cannot look up your visitors.",
        )
    visitors = visitor_service.list_visitors(db, resident_id=user.resident_id)
    on_premises = [v for v in visitors if v.entry_time and not v.exit_time]
    return ChatReply(
        kind="answer",
        text=(
            f"You have {_plural(len(visitors), 'visitor record')}, "
            f"{len(on_premises)} currently on the premises."
        ),
        data={"total": len(visitors), "on_premises": len(on_premises)},
    )


def _answer_my_dues(db: Session, user) -> ChatReply:
    if not user.resident_id:
        return ChatReply(
            kind="answer",
            text="Your login is not linked to a flat yet, so I cannot look up your dues.",
        )
    bills = payment_service.list_bills(db, resident_id=user.resident_id)
    outstanding = [b for b in bills if b.status != "paid"]
    if not outstanding:
        return ChatReply(kind="answer", text="You have no outstanding dues.", data={"outstanding": 0})

    total = sum(float(b.total_amount) for b in outstanding)
    return ChatReply(
        kind="answer",
        text=(
            f"You have {_plural(len(outstanding), 'unpaid bill')} totalling {total:g}. "
            f"The earliest is due {min(b.due_date for b in outstanding)}."
        ),
        data={"outstanding": len(outstanding), "total": total},
        route="/billing",
    )


def _answer_announcements(db: Session) -> ChatReply:
    items = announcements_crud.get_announcements(db, skip=0, limit=3)
    if not items:
        return ChatReply(kind="answer", text="There are no announcements right now.")
    headlines = "; ".join(item.title for item in items)
    return ChatReply(
        kind="answer",
        text=f"Latest {_plural(len(items), 'announcement')}: {headlines}.",
        data={"count": len(items)},
        route="/announcements",
    )


def _answer_community_events(db: Session) -> ChatReply:
    """
    Upcoming society events - the badminton tournaments and health camps,
    not the temple calendar. These live in a different table, so
    answering from the wrong one would silently under-report what the
    events screen actually shows.
    """
    from app.services import event_service

    events = event_service.list_events(db, status_filter="upcoming")
    if not events:
        return ChatReply(
            kind="answer",
            text="There are no society events scheduled at the moment.",
            route="/events",
        )
    listed = "; ".join(
        f"{e.title} on {e.event_date.strftime('%d %b')}" for e in events[:3]
    )
    more = f" and {len(events) - 3} more" if len(events) > 3 else ""
    return ChatReply(
        kind="answer",
        text=f"{_plural(len(events), 'upcoming society event')}: {listed}{more}.",
        data={"upcoming": len(events)},
        route="/events",
    )


def _answer_temple_events(db: Session) -> ChatReply:
    events = temple_service.list_events(db)
    upcoming = [e for e in events if e.status == "upcoming"]
    if not upcoming:
        return ChatReply(kind="answer", text="There are no upcoming temple events listed.")
    return ChatReply(
        kind="answer",
        text=f"{_plural(len(upcoming), 'upcoming temple event')}: {upcoming[0].name}.",
        data={"upcoming": len(upcoming)},
        route="/temple/events",
    )


def _answer_community_activities(db: Session) -> ChatReply:
    activities = community_service.list_activities(db)
    if not activities:
        return ChatReply(kind="answer", text="There are no community activities listed right now.")
    return ChatReply(
        kind="answer",
        text=f"There {'is' if len(activities) == 1 else 'are'} {_plural(len(activities), 'community activity', 'community activities')} listed.",
        data={"count": len(activities)},
        route="/corners",
    )


def _navigate(message: str, role: str) -> ChatReply:
    normalised = intent_engine.normalise(message)
    destination = assistant_nav.match_destination(normalised, role)

    if not destination:
        return ChatReply(
            kind="fallback",
            text="I am not sure which page you mean. Try naming the section, for example 'take me to billing'.",
            suggestions=_SUGGESTIONS,
        )

    return ChatReply(
        kind="navigate",
        text=f"Opening {destination['label']}.",
        destination=destination["destination"],
        route=destination["route"],
        data={"label": destination["label"]},
    )


def _answer_help(role: str) -> ChatReply:
    available = list_tools(role)
    lines = ", ".join(tool.label.lower() for tool in available)
    return ChatReply(
        kind="answer",
        text=f"I can answer questions about your complaints and visitors, and I can {lines}.",
        data={"tools": [tool.tool for tool in available]},
        suggestions=_SUGGESTIONS,
    )


# ── Chat ─────────────────────────────────────────────────────────────────────

# ── Half-finished requests ───────────────────────────────────────────────────
#
# When the assistant asks for a missing detail it has to remember what it was
# doing, otherwise the answer ("A-402") arrives with no idea which request it
# belongs to. The pending tool and whatever was collected so far are held here
# against a conversation id.
#
# This lives in the process, so it is cleared by a restart and is not shared
# between workers. That is acceptable for a half-typed sentence - the user is
# simply asked again - but it is why nothing important is kept here.
_PENDING: dict[str, dict] = {}
_HISTORY: dict[str, list[str]] = {}
_HISTORY_TURNS = 6
_PENDING_TTL = timedelta(minutes=10)
_CANCEL_WORDS = {"cancel", "never mind", "nevermind", "forget it", "stop", "no"}


def _pending_key(user, conversation_id: str) -> str:
    return f"{user.user_id}:{conversation_id}"


def _remember(user, conversation_id: str, tool: str, collected: dict) -> None:
    _PENDING[_pending_key(user, conversation_id)] = {
        "tool": tool,
        "collected": collected,
        "at": datetime.now(timezone.utc).replace(tzinfo=None),
    }


def _recall(user, conversation_id: str | None) -> dict | None:
    if not conversation_id:
        return None
    key = _pending_key(user, conversation_id)
    entry = _PENDING.get(key)
    if not entry:
        return None
    if datetime.now(timezone.utc).replace(tzinfo=None) - entry["at"] > _PENDING_TTL:
        _PENDING.pop(key, None)
        return None
    return entry


def _history(user, conversation_id: str) -> list[str]:
    return _HISTORY.get(_pending_key(user, conversation_id), [])


def _record_turn(user, conversation_id: str, speaker: str, text: str) -> None:
    """Keep a short rolling transcript so follow-ups have something to refer to."""
    key = _pending_key(user, conversation_id)
    turns = _HISTORY.setdefault(key, [])
    turns.append(f"{speaker}: {text}")
    del turns[:-_HISTORY_TURNS]


# Words a sentence opens with when it is asking rather than instructing.
_INTERROGATIVES = (
    "what", "which", "when", "where", "who", "whose", "why", "how",
    "can i", "could i", "do i", "does", "did i", "is there", "are there",
    "have i", "has ", "am i", "should i", "may i", "tell me", "list",
)


def _looks_like_question(raw: str) -> bool:
    """
    Whether the user is asking rather than instructing.

    The intent engine's own marker list is deliberately narrow because it only
    dampens scores. This is a stricter reading used where the difference
    matters - a question must never be filed as a complaint, nor mistaken for
    the answer to one. The raw text is used because normalising strips the
    question mark, which is the clearest signal there is.
    """
    text = raw.strip().lower()
    if text.endswith("?"):
        return True
    if any(text.startswith(word) for word in _INTERROGATIVES):
        return True
    return intent_engine.is_question(intent_engine.normalise(raw))


def _facts_for(db: Session, user) -> str:
    """
    What the assistant may state, read from the application and the database.

    A general question is only worth answering if the answer is true, so this
    gathers the real figures rather than letting a model recall what apartment
    blocks are usually like. Everything here is either defined in the code or
    counted from the tables at the moment of asking.

    Resident names and their phone numbers are deliberately left out: the
    directory screen exists for that and applies its own rules. Society staff
    and gate contacts are included, since those are what residents ring.
    """
    from sqlalchemy import func

    from app.models.complaint import Complaint, Staff
    from app.models.facility import Facility
    from app.models.resident import Flat, Resident
    from app.services.visitor_service import GATE_DESKS

    lines = [
        f"Complaint categories (the only ones accepted): "
        f"{', '.join(COMPLAINT_CATEGORIES)}.",
        "A complaint moves through: submitted, assigned, in_progress, resolved, closed.",
        "Every complaint gets a reference like CMP-2026-0001.",
        f"The person asking has the role: {user.role}.",
        f"Today's date is {datetime.now(timezone.utc).date().isoformat()}.",
        "The assistant never carries out an action until the user confirms it.",
    ]

    try:
        flats = db.query(func.count(Flat.flat_id)).scalar() or 0
        blocks = [b[0] for b in db.query(Flat.block).distinct().all() if b[0]]
        residents = db.query(func.count(Resident.resident_id)).scalar() or 0
        lines.append(
            f"The society has {flats} flats across blocks {', '.join(sorted(blocks))}, "
            f"and {residents} residents on record."
        )
    except Exception:  # noqa: BLE001 - a missing table must not break the answer
        pass

    try:
        facilities = db.query(Facility).all()
        if facilities:
            lines.append(
                "Bookable facilities: "
                + "; ".join(
                    f"{f.name} at {f.location} (up to {f.capacity} per slot)"
                    for f in facilities
                )
                + "."
            )
            lines.append(
                "Every facility uses the same one-hour slots: 06:00 - 07:00, "
                "07:00 - 08:00, 08:00 - 09:00, 17:00 - 18:00, 18:00 - 19:00, "
                "19:00 - 20:00. There are no other opening hours."
            )
    except Exception:  # noqa: BLE001
        pass

    try:
        staff = db.query(Staff).filter(Staff.is_active.is_(True)).all()
        if staff:
            lines.append(
                "Society maintenance staff: "
                + "; ".join(f"{m.name}, {m.role}, {m.phone}" for m in staff if m.phone)
                + "."
            )
    except Exception:  # noqa: BLE001
        pass

    lines.append(
        "Security desks: "
        + "; ".join(
            f"{gate} - {desk['guard']} at {desk['desk']}"
            for gate, desk in GATE_DESKS.items()
        )
        + ". Gate contact numbers are not stored in the system; the gate desk "
        "screen shows who is on duty."
    )

    try:
        mine = db.query(func.count(Complaint.complaint_id)).filter(
            Complaint.raised_by == user.resident_id
        ).scalar() or 0
        lines.append(f"This user has raised {mine} complaints in total.")
    except Exception:  # noqa: BLE001
        pass

    lines.append(
        "Actions this role may ask for: "
        + "; ".join(meta["label"] for meta in tools.visible_tools(user.role).values())
        + "."
    )
    lines.append(
        "Screens available: "
        + ", ".join(d["label"] for d in assistant_nav.visible_destinations(user.role)[:20])
        + "."
    )
    return "\n".join(lines)


def _forget(user, conversation_id: str | None) -> None:
    if conversation_id:
        _PENDING.pop(_pending_key(user, conversation_id), None)


# Params the database constrains to a fixed set. A model will happily answer
# "geyser" or "electrical" for a category; neither is one of ours, and storing
# either would fail at write time - so its answer is matched against these and
# dropped if it does not fit, which leaves the assistant to ask instead.
#
# Read from the schema rather than from CATEGORY_KEYWORDS: the keyword map only
# covers the categories that have recognisable words, so "Other" - which is
# chosen precisely when nothing matches - would never have been offered.
_ALLOWED_VALUES = {
    "category": list(COMPLAINT_CATEGORIES),
}


def _sanitise(params: dict) -> dict:
    """Keep only values the rest of the system will accept."""
    clean = {}
    for field, value in params.items():
        allowed = _ALLOWED_VALUES.get(field)
        if allowed is None:
            clean[field] = value
            continue
        match = next(
            (a for a in allowed if str(value).strip().lower() == a.lower()), None
        )
        if match:
            clean[field] = match
    return clean


# What a plain-English question maps to. The model is told about these in the
# same words, so adding a read intent here is all it takes for the model to be
# able to choose it.
_READ_INTENT_DESCRIPTIONS = {
    "complaint_status": "the state of the complaints this user has raised",
    "complaint_stats": "counts or trends of complaints across the society",
    "visitor_status": "who has visited or is currently on the premises",
    "my_dues": "what this user owes, their bill or outstanding payment",
    "announcements": "recent society announcements or notices",
    "community_events": (
        "upcoming society or community events - socials, tournaments, camps, "
        "celebrations. This is the events calendar residents mean by default"
    ),
    "temple_events": "temple events specifically - poojas, sevas, temple festivals",
    "community_activities": "community activities, clubs or classes",
    "help": "what the assistant itself can do",
}


def _intent_catalogue(role: str) -> list[dict]:
    """
    Describe the assistant's abilities for the model to choose between.

    Built from the tool definitions rather than written out separately, so a
    tool cannot be added, renamed or restricted without the model's list
    changing with it. Only what this role may actually run is offered, so the
    model is never invited to pick something that would be refused.
    """
    catalogue = []
    for name, meta in tools.visible_tools(role).items():
        params = list(meta.get("required", [])) + list(meta.get("optional", []))
        # Spell out the values a constrained param accepts, so the model picks
        # one of ours instead of inventing its own wording.
        described = [
            f"{param} (one of: {', '.join(_ALLOWED_VALUES[param])})"
            if param in _ALLOWED_VALUES else param
            for param in params
        ]
        catalogue.append({
            "name": name,
            "description": meta["label"].lower(),
            "params": params,
            "described_params": described,
        })
    catalogue += [
        {"name": name, "description": description, "params": []}
        for name, description in _READ_INTENT_DESCRIPTIONS.items()
    ]

    # One look-up intent covering everything the API can report, rather than
    # an intent per endpoint. The model picks the topic, which keeps the
    # choice a single decision instead of a hundred near-identical ones.
    topics = assistant_reads.catalogue()
    catalogue.append({
        "name": "look_up",
        "description": (
            "read current information from the system to answer a question "
            "about data the other intents do not cover"
        ),
        "params": ["topic"],
        "described_params": [
            "topic (one of: " + ", ".join(t["topic"] for t in topics) + ")"
        ],
    })

    # Navigation is offered to the model too, so "take me to that page" or a
    # typo like "my latest complain" resolves by meaning rather than by
    # matching a phrase. The destinations are the real ones for this role.
    destinations = [d["destination"] for d in assistant_nav.visible_destinations(role)]
    catalogue.append({
        "name": "navigate",
        "description": "open a screen in the app; the user asked to be taken somewhere",
        "params": ["destination"],
        "described_params": [f"destination (one of: {', '.join(destinations)})"],
    })
    return catalogue


def _describe_missing(missing: list[str]) -> str:
    """
    Name the slots still needed, spelling out the choices for constrained ones.

    "I still need the category" leaves the user guessing; being told the list
    includes "Other" is what stops someone filing a lift fault under Plumbing
    because nothing else looked close.
    """
    return ", ".join(
        f"{field} (one of: {', '.join(_ALLOWED_VALUES[field])})"
        if field in _ALLOWED_VALUES else field
        for field in missing
    )


def _resume(db: Session, user, pending: dict, message: str, conversation_id: str) -> ChatReply | None:
    """
    Fold the user's reply into the request that was waiting on it.

    Returns a reply once the request either completes or still needs
    something, or None if the message clearly starts a new topic - in which
    case the caller carries on and treats it as a fresh request.
    """
    tool = pending["tool"]
    meta = tools.TOOLS[tool]

    # A message that starts something new must not be swallowed as the answer
    # to the previous question. Questions are the common case - asking "have I
    # raised any complaint?" while a complaint is half-filled is a new topic,
    # not a location.
    normalised = intent_engine.normalise(message)
    if _looks_like_question(message) or assistant_nav.is_navigation(normalised):
        _forget(user, conversation_id)
        return None

    fresh_intent, _ = intent_engine.classify(message)
    if fresh_intent != tool and (fresh_intent in tools.TOOLS or fresh_intent in _READ_INTENT_DESCRIPTIONS):
        _forget(user, conversation_id)
        return None

    collected = dict(pending["collected"])
    # Read the reply both as a normal message and as a bare value, since
    # "A-402" on its own carries no verb for the extractor to hang on to.
    for field, value in _sanitise(intent_engine.extract_entities(tool, message)).items():
        collected.setdefault(field, value)
    # Whatever the extractor could not place is taken as the answer to the
    # single field that was asked for - "A-402" is a location when a location
    # is what the assistant just requested.
    for field in meta["required"]:
        if not collected.get(field) and message.strip():
            if field in _ALLOWED_VALUES:
                # A constrained field takes only its known values, so the bare
                # reply is matched against them: "other" becomes "Other", and
                # anything unrecognised leaves the slot empty so the assistant
                # asks again instead of failing at write time.
                match = _sanitise({field: message.strip()}).get(field)
                if match:
                    collected[field] = match
                break
            collected[field] = message.strip()
            break

    missing = [f for f in meta["required"] if not collected.get(f)]
    if missing:
        _remember(user, conversation_id, tool, collected)
        return ChatReply(
            kind="needs_input",
            text=f"Thanks - I still need the {_describe_missing(missing)}.",
            missing=missing,
            data={"tool": tool, "collected": collected},
            conversation_id=conversation_id,
        )

    _forget(user, conversation_id)
    return _propose(db, user, tool, meta, collected, conversation_id)


def chat(db: Session, user, message: str, conversation_id: str | None = None) -> ChatReply:
    """
    Interpret one message. Either answers, asks for a missing slot, refuses on
    role, or proposes an action - but never executes one.
    """
    conversation_id = conversation_id or str(uuid.uuid4())
    _record_turn(user, conversation_id, "user", message)
    pending = _recall(user, conversation_id)

    if pending:
        if intent_engine.normalise(message).strip() in _CANCEL_WORDS:
            _forget(user, conversation_id)
            return ChatReply(
                kind="answer",
                text="Dropped that. Ask me something else whenever you like.",
                conversation_id=conversation_id,
            )
        # The user is answering the question the assistant just asked, so the
        # reply is read as the missing detail rather than as a new request.
        resumed = _resume(db, user, pending, message, conversation_id)
        if resumed is not None:
            return resumed

    # Navigation is checked first and requires an explicit "take me to"-style
    # phrase. Gating it this way means a destination keyword can never steal
    # an action - "raise a complaint" still files one, while "where do I
    # raise a complaint" opens the form.
    # "open " is a navigation trigger, which also appears in "are there any
    # work orders open right now?" - a question about data, not a request to
    # go somewhere. A question only counts as navigation when it asks *where*
    # something is, so the rest fall through to be answered.
    normalised_message = intent_engine.normalise(message)
    directional = any(
        normalised_message.startswith(word)
        for word in ("take me", "go to", "open ", "show me", "navigate", "jump to", "bring up")
    ) or any(w in normalised_message for w in ("where can i", "where do i", "where is", "take me to"))
    if assistant_nav.is_navigation(normalised_message) and (
        directional or not _looks_like_question(message)
    ):
        wayfinding = _navigate(message, user.role)
        if wayfinding.route:
            return wayfinding
        # The phrase names no screen we know. Ask the model, but only about
        # where to go - someone saying "take me to that page" is not asking
        # for a complaint to be raised, so actions are off the table here.
        guess = llm_provider.interpret(
            message,
            [c for c in _intent_catalogue(user.role) if c["name"] not in tools.TOOLS],
            history=_history(user, conversation_id),
        )
        if guess and guess["intent"] == "navigate":
            target = _sanitise(guess["params"]).get("destination") or guess["params"].get("destination")
            match = next(
                (d for d in assistant_nav.visible_destinations(user.role)
                 if d["destination"] == target), None,
            )
            if match:
                _record_turn(user, conversation_id, "assistant", f"Opening {match['label']}.")
                return ChatReply(
                    kind="navigate", text=f"Opening {match['label']}.",
                    destination=match["destination"], route=match["route"],
                    conversation_id=conversation_id, source="llm",
                )
        return wayfinding

    # Understanding is the model's job when one is configured: it reads the
    # sentence and says which intent it is and what details it carries. The
    # keyword classifier is the fallback for when no model is available, and
    # it is why the assistant still works from a clean clone with no key.
    #
    # Either way the answer is only a suggestion - the role check, the missing
    # -slot prompt and the confirmation step below are unchanged, so a
    # misread sentence cannot write anything on its own.
    intent, params_hint, source_hint = None, {}, "rules"
    interpreted = llm_provider.interpret(
        message, _intent_catalogue(user.role), history=_history(user, conversation_id)
    )
    if interpreted:
        intent = interpreted["intent"]
        params_hint = _sanitise(interpreted["params"])
        source_hint = "llm"

    if intent == "look_up":
        topic = params_hint.get("topic")
        payload = assistant_reads.fetch(topic, user) if topic else None
        if payload is not None:
            grounded = llm_provider.answer_from_facts(
                message,
                f"Data from '{topic}':\n{assistant_reads.summarise(payload)}\n\n"
                f"{_facts_for(db, user)}",
            )
            if grounded:
                _record_turn(user, conversation_id, "assistant", grounded)
                return ChatReply(
                    kind="answer", text=grounded,
                    conversation_id=conversation_id, source="llm",
                )
        # Nothing came back - fall through and let the usual paths answer.
        intent = None

    if intent == "navigate":
        target = params_hint.get("destination") or ""
        match = next(
            (d for d in assistant_nav.visible_destinations(user.role)
             if d["destination"] == target),
            None,
        )
        if match:
            return ChatReply(
                kind="navigate",
                text=f"Opening {match['label']}.",
                destination=match["destination"],
                route=match["route"],
                conversation_id=conversation_id,
                source="llm",
            )
        # The model named somewhere that does not exist for this role; the
        # keyword matcher below gets its turn instead of guessing.
        intent = None

    if intent is None:
        intent, _confidence = intent_engine.classify(message)
        # "What categories can I raise?" contains "complaint", which is enough
        # for the keyword classifier to propose filing one. When the message
        # is plainly a question, that guess is discarded so it reaches the
        # grounded answer below instead.
        if intent in tools.TOOLS and _looks_like_question(message):
            intent = "fallback"

    if intent == "fallback":
        # Before giving up, let the model answer from what the system knows.
        # It is told to refuse anything the facts do not cover, so an unknown
        # question still ends at the suggestions below rather than a guess.
        grounded = llm_provider.answer_from_facts(message, _facts_for(db, user))
        if grounded:
            _record_turn(user, conversation_id, "assistant", grounded)
            return ChatReply(
                kind="answer", text=grounded,
                conversation_id=conversation_id, source="llm",
            )
        return ChatReply(
            kind="fallback",
            text="I did not understand that. Here are some things I can help with.",
            suggestions=_SUGGESTIONS,
            conversation_id=conversation_id,
        )

    if intent == "help":
        return _answer_help(user.role)
    if intent == "complaint_status":
        return _answer_complaint_status(db, user)
    if intent == "complaint_stats":
        return _answer_complaint_stats(db)
    if intent == "visitor_status":
        return _answer_visitor_status(db, user)
    if intent == "my_dues":
        return _answer_my_dues(db, user)
    if intent == "announcements":
        return _answer_announcements(db)
    if intent == "community_events":
        return _answer_community_events(db)
    if intent == "temple_events":
        return _answer_temple_events(db)
    if intent == "community_activities":
        return _answer_community_activities(db)

    # ── Action intents ───────────────────────────────────────────────────────
    meta = tools.TOOLS[intent]

    if not tools.may_run(intent, user.role):
        return ChatReply(
            kind="refusal",
            text=(
                f"'{meta['label']}' is restricted to {', '.join(meta['roles'])}. "
                f"Your role is {user.role}."
            ),
        )

    if meta["needs_resident"] and not user.resident_id:
        return ChatReply(
            kind="refusal",
            text=(
                f"'{meta['label']}' acts on your flat, but your login is not linked "
                "to a resident record yet."
            ),
        )

    params = intent_engine.extract_entities(intent, message)
    # The model's reading wins where it found something, since it understands
    # phrasing the patterns were never written for; the extractor fills the
    # rest so a configured model never makes the assistant worse.
    for field, value in params_hint.items():
        if value:
            params[field] = value
    missing = [field for field in meta["required"] if not params.get(field)]
    if missing:
        _remember(user, conversation_id, intent, params)
        return ChatReply(
            kind="needs_input",
            text=f"I can do that - I just need the {_describe_missing(missing)} first.",
            missing=missing,
            data={"tool": intent, "collected": params},
            conversation_id=conversation_id,
        )

    return _propose(db, user, intent, meta, params, conversation_id)


def _propose(db: Session, user, intent: str, meta: dict, params: dict,
             conversation_id: str | None = None) -> ChatReply:
    """Record a proposed action and describe it back for confirmation."""
    summary, provider_source = llm_provider.rephrase(_propose_summary(intent, meta, params))
    # llm_provider speaks in "template"/"llm"; a chat reply's deterministic
    # path is the rules engine, so the vocabularies are mapped here rather
    # than leaking the analytics layer's wording into this API.
    source = "llm" if provider_source == "llm" else "rules"
    action = crud.create_action(
        db,
        user_id=user.user_id,
        tool=intent,
        params=params,
        summary=summary,
        expires_at=_utcnow() + timedelta(minutes=PROPOSAL_TTL_MINUTES),
    )
    db.commit()
    db.refresh(action)

    return ChatReply(
        kind="proposal",
        text=f"{summary} Confirm to go ahead.",
        action=ProposedActionOut(
            action_id=action.action_id,
            tool=action.tool,
            label=meta["label"],
            params=params,
            summary=action.summary,
            status=action.status,
            expires_at=action.expires_at,
        ),
        conversation_id=conversation_id,
        source=source,
    )


def _propose_summary(tool: str, meta: dict, params: dict) -> str:
    """Deterministic description of the pending action, in the user's terms."""
    if tool == "raise_complaint":
        return f"I will raise a {params['category']} complaint for {params['location']}."
    if tool == "issue_visitor_pass":
        hours = params.get("hours", tools.DEFAULT_PASS_HOURS)
        return f"I will issue a visitor pass for {params['visitor_name']}, valid {hours} hours."
    if tool == "mark_staff_attendance":
        return f"I will record attendance as {params['status']} for staff {params['staff_id']}."
    if tool == "set_preference":
        changes = ", ".join(f"{key} to {value}" for key, value in sorted(params.items()))
        return f"I will change your {changes or 'preferences'}."
    if tool == "record_donation":
        return (
            f"I will record a donation of {params['amount']} "
            f"for {params.get('purpose', 'general')}."
        )
    if tool == "signup_for_activity":
        return f"I will sign you up for activity {params['activity_id']}."
    return f"I will {meta['label'].lower()}."


# ── Confirm / reject ─────────────────────────────────────────────────────────

def _load_own_action(db: Session, action_id: str, user):
    action = crud.get_action(db, action_id)
    if not action:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Action '{action_id}' not found.",
        )
    # Checked before anything else is revealed, so one user cannot probe
    # another's pending actions by guessing ids.
    if action.user_id != user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This action was not proposed to you.",
        )
    return action


def confirm_action(db: Session, action_id: str, user) -> ActionOut:
    """
    Execute a proposed action.

    Errors:
      403 - the action belongs to someone else, or the caller's role may no
            longer run this tool
      404 - no such action
      409 - already confirmed or rejected
      410 - the proposal expired
    """
    action = _load_own_action(db, action_id, user)

    if action.status != "proposed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Action '{action_id}' has already been {action.status}.",
        )

    if action.expires_at < _utcnow():
        action.status = "expired"
        action.resolved_at = _utcnow()
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail=f"Action '{action_id}' expired. Please ask again.",
        )

    # Re-checked here rather than trusting the propose-time decision: a role
    # can be changed between the two requests.
    if not tools.may_run(action.tool, user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your role ({user.role}) may no longer run '{action.tool}'.",
        )

    meta = tools.TOOLS[action.tool]
    try:
        result_ref, confirmation = meta["executor"](db, user, _params(action))
    except HTTPException as exc:
        # The owning service refused (validation, conflict, ...). Record why
        # and surface its own message rather than inventing one.
        action.status = "rejected"
        action.error = str(exc.detail)
        action.resolved_at = _utcnow()
        db.commit()
        raise

    action.status = "confirmed"
    action.result_ref = result_ref
    action.summary = confirmation
    action.resolved_at = _utcnow()
    db.commit()
    db.refresh(action)
    return _to_action_out(action)


def reject_action(db: Session, action_id: str, user) -> ActionOut:
    """Discard a proposal without running it."""
    action = _load_own_action(db, action_id, user)

    if action.status != "proposed":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Action '{action_id}' has already been {action.status}.",
        )

    action.status = "rejected"
    action.resolved_at = _utcnow()
    db.commit()
    db.refresh(action)
    return _to_action_out(action)


def list_actions(
    db: Session, user, status_filter: str | None = None, skip: int = 0, limit: int = 50
) -> list[ActionOut]:
    """The caller's own action history - the assistant's audit trail."""
    rows = crud.list_actions(db, user.user_id, status=status_filter, skip=skip, limit=limit)
    return [_to_action_out(row) for row in rows]
