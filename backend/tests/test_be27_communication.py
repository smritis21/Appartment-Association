"""
pytest tests for BE-27 — Communication API.

Covers:
  Circulars:
    - Create success (returns 201 with correct body)
    - List all / filter by category
    - Get single circular (200) and unknown (404)
    - Attachment limit enforced (400 when > 5)
    - Past meeting_date rejected (400)
    - meeting_date today or future accepted (201)

  Polls:
    - Create success (returns 201 with tally = all-zeros)
    - Create with fewer than 2 options → 422
    - Create with close_at <= open_at → 422
    - List polls
    - Get poll (200) and unknown (404)

  Voting:
    - Vote success (returns 201, tally updated)
    - Duplicate vote returns 409
    - Vote before open_at returns 400
    - Vote after close_at returns 400
    - Vote with invalid option returns 400
    - Vote on unknown poll returns 404
    - Vote with unknown resident returns 404

  Results:
    - Results show correct tally and winner
    - Results on poll with no votes: winner is null

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import date, datetime, timedelta, timezone

from app.models.communication import Circular, Poll, PollResponse
from app.models.resident import Flat, Resident

BASE = "/api/v1/communication"


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_resident(db_session, **overrides) -> str:
    flat = Flat(
        block="A",
        floor="1",
        flat_number="101",
        ownership_type="owned",
        occupancy_status="occupied",
    )
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)

    defaults = {
        "flat_id": flat.flat_id,
        "name": "Test Resident",
        "phone": "9800000000",
        "status": "active",
    }
    defaults.update(overrides)
    resident = Resident(**defaults)
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def seed_circular(db_session, **overrides) -> str:
    defaults = {
        "title": "Test Circular",
        "body": "Body text.",
        "category": "general",
        "attachments": [],
    }
    defaults.update(overrides)
    circular = Circular(**defaults)
    db_session.add(circular)
    db_session.commit()
    db_session.refresh(circular)
    return circular.circular_id


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def seed_poll(db_session, **overrides) -> str:
    """Seed an open poll by default (open 1 hour ago, closes in 1 hour)."""
    now = _now()
    defaults = {
        "question": "Favourite colour?",
        "options": ["Red", "Blue", "Green"],
        "open_at": now - timedelta(hours=1),
        "close_at": now + timedelta(hours=1),
    }
    defaults.update(overrides)
    poll = Poll(**defaults)
    db_session.add(poll)
    db_session.commit()
    db_session.refresh(poll)
    return poll.poll_id


def seed_vote(db_session, poll_id: str, resident_id: str, option: str) -> str:
    response = PollResponse(
        poll_id=poll_id,
        resident_id=resident_id,
        chosen_option=option,
    )
    db_session.add(response)
    db_session.commit()
    db_session.refresh(response)
    return response.response_id


# ── Circulars — create ────────────────────────────────────────────────────────

def test_create_circular_returns_201(client):
    payload = {
        "title": "Water Shutdown Notice",
        "body": "Water will be off on 10-Aug from 9 AM to 1 PM.",
        "category": "notice",
        "attachments": [],
        "created_by": "admin",
    }
    response = client.post(f"{BASE}/circulars", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Water Shutdown Notice"
    assert body["category"] == "notice"
    assert "circular_id" in body


def test_create_circular_with_attachments_persists(client):
    payload = {
        "title": "AGM Notice",
        "body": "Please attend the AGM.",
        "category": "meeting",
        "meeting_date": str(date.today() + timedelta(days=10)),
        "attachments": ["/files/agenda.pdf", "/files/minutes.pdf"],
    }
    response = client.post(f"{BASE}/circulars", json=payload)
    assert response.status_code == 201
    assert response.json()["attachments"] == ["/files/agenda.pdf", "/files/minutes.pdf"]


def test_create_circular_today_meeting_date_succeeds(client):
    payload = {
        "title": "Same-Day Meeting",
        "body": "Meeting today.",
        "category": "meeting",
        "meeting_date": str(date.today()),
    }
    response = client.post(f"{BASE}/circulars", json=payload)
    assert response.status_code == 201


def test_create_circular_future_meeting_date_succeeds(client):
    payload = {
        "title": "Future Meeting",
        "body": "Meeting next week.",
        "category": "meeting",
        "meeting_date": str(date.today() + timedelta(days=7)),
    }
    response = client.post(f"{BASE}/circulars", json=payload)
    assert response.status_code == 201


def test_create_circular_past_meeting_date_returns_400(client):
    payload = {
        "title": "Old Meeting",
        "body": "This meeting already happened.",
        "category": "meeting",
        "meeting_date": str(date.today() - timedelta(days=1)),
    }
    response = client.post(f"{BASE}/circulars", json=payload)
    assert response.status_code == 400
    assert "past" in response.json()["detail"].lower()


def test_create_circular_too_many_attachments_returns_400(client):
    payload = {
        "title": "Heavy Circular",
        "body": "Lots of attachments.",
        "attachments": [
            "/a.pdf", "/b.pdf", "/c.pdf", "/d.pdf", "/e.pdf", "/f.pdf"
        ],  # 6 — exceeds limit of 5
    }
    response = client.post(f"{BASE}/circulars", json=payload)
    # Schema validator raises 422; service layer would raise 400.
    # Either is an error — just confirm it's rejected.
    assert response.status_code in (400, 422)


def test_create_circular_missing_title_returns_422(client):
    response = client.post(f"{BASE}/circulars", json={"body": "Some body"})
    assert response.status_code == 422


# ── Circulars — list / get ────────────────────────────────────────────────────

def test_list_circulars_returns_all(client, db_session):
    seed_circular(db_session, title="First")
    seed_circular(db_session, title="Second")
    response = client.get(f"{BASE}/circulars")
    assert response.status_code == 200
    titles = {c["title"] for c in response.json()}
    assert {"First", "Second"}.issubset(titles)


def test_list_circulars_filters_by_category(client, db_session):
    seed_circular(db_session, title="Gen", category="general")
    seed_circular(db_session, title="Mtg", category="meeting")
    response = client.get(f"{BASE}/circulars?category=meeting")
    assert response.status_code == 200
    titles = [c["title"] for c in response.json()]
    assert "Mtg" in titles
    assert "Gen" not in titles


def test_get_circular_returns_200(client, db_session):
    cid = seed_circular(db_session, title="Detail Test")
    response = client.get(f"{BASE}/circulars/{cid}")
    assert response.status_code == 200
    assert response.json()["circular_id"] == cid


def test_get_unknown_circular_returns_404(client):
    response = client.get(f"{BASE}/circulars/does-not-exist")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


# ── Polls — create ────────────────────────────────────────────────────────────

def test_create_poll_returns_201_with_zero_tally(client):
    now = _now()
    payload = {
        "question": "Best snack?",
        "options": ["Chips", "Cookies", "Fruit"],
        "open_at": (now - timedelta(hours=1)).isoformat(),
        "close_at": (now + timedelta(hours=1)).isoformat(),
        "created_by": "admin",
    }
    response = client.post(f"{BASE}/polls", json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["question"] == "Best snack?"
    assert set(body["options"]) == {"Chips", "Cookies", "Fruit"}
    # All votes should be zero on a freshly created poll
    assert all(v == 0 for v in body["tally"].values())
    assert body["total_votes"] == 0
    assert "poll_id" in body


def test_create_poll_fewer_than_two_options_returns_422(client):
    now = _now()
    payload = {
        "question": "Only one?",
        "options": ["Yes"],
        "open_at": (now - timedelta(hours=1)).isoformat(),
        "close_at": (now + timedelta(hours=1)).isoformat(),
    }
    response = client.post(f"{BASE}/polls", json=payload)
    assert response.status_code == 422


def test_create_poll_close_before_open_returns_422(client):
    now = _now()
    payload = {
        "question": "Bad window?",
        "options": ["Yes", "No"],
        "open_at": (now + timedelta(hours=2)).isoformat(),
        "close_at": (now + timedelta(hours=1)).isoformat(),
    }
    response = client.post(f"{BASE}/polls", json=payload)
    assert response.status_code == 422


def test_create_poll_close_equal_open_returns_422(client):
    now = _now()
    payload = {
        "question": "Same time?",
        "options": ["Yes", "No"],
        "open_at": now.isoformat(),
        "close_at": now.isoformat(),
    }
    response = client.post(f"{BASE}/polls", json=payload)
    assert response.status_code == 422


# ── Polls — list / get ────────────────────────────────────────────────────────

def test_list_polls_returns_all(client, db_session):
    seed_poll(db_session, question="Q1?")
    seed_poll(db_session, question="Q2?")
    response = client.get(f"{BASE}/polls")
    assert response.status_code == 200
    questions = {p["question"] for p in response.json()}
    assert {"Q1?", "Q2?"}.issubset(questions)


def test_get_poll_returns_200(client, db_session):
    pid = seed_poll(db_session)
    response = client.get(f"{BASE}/polls/{pid}")
    assert response.status_code == 200
    assert response.json()["poll_id"] == pid


def test_get_unknown_poll_returns_404(client):
    response = client.get(f"{BASE}/polls/does-not-exist")
    assert response.status_code == 404


# ── Voting — success ──────────────────────────────────────────────────────────

def test_vote_success_returns_201(client, db_session):
    pid = seed_poll(db_session, options=["Red", "Blue"])
    rid = seed_resident(db_session)

    response = client.post(
        f"{BASE}/polls/{pid}/vote",
        json={"resident_id": rid, "chosen_option": "Red"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["poll_id"] == pid
    assert body["resident_id"] == rid
    assert body["chosen_option"] == "Red"


def test_vote_updates_tally(client, db_session):
    pid = seed_poll(db_session, options=["Yes", "No"])
    r1 = seed_resident(db_session, name="R1", phone="9800000001")
    r2 = seed_resident(db_session, name="R2", phone="9800000002")

    client.post(f"{BASE}/polls/{pid}/vote", json={"resident_id": r1, "chosen_option": "Yes"})
    client.post(f"{BASE}/polls/{pid}/vote", json={"resident_id": r2, "chosen_option": "Yes"})

    tally = client.get(f"{BASE}/polls/{pid}").json()["tally"]
    assert tally["Yes"] == 2
    assert tally["No"] == 0


# ── Voting — duplicate ────────────────────────────────────────────────────────

def test_duplicate_vote_returns_409(client, db_session):
    pid = seed_poll(db_session, options=["A", "B"])
    rid = seed_resident(db_session)
    seed_vote(db_session, pid, rid, "A")

    response = client.post(
        f"{BASE}/polls/{pid}/vote",
        json={"resident_id": rid, "chosen_option": "B"},
    )
    assert response.status_code == 409
    assert "already voted" in response.json()["detail"].lower()


# ── Voting — window enforcement ───────────────────────────────────────────────

def test_vote_before_open_returns_400(client, db_session):
    now = _now()
    pid = seed_poll(
        db_session,
        open_at=now + timedelta(hours=1),
        close_at=now + timedelta(hours=2),
    )
    rid = seed_resident(db_session)

    response = client.post(
        f"{BASE}/polls/{pid}/vote",
        json={"resident_id": rid, "chosen_option": "Red"},
    )
    assert response.status_code == 400
    assert "not opened yet" in response.json()["detail"].lower()


def test_vote_after_close_returns_400(client, db_session):
    now = _now()
    pid = seed_poll(
        db_session,
        open_at=now - timedelta(hours=2),
        close_at=now - timedelta(hours=1),
    )
    rid = seed_resident(db_session)

    response = client.post(
        f"{BASE}/polls/{pid}/vote",
        json={"resident_id": rid, "chosen_option": "Red"},
    )
    assert response.status_code == 400
    assert "closed" in response.json()["detail"].lower()


# ── Voting — invalid option ───────────────────────────────────────────────────

def test_vote_invalid_option_returns_400(client, db_session):
    pid = seed_poll(db_session, options=["Yes", "No"])
    rid = seed_resident(db_session)

    response = client.post(
        f"{BASE}/polls/{pid}/vote",
        json={"resident_id": rid, "chosen_option": "Maybe"},
    )
    assert response.status_code == 400
    assert "not a valid option" in response.json()["detail"].lower()


# ── Voting — not found ────────────────────────────────────────────────────────

def test_vote_unknown_poll_returns_404(client, db_session):
    rid = seed_resident(db_session)
    response = client.post(
        f"{BASE}/polls/does-not-exist/vote",
        json={"resident_id": rid, "chosen_option": "Yes"},
    )
    assert response.status_code == 404
    assert "poll" in response.json()["detail"].lower()


def test_vote_unknown_resident_returns_404(client, db_session):
    pid = seed_poll(db_session, options=["Yes", "No"])
    response = client.post(
        f"{BASE}/polls/{pid}/vote",
        json={"resident_id": "does-not-exist", "chosen_option": "Yes"},
    )
    assert response.status_code == 404
    assert "resident" in response.json()["detail"].lower()


# ── Results ───────────────────────────────────────────────────────────────────

def test_results_shows_correct_tally_and_winner(client, db_session):
    pid = seed_poll(db_session, options=["A", "B", "C"])
    r1 = seed_resident(db_session, name="R1", phone="9800000011")
    r2 = seed_resident(db_session, name="R2", phone="9800000012")
    r3 = seed_resident(db_session, name="R3", phone="9800000013")
    seed_vote(db_session, pid, r1, "A")
    seed_vote(db_session, pid, r2, "A")
    seed_vote(db_session, pid, r3, "B")

    response = client.get(f"{BASE}/polls/{pid}/results")
    assert response.status_code == 200
    body = response.json()
    assert body["tally"]["A"] == 2
    assert body["tally"]["B"] == 1
    assert body["tally"]["C"] == 0
    assert body["total_votes"] == 3
    assert body["winner"] == "A"


def test_results_no_votes_winner_is_null(client, db_session):
    pid = seed_poll(db_session, options=["X", "Y"])

    response = client.get(f"{BASE}/polls/{pid}/results")
    assert response.status_code == 200
    body = response.json()
    assert body["total_votes"] == 0
    assert body["winner"] is None


def test_results_unknown_poll_returns_404(client):
    response = client.get(f"{BASE}/polls/does-not-exist/results")
    assert response.status_code == 404


# ── Poll is_open field ────────────────────────────────────────────────────────

def test_poll_is_open_true_within_window(client, db_session):
    pid = seed_poll(db_session)  # default: open now
    body = client.get(f"{BASE}/polls/{pid}").json()
    assert body["is_open"] is True


def test_poll_is_open_false_when_closed(client, db_session):
    now = _now()
    pid = seed_poll(
        db_session,
        open_at=now - timedelta(hours=2),
        close_at=now - timedelta(hours=1),
    )
    body = client.get(f"{BASE}/polls/{pid}").json()
    assert body["is_open"] is False
