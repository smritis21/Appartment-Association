"""
Tool registry for the agentic assistant (BE-42).

This is the assistant's entire capability surface. It is a closed set,
declared here in Python - never derived from a model's output. That is the
core safety property of the design: an LLM (when one is configured at all)
can help decide *which* of these tools fits a sentence, but it cannot
invent a tool, reach a service that is not listed here, or widen its own
permissions.

Each tool declares:
  label / description  - shown by GET /assistant/tools, so the API is
                         self-describing in the same way the analytics
                         metric registry is
  roles                - who may run it; None means any authenticated user
  required             - parameters that must be filled before the action
                         can even be proposed (drives slot-filling)
  executor             - a function (db, user, params) that calls an
                         existing, already-tested service

No executor contains business logic of its own. Every one delegates to the
module that owns the operation, so the assistant can never enforce a
different rule than the REST endpoint for the same action.
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.schemas.community import ActivitySignupCreate
from app.schemas.complaint import ComplaintCreate
from app.schemas.settings import PreferenceUpdate
from app.schemas.shift import AttendanceCreate
from app.schemas.temple import TempleDonationCreate
from app.schemas.visitor import VisitorPassCreate
from app.services import (
    community_service,
    complaint_service,
    settings_service,
    shift_service,
    temple_service,
    visitor_service,
)

# Management roles, matching the vocabulary already used by
# routers/maintenance.py and routers/onboarding.py.
_MANAGEMENT = ("admin", "president", "secretary")

# How long a visitor pass raised through the assistant stays valid when the
# resident does not say otherwise.
DEFAULT_PASS_HOURS = 6


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


# ── Executors ────────────────────────────────────────────────────────────────
# Each returns (result_reference, confirmation_sentence).

def _raise_complaint(db, user, params) -> tuple[str, str]:
    complaint = complaint_service.create_complaint(
        db,
        ComplaintCreate(
            category=params["category"],
            description=params["description"],
            location=params["location"],
            # Identity comes from the authenticated session, never from the
            # chat message - a user cannot file a complaint as someone else.
            raised_by=user.resident_id,
        ),
    )
    return complaint.complaint_id, (
        f"Complaint raised under {complaint.category} for {complaint.location}."
    )


def _issue_visitor_pass(db, user, params) -> tuple[str, str]:
    hours = int(params.get("hours") or DEFAULT_PASS_HOURS)
    now = _utcnow()
    visitor = visitor_service.issue_pass(
        db,
        VisitorPassCreate(
            visitor_name=params["visitor_name"],
            purpose=params.get("purpose"),
            # The pass is always issued for the caller's own flat.
            resident_id=user.resident_id,
            valid_from=now,
            valid_until=now + timedelta(hours=hours),
        ),
    )
    return visitor.visitor_id, (
        f"Pass {visitor.pass_code} issued for {visitor.visitor_name}, valid {hours} hours."
    )


def _book_facility(db, user, params) -> tuple[str, str]:
    """
    Reserve a facility slot for the caller's own flat.

    The facility is named in plain English ("the gym"), so it is matched
    against what the society actually has rather than trusted as an id. The
    booking service enforces the rest - a real slot, a future date, and the
    capacity for that hour.
    """
    from datetime import date as _date

    from app.models.facility import Facility
    from app.schemas.facility import FacilityBookingCreate
    from app.services import facility_service

    wanted = str(params.get("facility") or "").strip().lower()
    facilities = db.query(Facility).all()
    match = next((f for f in facilities if f.name.lower() == wanted), None)
    if match is None:
        # "gym" should find "Gymnasium"; a word in common is enough here
        # because the list is short and the user confirms before anything
        # is booked.
        match = next((f for f in facilities if wanted and wanted in f.name.lower()), None)
    if match is None:
        raise ValueError(
            "I could not find that facility. We have: "
            + ", ".join(f.name for f in facilities) + "."
        )

    booking_date = params.get("booking_date")
    if isinstance(booking_date, str):
        booking_date = _date.fromisoformat(booking_date)

    booking = facility_service.create_booking(
        db,
        match.facility_id,
        FacilityBookingCreate(
            resident_id=user.resident_id,
            booking_date=booking_date,
            slot=params["slot"],
        ),
    )
    return booking.booking_id, (
        f"{match.name} booked for {booking.booking_date.isoformat()}, slot {booking.slot}."
    )


def _mark_staff_attendance(db, user, params) -> tuple[str, str]:
    record = shift_service.mark_attendance(
        db,
        AttendanceCreate(
            staff_id=params["staff_id"],
            attendance_date=params.get("attendance_date") or _utcnow().date(),
            status=params["status"],
        ),
    )
    return record.attendance_id, (
        f"Attendance recorded as {record.status} for {record.attendance_date}."
    )


def _record_donation(db, user, params) -> tuple[str, str]:
    donation = temple_service.create_donation(
        db,
        TempleDonationCreate(
            resident_id=user.resident_id,
            amount=Decimal(str(params["amount"])),
            purpose=params.get("purpose") or "general",
        ),
    )
    return donation.donation_id, (
        f"Donation of {donation.amount} recorded for {donation.purpose}."
    )


def _signup_for_activity(db, user, params) -> tuple[str, str]:
    signup = community_service.create_signup(
        db,
        params["activity_id"],
        ActivitySignupCreate(resident_id=user.resident_id),
    )
    return signup.signup_id, "You have been signed up for the activity."


def _set_preference(db, user, params) -> tuple[str, str]:
    update = PreferenceUpdate(**{key: params[key] for key in ("theme", "language") if key in params})
    preference = settings_service.update_preferences(db, user.user_id, update)
    return user.user_id, f"Preferences updated (theme {preference.theme}, language {preference.language})."


# ── Registry ─────────────────────────────────────────────────────────────────

TOOLS: dict[str, dict] = {
    "raise_complaint": {
        "label": "Raise a complaint",
        "description": "Files a complaint against your flat in the submitted state (BE-01).",
        "roles": None,
        "required": ["category", "description", "location"],
        "optional": [],
        "needs_resident": True,
        "executor": _raise_complaint,
    },
    "issue_visitor_pass": {
        "label": "Issue a visitor pass",
        "description": (
            "Issues a pre-authorised, single-use visitor pass for your flat (BE-25). "
            f"Valid for {DEFAULT_PASS_HOURS} hours unless you say otherwise."
        ),
        "roles": None,
        "required": ["visitor_name"],
        "optional": ["purpose", "hours"],
        "needs_resident": True,
        "executor": _issue_visitor_pass,
    },
    "book_facility": {
        "label": "Book a facility",
        "description": (
            "Reserves a slot at one of the society's facilities for your flat "
            "(BE-32). Slots are one hour, 06:00-09:00 and 17:00-20:00."
        ),
        "roles": None,
        "required": ["facility", "booking_date", "slot"],
        "optional": [],
        "needs_resident": True,
        "executor": _book_facility,
    },
    "mark_staff_attendance": {
        "label": "Record staff attendance",
        "description": "Records a staff member's attendance for today (BE-35). Management only.",
        "roles": _MANAGEMENT,
        "required": ["staff_id", "status"],
        "optional": ["attendance_date"],
        "needs_resident": False,
        "executor": _mark_staff_attendance,
    },
    "set_preference": {
        "label": "Change your preferences",
        "description": "Updates your own notification, theme or language preferences (BE-40).",
        "roles": None,
        "required": [],
        "optional": ["theme", "language"],
        "needs_resident": False,
        "executor": _set_preference,
    },
    "record_donation": {
        "label": "Record a temple donation",
        "description": "Records a temple donation against your name (BE-33).",
        "roles": None,
        "required": ["amount"],
        "optional": ["purpose"],
        "needs_resident": True,
        "executor": _record_donation,
    },
    "signup_for_activity": {
        "label": "Sign up for a community activity",
        "description": "Signs you up for a community activity by its id (BE-34).",
        "roles": None,
        "required": ["activity_id"],
        "optional": [],
        "needs_resident": True,
        "executor": _signup_for_activity,
    },
}


def visible_tools(role: str) -> dict[str, dict]:
    """Only the tools this role is allowed to run."""
    return {
        name: meta
        for name, meta in TOOLS.items()
        if meta["roles"] is None or role in meta["roles"]
    }


def may_run(tool: str, role: str) -> bool:
    meta = TOOLS.get(tool)
    if meta is None:
        return False
    return meta["roles"] is None or role in meta["roles"]
