"""
pytest tests for BE-42 — agentic assistant.

Story: as a resident or manager, I want a conversational assistant that can
act on my behalf, so that routine tasks do not need me to find the right
screen.

The emphasis here is on what makes an *acting* assistant safe rather than on
conversational polish, because its mistakes are database writes:

  - Chat never mutates. A proposal exists; nothing has happened yet.
  - Ownership: user B cannot confirm (or even see) user A's proposal.
  - Role: re-checked at confirm time, not trusted from propose time.
  - Expiry: a stale proposal cannot be replayed.
  - Single use: confirmed and rejected are terminal.
  - Identity: writes are attributed to the token holder, never to a name
    supplied inside the chat message.
  - Delegation: the owning module's validation still applies, and its
    rejection is surfaced rather than swallowed.

Also covers the intent engine directly, slot-filling, role-filtered tool
listing, the audit trail, and the LLM seam staying off by default.

Fixtures (client, db_session) are defined in conftest.py.
"""

import json
import re
from datetime import timedelta

import pytest

from app.models.assistant import AssistantAction
from app.models.complaint import Complaint, Staff
from app.models.resident import Flat, Resident
from app.models.user import User
from app.services import assistant_intent, assistant_service, llm_provider

CHAT_URL = "/api/v1/assistant/chat"
TOOLS_URL = "/api/v1/assistant/tools"
ACTIONS_URL = "/api/v1/assistant/actions"


# ── Auth / seeding helpers ───────────────────────────────────────────────────

def _register_activate(client, db_session, email, role="owner", with_resident=True) -> str:
    resp = client.post("/api/v1/auth/register", json={
        "email": email, "password": "password123", "full_name": "Test User", "role": role,
    })
    assert resp.status_code == 201
    user_id = resp.json()["user_id"]

    user = db_session.query(User).filter(User.user_id == user_id).first()
    user.account_status = "active"

    if with_resident:
        flat = Flat(block="A", flat_number="101")
        db_session.add(flat)
        db_session.commit()
        db_session.refresh(flat)
        resident = Resident(name="Test User", flat_id=flat.flat_id, phone="9999999999")
        db_session.add(resident)
        db_session.commit()
        db_session.refresh(resident)
        user.resident_id = resident.resident_id

    db_session.commit()
    return user_id


def _login(client, email, password="password123") -> dict:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def resident_headers(client, db_session, email="res42@jkr.com") -> dict:
    _register_activate(client, db_session, email, role="owner")
    return _login(client, email)


def admin_headers(client, db_session, email="adm42@jkr.com") -> dict:
    _register_activate(client, db_session, email, role="admin")
    return _login(client, email)


def say(client, headers, message):
    return client.post(CHAT_URL, headers=headers, json={"message": message})


# ── Intent engine (no HTTP) ──────────────────────────────────────────────────

class TestIntentEngine:

    @pytest.mark.parametrize("message,expected", [
        ("I want to raise a complaint", "raise_complaint"),
        ("the tap in my kitchen is leaking", "raise_complaint"),
        ("issue a visitor pass for Ramesh", "issue_visitor_pass"),
        ("mark attendance for the plumber", "mark_staff_attendance"),
        ("switch me to dark mode", "set_preference"),
        ("what is the status of my complaint", "complaint_status"),
        ("what can you do", "help"),
    ])
    def test_classifies_common_phrasings(self, message, expected):
        assert assistant_intent.classify(message)[0] == expected

    def test_unrelated_message_falls_back(self):
        assert assistant_intent.classify("what is the capital of France")[0] == "fallback"

    def test_extracts_category_and_flat(self):
        entities = assistant_intent.extract_entities(
            "raise_complaint", "The tap in A-101 is leaking badly"
        )
        assert entities["category"] == "Plumbing"
        assert entities["location"] == "A-101"

    def test_longest_keyword_wins_for_category(self):
        """'no water' must beat a bare 'water' and pick Water Supply."""
        entities = assistant_intent.extract_entities(
            "raise_complaint", "there is no water in B-204 since morning"
        )
        assert entities["category"] == "Water Supply"

    def test_description_keeps_the_residents_own_words(self):
        message = "The lift is stuck on the third floor again"
        entities = assistant_intent.extract_entities("raise_complaint", message)
        assert entities["description"] == message

    def test_extracts_visitor_name_and_hours(self):
        entities = assistant_intent.extract_entities(
            "issue_visitor_pass", "Issue a pass for Ramesh Kumar for 3 hours"
        )
        assert entities["visitor_name"] == "Ramesh Kumar"
        assert entities["hours"] == 3

    def test_flat_pattern_variants(self):
        assert assistant_intent.extract_flat("in A-101 please") == "A-101"
        assert assistant_intent.extract_flat("flat B 204") == "B-204"
        assert assistant_intent.extract_flat("no flat here") is None


