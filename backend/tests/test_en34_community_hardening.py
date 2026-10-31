"""
EN-34 — Harden Community Corners (additional tests beyond test_be34_community_corners.py).

Covers:
  - Reject duplicate activity signups
  - Reject signups beyond activity capacity
  - Reject signups for past activities
  - Reject signups after registration closes (completed/cancelled)
  - Validate cross-corner data isolation
"""

from datetime import date, timedelta

from app.models.community import ActivitySignup, CommunityActivity
from app.models.resident import Flat, Resident

BASE = "/api/v1/community"


# ── Helpers ───────────────────────────────────────────────────────────────────

def seed_resident(db_session, name="Corner Resident", flat_number="801"):
    flat = Flat(block="H", floor="8", flat_number=flat_number,
                ownership_type="owned", occupancy_status="occupied")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    resident = Resident(flat_id=flat.flat_id, name=name,
                        phone="9666666666", status="active")
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def seed_activity(db_session, corner="kids", status="upcoming",
                  days_ahead=7, capacity=None, title="Test Activity"):
    activity = CommunityActivity(
        corner=corner,
        title=title,
        status=status,
        activity_date=date.today() + timedelta(days=days_ahead),
        capacity=capacity,
    )
    db_session.add(activity)
    db_session.commit()
    db_session.refresh(activity)
    return activity.activity_id


def seed_signup(db_session, activity_id, resident_id):
    signup = ActivitySignup(activity_id=activity_id, resident_id=resident_id)
    db_session.add(signup)
    db_session.commit()
    db_session.refresh(signup)
    return signup.signup_id


def do_signup(client, activity_id, resident_id, notes=None):
    payload = {"resident_id": resident_id}
    if notes:
        payload["notes"] = notes
    return client.post(f"{BASE}/activities/{activity_id}/signup", json=payload)


# ── Duplicate activity signups ────────────────────────────────────────────────

class TestDuplicateSignups:

    def test_duplicate_signup_returns_409(self, client, db_session):
        aid = seed_activity(db_session)
        rid = seed_resident(db_session)
        seed_signup(db_session, aid, rid)

        resp = do_signup(client, aid, rid)
        assert resp.status_code == 409
        assert "already signed up" in resp.json()["detail"].lower()

    def test_signup_count_not_incremented_on_duplicate(self, client, db_session):
        aid = seed_activity(db_session)
        rid = seed_resident(db_session)
        seed_signup(db_session, aid, rid)

        do_signup(client, aid, rid)  # duplicate attempt

        data = client.get(f"{BASE}/activities/{aid}").json()
        assert data["signup_count"] == 1

    def test_two_different_residents_can_signup_same_activity(self, client, db_session):
        aid = seed_activity(db_session, capacity=10)
        r1 = seed_resident(db_session, name="R1", flat_number="801")
        r2 = seed_resident(db_session, name="R2", flat_number="802")

        r1_resp = do_signup(client, aid, r1)
        r2_resp = do_signup(client, aid, r2)
        assert r1_resp.status_code == 201
        assert r2_resp.status_code == 201


# ── Signups beyond capacity ───────────────────────────────────────────────────

class TestSignupBeyondCapacity:

    def test_signup_at_capacity_returns_400(self, client, db_session):
        aid = seed_activity(db_session, capacity=1)
        r1 = seed_resident(db_session, name="R1", flat_number="801")
        r2 = seed_resident(db_session, name="R2", flat_number="802")
        seed_signup(db_session, aid, r1)

        resp = do_signup(client, aid, r2)
        assert resp.status_code == 400
        assert "capacity" in resp.json()["detail"].lower()

    def test_spots_remaining_decrements(self, client, db_session):
        aid = seed_activity(db_session, capacity=3)
        r1 = seed_resident(db_session, name="R1", flat_number="801")
        seed_signup(db_session, aid, r1)

        data = client.get(f"{BASE}/activities/{aid}").json()
        assert data["spots_remaining"] == 2

    def test_unlimited_capacity_never_blocks(self, client, db_session):
        aid = seed_activity(db_session, capacity=None)
        for i in range(8):
            rid = seed_resident(db_session, name=f"R{i}", flat_number=f"8{i:02d}")
            resp = do_signup(client, aid, rid)
            assert resp.status_code == 201


# ── Signups for past activities ───────────────────────────────────────────────

