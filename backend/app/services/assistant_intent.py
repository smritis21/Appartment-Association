"""Deterministic intent engine for the agentic assistant (BE-42).

Mirrors the local engine the frontend prototype already ships
(apartment-app/src/features/assistant/engine/localEngine.js): normalise
the text, score it against keyword sets, then pull entities out of it.

This layer decides which database write is about to be proposed, so
that decision stays rule-based rather than model-based: the behaviour
is identical with no API key as with a local model, and it can be
unit-tested exactly. A configured LLM only rewords replies and catches
phrasings these rules miss - it never widens the action set, since that
set lives in assistant_tools.TOOLS.
"""

import re

# Intents that perform an action map to a tool in assistant_tools.TOOLS.
# Read-only intents answer from data and propose nothing.
ACTION_INTENTS = {
    "raise_complaint": {
        # "raise/file/report a complaint", plus the bare-symptom phrasings
        # residents actually use ("tap is leaking", "no water"). Stems are
        # preferred over exact words - "leak" catches leak/leaks/leaking/
        # leakage - and no keyword may be a substring of another here, or
        # a single sentence scores the same signal twice and outranks a
        # better-matching intent.
        "keywords": [
            "complaint", "raise a", "report a", "file a",
            "broken", "not working", "not coming", "leak", "drip",
            "no water", "no power", "fused", "blocked", "clogged",
            "stuck", "jammed", "damage", "overflowing", "smell",
            "noisy", "noise", "flicker", "spark", "burst", "seepage",
            "tripping", "short circuit", "choked", "faulty",
            "cut off", "issue with", "problem with", "repair",
        ],
        "weight": 1.0,
    },
    "issue_visitor_pass": {
        "keywords": [
            "visitor pass", "guest pass", "gate pass", "pass for",
            "visitor", "guest", "coming over", "expecting", "delivery",
        ],
        "weight": 1.0,
    },
    "mark_staff_attendance": {
        "keywords": ["attendance", "mark present", "mark absent", "on leave", "did not come"],
        "weight": 1.2,
    },
    "set_preference": {
        "keywords": ["dark mode", "light mode", "theme", "language", "preference", "settings"],
        "weight": 1.2,
    },
    "record_donation": {
        "keywords": ["donate", "donation", "offering", "contribute"],
        "weight": 1.2,
    },
    "signup_for_activity": {
        "keywords": ["sign me up", "sign up for", "register for", "join the", "participate"],
        "weight": 1.2,
    },
}

READ_INTENTS = {
    "complaint_status": {
        "keywords": ["my complaint", "complaint status", "status of my", "any update", "track my"],
        "weight": 1.1,
    },
    "visitor_status": {
        "keywords": ["who visited", "visitor log", "visitors today", "on premises", "my visitors"],
        "weight": 1.1,
    },
    "complaint_stats": {
        "keywords": ["how many complaints", "complaint stats", "complaint summary", "trend"],
        "weight": 1.1,
    },
    "my_dues": {
        "keywords": ["my dues", "my bill", "how much do i owe", "outstanding", "pending payment", "maintenance due"],
        "weight": 1.1,
    },
    "announcements": {
        "keywords": ["announcement", "any notice", "latest notice", "whats new", "what is new"],
        "weight": 1.1,
    },
    "temple_events": {
        "keywords": ["temple event", "upcoming pooja", "upcoming puja", "festival"],
        "weight": 1.1,
    },
    "community_activities": {
        "keywords": ["community activity", "activities", "clubs", "classes"],
        "weight": 1.1,
    },
    "community_events": {
        # Bare "event" belongs here, not with the temple calendar: a resident
        # asking "what events are coming up" means the society's.
        "keywords": ["event", "events", "whats happening", "what is happening",
                     "tournament", "celebration"],
        "weight": 1.1,
    },
    "help": {
        "keywords": ["help", "what can you do", "commands", "capabilities"],
        "weight": 1.0,
    },
}

ALL_INTENTS = {**ACTION_INTENTS, **READ_INTENTS}

# A query must clear this to count as understood; anything lower is a
# fallback, which is safer than guessing at an action.
MIN_CONFIDENCE = 1.0

# Phrases that mark a sentence as a question rather than an instruction.
# "How many complaints are there?" mentions complaints but is emphatically
# not a request to file one, so action intents are damped when one of these
# is present. Getting this wrong is asymmetric: mistaking a question for a
# command proposes a database write, while the reverse just answers.
QUESTION_MARKERS = [
    "how many", "how much", "what is", "what are", "whats", "status of",
    "any update", "do i have", "show me", "list ", "when is", "who is",
    "can you tell", "tell me",
]
QUESTION_ACTION_PENALTY = 0.4

# How people describe a problem, mapped to the category it belongs to. The
# value on the left is what gets sent to the API. This covers the categories
# that have recognisable words; "Other" is deliberately absent, since it is
# what a complaint gets when nothing here matches and there is no phrase that
# reliably means it. The authoritative list of accepted values is
# app.schemas.complaint.COMPLAINT_CATEGORIES.
CATEGORY_KEYWORDS = {
    "Plumbing": ["tap", "water", "leak", "leaking", "dripping", "pipe", "drain", "toilet", "flush", "plumb",
                 "geyser", "seepage", "sewage", "commode", "basin", "shower", "sink", "tank leak"],
    "Electrical": ["light", "power", "electric", "socket", "switch", "fuse", "wiring", "current", "bulb",
                   "spark", "flicker", "mcb", "meter", "inverter", "short circuit", "fan", "wire"],
    "Security": ["security", "guard", "theft", "intruder", "gate", "cctv", "camera", "stolen"],
    "Water Supply": ["no water", "water supply", "tanker", "borewell", "water pressure", "pump", "motor",
                     "overhead tank", "supply cut"],
    "Lift Maintenance": ["lift", "elevator", "lift stuck"],
}