# ── Tool listing is role-filtered ────────────────────────────────────────────

def test_resident_does_not_see_management_tools(client, db_session):
    headers = resident_headers(client, db_session)
    tools = {t["tool"] for t in client.get(TOOLS_URL, headers=headers).json()}

    assert "raise_complaint" in tools
    assert "mark_staff_attendance" not in tools


def test_admin_sees_management_tools(client, db_session):
    headers = admin_headers(client, db_session)
    tools = {t["tool"] for t in client.get(TOOLS_URL, headers=headers).json()}
    assert "mark_staff_attendance" in tools


def test_tools_require_authentication(client):
    assert client.get(TOOLS_URL).status_code == 401


# ── Chat basics ──────────────────────────────────────────────────────────────

def test_chat_requires_authentication(client):
    assert client.post(CHAT_URL, json={"message": "hello"}).status_code == 401


def test_empty_message_returns_422(client, db_session):
    headers = resident_headers(client, db_session)
    assert client.post(CHAT_URL, headers=headers, json={"message": ""}).status_code == 422


def test_unknown_question_returns_fallback_with_suggestions(client, db_session):
    headers = resident_headers(client, db_session)
    body = say(client, headers, "what is the capital of France").json()

    assert body["kind"] == "fallback"
    assert body["suggestions"]


def test_help_lists_available_tools(client, db_session):
    headers = resident_headers(client, db_session)
    body = say(client, headers, "what can you do").json()

    assert body["kind"] == "answer"
    assert "raise_complaint" in body["data"]["tools"]


def test_read_only_question_answers_without_proposing(client, db_session):
    headers = resident_headers(client, db_session)
    body = say(client, headers, "how many complaints are there in total").json()

    assert body["kind"] == "answer"
    assert body["action"] is None


# ── Slot filling ─────────────────────────────────────────────────────────────

def test_missing_slot_asks_instead_of_guessing(client, db_session):
    headers = resident_headers(client, db_session)
    # No flat and no recognisable category -> cannot be completed safely.
    body = say(client, headers, "I want to raise a complaint").json()

    assert body["kind"] == "needs_input"
    assert set(body["missing"]) & {"category", "location"}
    assert body["action"] is None


def test_needs_input_creates_no_action_row(client, db_session):
    headers = resident_headers(client, db_session)
    say(client, headers, "I want to raise a complaint")
    assert db_session.query(AssistantAction).count() == 0


# ── Propose, and only propose ────────────────────────────────────────────────

def test_complete_request_returns_a_proposal(client, db_session):
    headers = resident_headers(client, db_session)
    body = say(client, headers, "The tap in A-101 is leaking").json()

    assert body["kind"] == "proposal"
    assert body["action"]["tool"] == "raise_complaint"
    assert body["action"]["params"]["category"] == "Plumbing"
    assert body["action"]["status"] == "proposed"


def test_chat_alone_writes_nothing(client, db_session):
    """The whole point of propose-then-confirm."""
    headers = resident_headers(client, db_session)
    say(client, headers, "The tap in A-101 is leaking")

    assert db_session.query(Complaint).count() == 0


def test_confirm_executes_and_persists(client, db_session):
    headers = resident_headers(client, db_session)
    action_id = say(client, headers, "The tap in A-101 is leaking").json()["action"]["action_id"]

    response = client.post(f"{ACTIONS_URL}/{action_id}/confirm", headers=headers)

    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"
    assert response.json()["result_ref"]
    assert db_session.query(Complaint).count() == 1


