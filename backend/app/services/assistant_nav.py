"""Navigation registry for the agentic assistant (BE-42).

"Take me to where I can donate" is answered by returning a route the
client can push, rather than trying to run a multi-step form over chat.
A mis-routed navigation is cheap to recover from (the user just presses
back), which is why this destination list is broad while the action
registry in assistant_tools.py stays deliberately small.

Each entry carries a stable `destination` key and a `route`. The key is
the contract - it never changes, and a client maps it to whatever path
it currently uses; `route` is just a convenience default so the API
works straight from Swagger. Routes belong to the frontend, not this
service, so renaming one there is a client-side fix, not a backend
release.

The routes here mirror apartment-app/src/routes/AppRoutes.jsx.
tests/test_be42_assistant.py parses that file and fails if a route below
has been renamed away, so the two cannot drift silently. That check
lives in the test rather than here because importing this module must
never depend on the frontend tree being on disk.
"""

# Management-only destinations. The frontend enforces its own route guards;
# filtering here just avoids offering a resident a door they cannot open.
_MANAGEMENT = ("admin", "president", "secretary")

# Ordered longest-phrase-first at match time, so "raise a complaint" beats a
# bare "complaint" and lands on the form rather than the list.
DESTINATIONS: list[dict] = [
    # Temple
    {"destination": "temple_donate", "route": "/temple/donate", "label": "Temple donations", "keywords": ["donate", "donation", "offering"]},
    {"destination": "temple_book", "route": "/temple/book", "label": "Book a seva", "keywords": ["book a seva", "seva", "pooja", "puja", "archana"]},
    {"destination": "temple_events", "route": "/temple/events", "label": "Temple events", "keywords": ["temple event", "festival"]},
    {"destination": "temple", "route": "/temple", "label": "Temple", "keywords": ["temple"]},

    # Complaints
    {"destination": "complaints_new", "route": "/complaints/new", "label": "Raise a complaint", "keywords": ["raise a complaint", "new complaint", "file a complaint", "report a problem"]},
    {"destination": "complaints_feedback", "route": "/complaints/feedback", "label": "Complaint feedback", "keywords": ["complaint feedback", "rate a complaint"]},
    {"destination": "complaints_monitoring", "route": "/complaints/monitoring", "label": "Complaint monitoring", "keywords": ["complaint monitoring"], "roles": _MANAGEMENT},
    {"destination": "complaints_assign", "route": "/complaints/assign", "label": "Assign complaints", "keywords": ["assign complaint"], "roles": _MANAGEMENT},
    {"destination": "complaints_reports", "route": "/complaints/reports", "label": "Complaint reports", "keywords": ["complaint report"], "roles": _MANAGEMENT},
    {"destination": "complaints", "route": "/complaints", "label": "Complaints", "keywords": ["complaint", "complaints"]},

    # Payments & billing
    {"destination": "payments_history", "route": "/payments/history", "label": "Payment history", "keywords": ["payment history", "past payments", "receipts"]},
    {"destination": "payments", "route": "/payments", "label": "Payments", "keywords": ["pay my", "make a payment", "payment", "pay dues"]},
    {"destination": "billing_generate", "route": "/billing/generate", "label": "Generate bills", "keywords": ["generate bill"], "roles": _MANAGEMENT},
    {"destination": "billing", "route": "/billing", "label": "Billing", "keywords": ["billing", "my bill", "bills", "dues", "invoice"]},
    {"destination": "reminders", "route": "/reminders", "label": "Payment reminders", "keywords": ["reminder"]},

    # Visitors
    {"destination": "visitors_passes", "route": "/visitors/passes", "label": "Visitor passes", "keywords": ["visitor pass", "guest pass", "gate pass"]},
    {"destination": "visitors_approvals", "route": "/visitors/approvals", "label": "Visitor approvals", "keywords": ["visitor approval", "approve a visitor"]},
    {"destination": "visitors_gate", "route": "/visitors/gate", "label": "Gate desk", "keywords": ["gate desk", "gate"]},

    # Maintenance & workforce
    {"destination": "maintenance_work_orders", "route": "/maintenance/work-orders", "label": "Work orders", "keywords": ["work order"]},
    {"destination": "maintenance_calendar", "route": "/maintenance/calendar", "label": "Maintenance calendar", "keywords": ["maintenance calendar"]},
    {"destination": "maintenance_schedule", "route": "/maintenance/schedule", "label": "Maintenance schedule", "keywords": ["maintenance schedule", "schedule maintenance"]},
    {"destination": "maintenance_assets", "route": "/maintenance/assets", "label": "Assets", "keywords": ["asset"]},
    {"destination": "maintenance_workload", "route": "/maintenance/workload", "label": "Staff workload", "keywords": ["workload"], "roles": _MANAGEMENT},
    {"destination": "workforce_services", "route": "/workforce/services", "label": "Book house help", "keywords": ["house help", "maid", "cook", "driver", "book help"]},
    {"destination": "workforce_attendance", "route": "/workforce/attendance", "label": "Workforce attendance", "keywords": ["workforce attendance"], "roles": _MANAGEMENT},
    {"destination": "workforce", "route": "/workforce", "label": "Workforce", "keywords": ["workforce"]},
    {"destination": "staffing_attendance", "route": "/staffing/attendance", "label": "Staff attendance", "keywords": ["staff attendance", "mark attendance"], "roles": _MANAGEMENT},
    {"destination": "staffing_roster", "route": "/staffing/roster", "label": "Staff roster", "keywords": ["roster", "shift"], "roles": _MANAGEMENT},

    # Community
    {"destination": "facilities_bookings", "route": "/facilities/bookings", "label": "My facility bookings", "keywords": ["my booking", "facility booking"]},
    {"destination": "facilities", "route": "/facilities", "label": "Facilities", "keywords": ["facility", "clubhouse", "gym", "pool", "hall"]},
    {"destination": "events", "route": "/events", "label": "Events", "keywords": ["event"]},
    {"destination": "corners", "route": "/corners", "label": "Community corners", "keywords": ["community corner", "corner"]},
    {"destination": "forum", "route": "/forum", "label": "Discussion forum", "keywords": ["forum", "discussion"]},
    {"destination": "marketplace", "route": "/marketplace", "label": "Marketplace", "keywords": ["marketplace", "buy", "sell", "classifieds"]},

    # Information
    {"destination": "announcements", "route": "/announcements", "label": "Announcements", "keywords": ["announcement", "notice"]},
    {"destination": "notifications", "route": "/notifications", "label": "Notifications", "keywords": ["notification"]},
    {"destination": "directory", "route": "/directory", "label": "Resident directory", "keywords": ["directory", "contact", "phone number", "who lives"]},
    {"destination": "documents_upload", "route": "/documents/upload", "label": "Upload a document", "keywords": ["upload a document", "upload document"]},
    {"destination": "documents", "route": "/documents", "label": "Documents", "keywords": ["document", "bylaw", "policy"]},
    {"destination": "analytics", "route": "/analytics", "label": "Analytics", "keywords": ["analytics", "insight", "dashboard stats"]},
    {"destination": "communication_emergency", "route": "/communication/emergency", "label": "Emergency broadcast", "keywords": ["emergency alert", "emergency broadcast"], "roles": _MANAGEMENT},
    {"destination": "communication", "route": "/communication", "label": "Communication", "keywords": ["circular", "poll", "survey"]},
    {"destination": "audit", "route": "/audit", "label": "Audit log", "keywords": ["audit"], "roles": _MANAGEMENT},
    {"destination": "residents", "route": "/residents", "label": "Residents", "keywords": ["resident"], "roles": _MANAGEMENT},
    {"destination": "onboarding_approval_queue", "route": "/onboarding/approval-queue", "label": "Onboarding approvals", "keywords": ["approval queue", "onboarding approval"], "roles": _MANAGEMENT},
    {"destination": "onboarding", "route": "/onboarding", "label": "Onboarding", "keywords": ["onboarding", "kyc"]},

    # Personal
    {"destination": "settings_appearance", "route": "/settings/appearance", "label": "Appearance settings", "keywords": ["appearance", "dark mode", "theme"]},
    {"destination": "settings_notifications", "route": "/settings/notifications", "label": "Notification settings", "keywords": ["notification settings"]},
    {"destination": "settings_security", "route": "/settings/security", "label": "Security settings", "keywords": ["security settings", "change password"]},
    {"destination": "settings_apartment", "route": "/settings/apartment", "label": "Apartment configuration", "keywords": ["apartment config", "society settings"], "roles": _MANAGEMENT},
    {"destination": "settings", "route": "/settings", "label": "Settings", "keywords": ["settings", "preference"]},
    {"destination": "profile", "route": "/profile", "label": "My profile", "keywords": ["my profile", "profile"]},
    {"destination": "dashboard", "route": "/dashboard", "label": "Dashboard", "keywords": ["dashboard", "home"]},
]

# Navigation only fires on an explicit navigation phrase. Without this gate a
# destination keyword would compete with the action intents and "raise a
# complaint" could open a page instead of filing one.
NAV_TRIGGERS = [
    "take me to", "take me", "go to", "open the", "open ", "navigate",
    "where can i", "where do i", "where is", "show me the", "bring up",
    "jump to", "page for",
]


def is_navigation(normalised: str) -> bool:
    return any(trigger in normalised for trigger in NAV_TRIGGERS)


def visible_destinations(role: str) -> list[dict]:
    return [
        dest for dest in DESTINATIONS
        if "roles" not in dest or role in dest["roles"]
    ]


def match_destination(normalised: str, role: str) -> dict | None:
    """
    Longest matching keyword wins, so a specific destination beats a generic
    one ("raise a complaint" -> the form, not the list).
    """
    best, best_length = None, 0
    for dest in visible_destinations(role):
        for keyword in dest["keywords"]:
            if keyword in normalised and len(keyword) > best_length:
                best, best_length = dest, len(keyword)
    return best