ATTENDANCE_KEYWORDS = {
    "present": ["present", "came", "turned up", "on duty"],
    "absent": ["absent", "did not come", "didn't come", "no show", "missing"],
    "on_leave": ["leave", "on leave", "off today"],
    "half_day": ["half day", "half-day"],
}

THEME_KEYWORDS = {"dark": ["dark"], "light": ["light"]}
LANGUAGE_KEYWORDS = {"en": ["english"], "hi": ["hindi"], "ta": ["tamil"]}

# Matches the BE-33 DonationPurpose literal exactly.
DONATION_PURPOSES = {
    "annadanam": ["annadanam", "anna danam", "food donation"],
    "festival": ["festival", "utsav"],
    "renovation": ["renovation", "repair fund", "construction"],
    "general": ["general"],
}

# Flat identifiers like "A-101", "B 204", "A101".
_FLAT_PATTERN = re.compile(r"\b([a-z])\s*-?\s*(\d{3})\b", re.IGNORECASE)
_HOURS_PATTERN = re.compile(r"\b(\d{1,2})\s*(?:hour|hours|hrs|hr)\b", re.IGNORECASE)
# "500", "1,000", "rs 500", "₹500" - the currency marker is optional because
# people mostly just say the number.
_AMOUNT_PATTERN = re.compile(r"(?:rs\.?\s*|₹\s*)?\b(\d{1,3}(?:,\d{3})+|\d+)\b", re.IGNORECASE)
# "pass for Ramesh", "visitor Ramesh Kumar is coming"
_NAME_AFTER_FOR = re.compile(r"\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)")
# Staff are referred to by their UUID (the id a manager copies out of the
# staff list). Names are deliberately NOT resolved here: two people can share
# a name, and picking the wrong one would silently mark the wrong person's
# attendance - the confirm step cannot catch what the user never sees.
_UUID_PATTERN = re.compile(
    r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.IGNORECASE
)


def normalise(text: str) -> str:
    """Lower-case and strip punctuation, keeping digits and hyphens."""
    return re.sub(r"[^a-z0-9\s-]", " ", text.lower()).strip()


def _score(normalised: str, spec: dict) -> float:
    hits = sum(1 for keyword in spec["keywords"] if keyword in normalised)
    return hits * spec["weight"]


def is_question(normalised: str) -> bool:
    return any(marker in normalised for marker in QUESTION_MARKERS)


def classify(message: str) -> tuple[str, float]:
    """
    Return (intent, confidence). Falls back to "fallback" below MIN_CONFIDENCE
    rather than guessing - proposing the wrong database write is worse than
    admitting the question was not understood.
    """
    normalised = normalise(message)
    scores = {name: _score(normalised, spec) for name, spec in ALL_INTENTS.items()}

    if is_question(normalised):
        for name in ACTION_INTENTS:
            scores[name] *= QUESTION_ACTION_PENALTY

    best = max(scores, key=scores.get)

    if scores[best] < MIN_CONFIDENCE:
        return "fallback", scores[best]
    return best, scores[best]


def _match_keyword_map(normalised: str, mapping: dict[str, list[str]]) -> str | None:
    """First value whose keywords appear, longest keyword first so that
    'no water' beats a bare 'water'."""
    best_value, best_length = None, 0
    for value, keywords in mapping.items():
        for keyword in keywords:
            if keyword in normalised and len(keyword) > best_length:
                best_value, best_length = value, len(keyword)
    return best_value


def extract_flat(message: str) -> str | None:
    match = _FLAT_PATTERN.search(message)
    if not match:
        return None
    return f"{match.group(1).upper()}-{match.group(2)}"


def extract_entities(intent: str, message: str) -> dict:
    """
    Pull whatever slots this intent needs out of the sentence. Anything not
    found is simply absent, and the service layer turns that into a
    slot-filling question rather than a guess.
    """
    normalised = normalise(message)
    entities: dict = {}

    if intent == "raise_complaint":
        category = _match_keyword_map(normalised, CATEGORY_KEYWORDS)
        if category:
            entities["category"] = category
        flat = extract_flat(message)
        if flat:
            entities["location"] = flat
        # The complaint text is the user's own sentence - never paraphrased,
        # so the record says what the resident actually reported.
        entities["description"] = message.strip()

    elif intent == "issue_visitor_pass":
        name = _NAME_AFTER_FOR.search(message)
        if name:
            entities["visitor_name"] = name.group(1).strip()
        hours = _HOURS_PATTERN.search(message)
        if hours:
            entities["hours"] = int(hours.group(1))
        if "delivery" in normalised:
            entities["purpose"] = "Delivery"

    elif intent == "mark_staff_attendance":
        status = _match_keyword_map(normalised, ATTENDANCE_KEYWORDS)
        if status:
            entities["status"] = status
        staff_id = _UUID_PATTERN.search(message)
        if staff_id:
            entities["staff_id"] = staff_id.group(0)

    elif intent == "set_preference":
        theme = _match_keyword_map(normalised, THEME_KEYWORDS)
        if theme:
            entities["theme"] = theme
        language = _match_keyword_map(normalised, LANGUAGE_KEYWORDS)
        if language:
            entities["language"] = language

    elif intent == "record_donation":
        amount = _AMOUNT_PATTERN.search(message)
        if amount:
            entities["amount"] = amount.group(1).replace(",", "")
        purpose = _match_keyword_map(normalised, DONATION_PURPOSES)
        if purpose:
            entities["purpose"] = purpose

    elif intent == "signup_for_activity":
        activity_id = _UUID_PATTERN.search(message)
        if activity_id:
            entities["activity_id"] = activity_id.group(0)

    return entities