def test_confirmed_complaint_is_attributed_to_the_token_holder(client, db_session):
    """Identity comes from the session, never from the message text."""
    _register_activate(client, db_session, "owner42@jkr.com", role="owner")
    headers = _login(client, "owner42@jkr.com")
    user = db_session.query(User).filter(User.email == "owner42@jkr.com").first()

    action_id = say(client, headers, "raise a complaint, the tap in A-101 is leaking").json()["action"]["action_id"]
    client.post(f"{ACTIONS_URL}/{action_id}/confirm", headers=headers)

    complaint = db_session.query(Complaint).first()
    assert complaint.raised_by == user.resident_id


def test_reject_discards_without_executing(client, db_session):
    headers = resident_headers(client, db_session)
    action_id = say(client, headers, "The tap in A-101 is leaking").json()["action"]["action_id"]

    response = client.post(f"{ACTIONS_URL}/{action_id}/reject", headers=headers)

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    assert db_session.query(Complaint).count() == 0


# ── Guards on confirmation ───────────────────────────────────────────────────

def test_cannot_confirm_twice(client, db_session):
    headers = resident_headers(client, db_session)
    action_id = say(client, headers, "The tap in A-101 is leaking").json()["action"]["action_id"]
    client.post(f"{ACTIONS_URL}/{action_id}/confirm", headers=headers)

    second = client.post(f"{ACTIONS_URL}/{action_id}/confirm", headers=headers)

    assert second.status_code == 409
    assert db_session.query(Complaint).count() == 1


def test_cannot_confirm_a_rejected_action(client, db_session):
    headers = resident_headers(client, db_session)
    action_id = say(client, headers, "The tap in A-101 is leaking").json()["action"]["action_id"]
    client.post(f"{ACTIONS_URL}/{action_id}/reject", headers=headers)

    assert client.post(f"{ACTIONS_URL}/{action_id}/confirm", headers=headers).status_code == 409


def test_another_user_cannot_confirm_my_action(client, db_session):
    mine = resident_headers(client, db_session, email="a42@jkr.com")
    theirs = resident_headers(client, db_session, email="b42@jkr.com")
    action_id = say(client, mine, "The tap in A-101 is leaking").json()["action"]["action_id"]

    response = client.post(f"{ACTIONS_URL}/{action_id}/confirm", headers=theirs)

    assert response.status_code == 403
    assert db_session.query(Complaint).count() == 0


def test_another_user_cannot_reject_my_action(client, db_session):
    mine = resident_headers(client, db_session, email="c42@jkr.com")
    theirs = resident_headers(client, db_session, email="d42@jkr.com")
    action_id = say(client, mine, "The tap in A-101 is leaking").json()["action"]["action_id"]

    assert client.post(f"{ACTIONS_URL}/{action_id}/reject", headers=theirs).status_code == 403


def test_expired_proposal_cannot_be_confirmed(client, db_session):
    headers = resident_headers(client, db_session)
    action_id = say(client, headers, "The tap in A-101 is leaking").json()["action"]["action_id"]

    action = db_session.query(AssistantAction).filter(
        AssistantAction.action_id == action_id
    ).first()
    action.expires_at = assistant_service._utcnow() - timedelta(minutes=1)
    db_session.commit()

    response = client.post(f"{ACTIONS_URL}/{action_id}/confirm", headers=headers)

    assert response.status_code == 410
    assert db_session.query(Complaint).count() == 0


def test_unknown_action_returns_404(client, db_session):
    headers = resident_headers(client, db_session)
    assert client.post(f"{ACTIONS_URL}/no-such-action/confirm", headers=headers).status_code == 404