class TestSignupPastActivities:

    def test_signup_for_past_activity_rejected(self, client, db_session):
        aid = seed_activity(db_session, status="upcoming", days_ahead=-1)
        rid = seed_resident(db_session)
        resp = do_signup(client, aid, rid)
        assert resp.status_code == 400
        assert "already took place" in resp.json()["detail"].lower()

    def test_signup_for_today_activity_succeeds(self, client, db_session):
        """Activity happening today is not yet past (strict less-than check)."""
        aid = seed_activity(db_session, status="upcoming", days_ahead=0)
        rid = seed_resident(db_session)
        resp = do_signup(client, aid, rid)
        assert resp.status_code == 201

    def test_signup_for_future_activity_succeeds(self, client, db_session):
        aid = seed_activity(db_session, status="upcoming", days_ahead=14)
        rid = seed_resident(db_session)
        resp = do_signup(client, aid, rid)
        assert resp.status_code == 201


# ── Signups after registration closes ────────────────────────────────────────

class TestSignupAfterRegistrationCloses:

    def test_signup_on_completed_activity_rejected(self, client, db_session):
        aid = seed_activity(db_session, status="completed")
        rid = seed_resident(db_session)
        resp = do_signup(client, aid, rid)
        assert resp.status_code == 400
        assert "completed" in resp.json()["detail"].lower()

    def test_signup_on_cancelled_activity_rejected(self, client, db_session):
        aid = seed_activity(db_session, status="cancelled")
        rid = seed_resident(db_session)
        resp = do_signup(client, aid, rid)
        assert resp.status_code == 400
        assert "cancelled" in resp.json()["detail"].lower()

    def test_signup_on_upcoming_activity_succeeds(self, client, db_session):
        aid = seed_activity(db_session, status="upcoming")
        rid = seed_resident(db_session)
        resp = do_signup(client, aid, rid)
        assert resp.status_code == 201


# ── Cross-corner data isolation ───────────────────────────────────────────────

class TestCrossCornerIsolation:

    def test_kids_corner_filter_excludes_senior(self, client, db_session):
        seed_activity(db_session, corner="kids", title="Kids Art Class")
        seed_activity(db_session, corner="senior", title="Senior Yoga")

        resp = client.get(f"{BASE}/activities?corner=kids")
        titles = [a["title"] for a in resp.json()]
        assert "Kids Art Class" in titles
        assert "Senior Yoga" not in titles

    def test_senior_corner_filter_excludes_kids(self, client, db_session):
        seed_activity(db_session, corner="kids", title="Kids Swimming")
        seed_activity(db_session, corner="senior", title="Senior Chess")

        resp = client.get(f"{BASE}/activities?corner=senior")
        titles = [a["title"] for a in resp.json()]
        assert "Senior Chess" in titles
        assert "Kids Swimming" not in titles

    def test_recreational_corner_isolated(self, client, db_session):
        seed_activity(db_session, corner="recreational", title="Badminton")
        seed_activity(db_session, corner="social", title="Book Club")

        resp = client.get(f"{BASE}/activities?corner=recreational")
        titles = [a["title"] for a in resp.json()]
        assert "Badminton" in titles
        assert "Book Club" not in titles

    def test_social_corner_isolated(self, client, db_session):
        seed_activity(db_session, corner="recreational", title="Tennis")
        seed_activity(db_session, corner="social", title="Movie Night")

        resp = client.get(f"{BASE}/activities?corner=social")
        titles = [a["title"] for a in resp.json()]
        assert "Movie Night" in titles
        assert "Tennis" not in titles

    def test_unfiltered_returns_all_corners(self, client, db_session):
        seed_activity(db_session, corner="kids", title="Kids Dance")
        seed_activity(db_session, corner="senior", title="Senior Walk")
        seed_activity(db_session, corner="recreational", title="Gym Session")
        seed_activity(db_session, corner="social", title="Potluck")

        resp = client.get(f"{BASE}/activities")
        titles = {a["title"] for a in resp.json()}
        assert {"Kids Dance", "Senior Walk", "Gym Session", "Potluck"}.issubset(titles)

    def test_signup_in_one_corner_does_not_affect_another(self, client, db_session):
        """Signing up for a kids activity must not affect a senior activity's count."""
        kids_aid = seed_activity(db_session, corner="kids", title="Kids Craft",
                                 capacity=5)
        senior_aid = seed_activity(db_session, corner="senior", title="Senior Tai Chi",
                                   capacity=5)
        rid = seed_resident(db_session)

        do_signup(client, kids_aid, rid)

        kids_data = client.get(f"{BASE}/activities/{kids_aid}").json()
        senior_data = client.get(f"{BASE}/activities/{senior_aid}").json()

        assert kids_data["signup_count"] == 1
        assert senior_data["signup_count"] == 0

    def test_invalid_corner_filter_returns_422(self, client, db_session):
        resp = client.get(f"{BASE}/activities?corner=invalid-corner")
        assert resp.status_code == 422