def test_role_is_rechecked_at_confirm_time(client, db_session):
    """
    A management-only action proposed to an admin must not execute if that
    user has been demoted between proposing and confirming.
    """
    headers = admin_headers(client, db_session, email="demoted@jkr.com")
    staff = Staff(name="Raju", role="plumber")
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)

    proposal = say(client, headers, f"mark attendance present for {staff.staff_id}").json()
    assert proposal["kind"] == "proposal"

    user = db_session.query(User).filter(User.email == "demoted@jkr.com").first()
    user.role = "owner"
    db_session.commit()

    response = client.post(f"{ACTIONS_URL}/{proposal['action']['action_id']}/confirm", headers=headers)
    assert response.status_code == 403


def test_resident_asking_for_a_management_action_is_refused(client, db_session):
    headers = resident_headers(client, db_session)
    body = say(client, headers, "mark attendance present for staff-1").json()

    assert body["kind"] == "refusal"
    assert body["action"] is None


def test_refusal_creates_no_action_row(client, db_session):
    headers = resident_headers(client, db_session)
    say(client, headers, "mark attendance present for staff-1")
    assert db_session.query(AssistantAction).count() == 0


# ── Delegation to the owning module ──────────────────────────────────────────

def test_module_validation_still_applies_and_is_surfaced(client, db_session):
    """
    The assistant must not be a way around a module's rules. Marking the same
    staff member twice in one day is a 409 in BE-35, and stays a 409 here.
    """
    headers = admin_headers(client, db_session, email="mgr42@jkr.com")
    staff = Staff(name="Raju", role="plumber")
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)

    first = say(client, headers, f"mark attendance present for {staff.staff_id}").json()
    client.post(f"{ACTIONS_URL}/{first['action']['action_id']}/confirm", headers=headers)

    second = say(client, headers, f"mark attendance present for {staff.staff_id}").json()
    response = client.post(f"{ACTIONS_URL}/{second['action']['action_id']}/confirm", headers=headers)

    assert response.status_code == 409


def test_failed_execution_is_recorded_on_the_action(client, db_session):
    headers = admin_headers(client, db_session, email="mgr43@jkr.com")
    staff = Staff(name="Raju", role="plumber")
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)

    first = say(client, headers, f"mark attendance present for {staff.staff_id}").json()
    client.post(f"{ACTIONS_URL}/{first['action']['action_id']}/confirm", headers=headers)
    second = say(client, headers, f"mark attendance present for {staff.staff_id}").json()
    client.post(f"{ACTIONS_URL}/{second['action']['action_id']}/confirm", headers=headers)

    action = db_session.query(AssistantAction).filter(
        AssistantAction.action_id == second["action"]["action_id"]
    ).first()
    assert action.status == "rejected"
    assert action.error


def test_visitor_pass_action_end_to_end(client, db_session):
    headers = resident_headers(client, db_session, email="pass42@jkr.com")

    proposal = say(client, headers, "Issue a visitor pass for Ramesh Kumar for 3 hours").json()
    assert proposal["action"]["params"]["visitor_name"] == "Ramesh Kumar"

    response = client.post(f"{ACTIONS_URL}/{proposal['action']['action_id']}/confirm", headers=headers)

    assert response.status_code == 200
    assert response.json()["status"] == "confirmed"


def test_user_without_a_linked_flat_is_refused(client, db_session):
    _register_activate(client, db_session, "noflat@jkr.com", role="owner", with_resident=False)
    headers = _login(client, "noflat@jkr.com")

    body = say(client, headers, "The tap in A-101 is leaking").json()

    assert body["kind"] == "refusal"


# ── Audit trail ──────────────────────────────────────────────────────────────

def test_action_history_is_scoped_to_the_caller(client, db_session):
    mine = resident_headers(client, db_session, email="e42@jkr.com")
    theirs = resident_headers(client, db_session, email="f42@jkr.com")
    say(client, mine, "The tap in A-101 is leaking")

    assert len(client.get(ACTIONS_URL, headers=mine).json()) == 1
    assert client.get(ACTIONS_URL, headers=theirs).json() == []


def test_action_history_filters_by_status(client, db_session):
    headers = resident_headers(client, db_session)
    first = say(client, headers, "The tap in A-101 is leaking").json()["action"]["action_id"]
    client.post(f"{ACTIONS_URL}/{first}/confirm", headers=headers)
    say(client, headers, "The lift in A-101 is stuck")

    confirmed = client.get(f"{ACTIONS_URL}?status=confirmed", headers=headers).json()
    proposed = client.get(f"{ACTIONS_URL}?status=proposed", headers=headers).json()

    assert len(confirmed) == 1
    assert len(proposed) == 1


def test_action_history_requires_authentication(client):
    assert client.get(ACTIONS_URL).status_code == 401


# ── LLM seam ─────────────────────────────────────────────────────────────────

class TestNavigation:
    """
    Navigation must never steal an action. That is the whole reason it is
    gated behind an explicit 'take me to'-style phrase rather than competing
    on destination keywords.
    """

    def test_takes_the_user_to_donations(self, client, db_session):
        headers = resident_headers(client, db_session, email="nav1@jkr.com")
        body = say(client, headers, "take me to where I can donate").json()

        assert body["kind"] == "navigate"
        assert body["route"] == "/temple/donate"

    @pytest.mark.parametrize("message,route", [
        ("take me to billing", "/billing"),
        ("open the marketplace", "/marketplace"),
        ("where can i book a seva", "/temple/book"),
        ("go to my profile", "/profile"),
        ("where do i book house help", "/workforce/services"),
        ("show me the announcements page", "/announcements"),
        ("take me to visitor passes", "/visitors/passes"),
    ])
    def test_common_destinations(self, client, db_session, message, route):
        headers = resident_headers(client, db_session, email=f"nav{abs(hash(route)) % 9999}@jkr.com")
        body = say(client, headers, message).json()

        assert body["kind"] == "navigate"
        assert body["route"] == route

    def test_specific_destination_beats_generic(self, client, db_session):
        """'raise a complaint' should open the form, not the complaints list."""
        headers = resident_headers(client, db_session, email="nav2@jkr.com")
        body = say(client, headers, "where do i raise a complaint").json()

        assert body["route"] == "/complaints/new"

    def test_navigation_does_not_steal_an_action(self, client, db_session):
        """Without a navigation phrase, the same words must still file a complaint."""
        headers = resident_headers(client, db_session, email="nav3@jkr.com")
        body = say(client, headers, "The tap in A-101 is leaking").json()

        assert body["kind"] == "proposal"

    def test_action_phrasing_still_acts_not_navigates(self, client, db_session):
        headers = resident_headers(client, db_session, email="nav4@jkr.com")
        body = say(client, headers, "donate 500 for annadanam").json()

        assert body["kind"] == "proposal"
        assert body["action"]["tool"] == "record_donation"

    def test_management_only_route_hidden_from_resident(self, client, db_session):
        headers = resident_headers(client, db_session, email="nav5@jkr.com")
        body = say(client, headers, "take me to the audit log").json()

        # Falls back rather than offering a door the resident cannot open.
        assert body["kind"] == "fallback"

    def test_management_route_offered_to_admin(self, client, db_session):
        headers = admin_headers(client, db_session, email="nav6@jkr.com")
        body = say(client, headers, "take me to the audit log").json()

        assert body["kind"] == "navigate"
        assert body["route"] == "/audit"

    def test_unknown_destination_falls_back(self, client, db_session):
        headers = resident_headers(client, db_session, email="nav7@jkr.com")
        body = say(client, headers, "take me to the swimming championship").json()

        assert body["kind"] == "fallback"

    def test_navigation_writes_nothing(self, client, db_session):
        headers = resident_headers(client, db_session, email="nav8@jkr.com")
        say(client, headers, "take me to where I can donate")

        assert db_session.query(AssistantAction).count() == 0

    def test_registry_entries_are_well_formed(self):
        from app.services import assistant_nav

        keys = set()
        for destination in assistant_nav.DESTINATIONS:
            assert destination["route"].startswith("/")
            assert ":" not in destination["route"], "routes with params cannot be pushed blind"
            assert destination["keywords"]
            assert destination["label"]
            assert destination["destination"], "every entry needs a stable semantic key"
            assert destination["destination"] not in keys, "destination keys must be unique"
            keys.add(destination["destination"])

    def test_no_route_has_drifted_from_the_frontend(self):
        """
        The registry mirrors apartment-app/src/routes/AppRoutes.jsx. If someone
        renames a route there, this fails instead of the assistant silently
        sending users to a dead page.

        Skipped when the frontend is not on disk — the backend ships on its own
        (Deliverable C is backend-only), so its suite must not require the
        frontend tree to exist.
        """
        from pathlib import Path

        from app.services import assistant_nav

        routes_file = (
            Path(__file__).resolve().parents[2] / "apartment-app" / "src" / "routes" / "AppRoutes.jsx"
        )
        if not routes_file.exists():
            pytest.skip("frontend not present in this checkout")

        declared = set(re.findall(r'path="([^"]+)"', routes_file.read_text()))
        # Nested <Route path="x"> children render relative to their parent, and
        # the file also uses absolute paths; comparing against both forms keeps
        # this honest without re-implementing React Router's resolution.
        declared |= {"/" + path.lstrip("/") for path in declared}

        missing = [
            dest["route"] for dest in assistant_nav.DESTINATIONS
            if dest["route"] not in declared
        ]
        assert not missing, (
            f"These assistant routes no longer exist in AppRoutes.jsx: {missing}. "
            "Update DESTINATIONS in app/services/assistant_nav.py."
        )


class TestBroaderReads:

    def test_dues_when_nothing_outstanding(self, client, db_session):
        headers = resident_headers(client, db_session, email="read1@jkr.com")
        body = say(client, headers, "how much do i owe").json()

        assert body["kind"] == "answer"
        assert "no outstanding" in body["text"].lower()

    def test_announcements_when_empty(self, client, db_session):
        headers = resident_headers(client, db_session, email="read2@jkr.com")
        body = say(client, headers, "any notice for me").json()

        assert body["kind"] == "answer"

    def test_community_activities_read(self, client, db_session):
        headers = resident_headers(client, db_session, email="read3@jkr.com")
        body = say(client, headers, "what is happening in the community").json()

        assert body["kind"] == "answer"

    def test_temple_events_read(self, client, db_session):
        headers = resident_headers(client, db_session, email="read4@jkr.com")
        body = say(client, headers, "any upcoming temple event").json()

        assert body["kind"] == "answer"

    def test_reads_never_create_an_action(self, client, db_session):
        headers = resident_headers(client, db_session, email="read5@jkr.com")
        for message in ("how much do i owe", "any notice for me", "what is happening in the community"):
            say(client, headers, message)

        assert db_session.query(AssistantAction).count() == 0


class TestDonationAction:

    def test_donation_proposal_extracts_amount_and_purpose(self, client, db_session):
        headers = resident_headers(client, db_session, email="don1@jkr.com")
        body = say(client, headers, "I want to donate 500 for annadanam").json()

        assert body["kind"] == "proposal"
        assert body["action"]["params"]["amount"] == "500"
        assert body["action"]["params"]["purpose"] == "annadanam"

    def test_donation_without_amount_asks_for_it(self, client, db_session):
        headers = resident_headers(client, db_session, email="don2@jkr.com")
        body = say(client, headers, "I want to make a donation").json()

        assert body["kind"] == "needs_input"
        assert "amount" in body["missing"]

    def test_donation_confirm_persists(self, client, db_session):
        from app.models.temple import TempleDonation

        headers = resident_headers(client, db_session, email="don3@jkr.com")
        action_id = say(client, headers, "donate 750 for festival").json()["action"]["action_id"]

        response = client.post(f"{ACTIONS_URL}/{action_id}/confirm", headers=headers)

        assert response.status_code == 200
        assert db_session.query(TempleDonation).count() == 1

    def test_donation_is_attributed_to_the_caller(self, client, db_session):
        from app.models.temple import TempleDonation

        _register_activate(client, db_session, "don4@jkr.com", role="owner")
        headers = _login(client, "don4@jkr.com")
        user = db_session.query(User).filter(User.email == "don4@jkr.com").first()

        action_id = say(client, headers, "donate 200").json()["action"]["action_id"]
        client.post(f"{ACTIONS_URL}/{action_id}/confirm", headers=headers)

        assert db_session.query(TempleDonation).first().resident_id == user.resident_id


def test_replies_are_rule_based_by_default(client, db_session):
    headers = resident_headers(client, db_session)
    body = say(client, headers, "The tap in A-101 is leaking").json()

    assert llm_provider.is_enabled() is False
    assert body["source"] == "rules"


def test_configured_model_cannot_change_the_chosen_action(client, db_session, monkeypatch):
    """
    A model may read the sentence and it may reword the proposal, but free
    prose is not an intent: anything that is not a known intent in valid JSON
    is discarded and the deterministic classifier decides instead.
    """
    headers = resident_headers(client, db_session)
    monkeypatch.setattr(llm_provider, "is_enabled", lambda: True)
    monkeypatch.setattr(llm_provider.settings, "AI_PROVIDER", "ollama")
    monkeypatch.setattr(
        llm_provider, "_call_ollama", lambda prompt, system=None: "I will delete every complaint."
    )

    body = say(client, headers, "The tap in A-101 is leaking").json()

    assert body["action"]["tool"] == "raise_complaint"
    assert body["action"]["params"]["category"] == "Plumbing"


# ── The model as the understanding layer ─────────────────────────────────────

def test_a_model_reading_picks_the_intent(client, db_session, monkeypatch):
    """
    Phrasing the keyword list was never written for still reaches the right
    tool when a model is configured — that is the point of using one.
    """
    headers = resident_headers(client, db_session)
    monkeypatch.setattr(llm_provider, "is_enabled", lambda: True)
    monkeypatch.setattr(llm_provider.settings, "AI_PROVIDER", "ollama")
    monkeypatch.setattr(
        llm_provider, "_call_ollama",
        lambda prompt, system=None: json.dumps({
            "intent": "raise_complaint",
            "params": {"category": "Electrical", "location": "A-101",
                       "description": "the washroom bulb went kaput"},
        }),
    )

    body = say(client, headers, "my washroom bulb went kaput in A-101").json()

    assert body["kind"] == "proposal"
    assert body["action"]["tool"] == "raise_complaint"
    assert body["action"]["params"]["category"] == "Electrical"


def test_a_model_cannot_invent_an_intent(client, db_session, monkeypatch):
    headers = resident_headers(client, db_session)
    monkeypatch.setattr(llm_provider, "is_enabled", lambda: True)
    monkeypatch.setattr(llm_provider.settings, "AI_PROVIDER", "ollama")
    monkeypatch.setattr(
        llm_provider, "_call_ollama",
        lambda prompt, system=None: json.dumps({"intent": "delete_everything", "params": {}}),
    )

    body = say(client, headers, "The tap in A-101 is leaking").json()

    # Unknown intent is thrown away; the rules engine still files a complaint.
    assert body["action"]["tool"] == "raise_complaint"


def test_a_model_cannot_bypass_a_role_restriction(client, db_session, monkeypatch):
    """
    A resident stays a resident however the model reads the sentence.

    The catalogue the model chooses from is filtered by role, so a restricted
    tool is never even offered; and were one to come back anyway it is not a
    known intent for this user and is discarded. Either way no action is
    proposed, which is the property that matters.
    """
    headers = resident_headers(client, db_session)
    monkeypatch.setattr(llm_provider, "is_enabled", lambda: True)
    monkeypatch.setattr(llm_provider.settings, "AI_PROVIDER", "ollama")
    monkeypatch.setattr(
        llm_provider, "_call_ollama",
        lambda prompt, system=None: json.dumps({
            "intent": "mark_staff_attendance",
            "params": {"staff_name": "Ramesh", "hours": 8},
        }),
    )

    body = say(client, headers, "mark Ramesh present for 8 hours").json()

    assert body["action"] is None
    assert body["kind"] != "proposal"


def test_the_assistant_still_works_with_no_model(client, db_session):
    """The fallback is what keeps a clean clone working without a key."""
    headers = resident_headers(client, db_session)

    body = say(client, headers, "The tap in A-101 is leaking").json()

    assert llm_provider.is_enabled() is False
    assert body["action"]["tool"] == "raise_complaint"
    assert body["source"] == "rules"
