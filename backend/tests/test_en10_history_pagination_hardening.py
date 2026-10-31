"""
EN-10 — Harden Resident Complaint History.

Story: as a resident, I want complete history so that pagination and long
histories work correctly.

Additional tests beyond test_be10_complaint_history.py:
  - Ordering: newest first, with complaint_id as a stable tiebreak when two
    complaints share a created_at (so paging never drops or duplicates a row).
  - Pagination: page/page_size slice correctly; the union of all pages equals
    the full history exactly once; metadata rides in X-* response headers.
  - Edge cases: no history, a page past the end, and a very long history paged
    end to end.
  - Validation: page < 1 and page_size outside 1..100 are rejected with 422.
  - Backward compatibility: with no params the full array is still returned.
  - Unknown resident returns 404 on both the plain and paginated paths.

Fixtures (client, db_session) are defined in conftest.py.
"""

from datetime import datetime, timedelta

from app.models.complaint import Complaint
from app.models.resident import Flat, Resident


def history_url(resident_id: str) -> str:
    return f"/api/v1/residents/{resident_id}/complaints"


def seed_resident(db_session, name="History Resident") -> str:
    flat = Flat(block="A", flat_number="101")
    db_session.add(flat)
    db_session.commit()
    db_session.refresh(flat)
    resident = Resident(name=name, flat_id=flat.flat_id, phone="9999999999")
    db_session.add(resident)
    db_session.commit()
    db_session.refresh(resident)
    return resident.resident_id


def seed_history(db_session, resident_id, count, base_time=None):
    """
    Create `count` complaints for a resident, each one minute older than the
    previous, and return their ids in newest-first order (the order the API
    should return them in).
    """
    base_time = base_time or datetime(2026, 1, 1, 12, 0, 0)
    ids_newest_first = []
    for i in range(count):
        # i = 0 is the newest; older ones step back in time.
        created = base_time - timedelta(minutes=i)
        complaint = Complaint(
            category="Security",
            description=f"Complaint #{i}",
            location="A-101",
            raised_by=resident_id,
            status="submitted",
            created_at=created,
            updated_at=created,
        )
        db_session.add(complaint)
        db_session.commit()
        db_session.refresh(complaint)
        ids_newest_first.append(complaint.complaint_id)
    return ids_newest_first


# ── Ordering ────────────────────────────────────────────────────────────────────

class TestOrdering:

    def test_newest_first(self, client, db_session):
        rid = seed_resident(db_session)
        newest_first = seed_history(db_session, rid, 5)

        body = client.get(history_url(rid)).json()
        assert [c["complaint_id"] for c in body] == newest_first

    def test_same_timestamp_orders_deterministically(self, client, db_session):
        """Ties on created_at must break on complaint_id, identically every call."""
        rid = seed_resident(db_session)
        same = datetime(2026, 5, 1, 9, 0, 0)
        for i in range(6):
            c = Complaint(category="Security", description=f"tie {i}", location="A-101",
                          raised_by=rid, status="submitted", created_at=same, updated_at=same)
            db_session.add(c)
        db_session.commit()

        first = [c["complaint_id"] for c in client.get(history_url(rid)).json()]
        second = [c["complaint_id"] for c in client.get(history_url(rid)).json()]
        assert first == second                       # stable across calls
        assert first == sorted(first, reverse=True)  # complaint_id desc tiebreak


# ── Pagination ──────────────────────────────────────────────────────────────────

class TestPagination:

    def test_page_size_limits_the_slice(self, client, db_session):
        rid = seed_resident(db_session)
        newest_first = seed_history(db_session, rid, 10)

        resp = client.get(history_url(rid), params={"page": 1, "page_size": 3})
        assert resp.status_code == 200
        body = resp.json()
        assert [c["complaint_id"] for c in body] == newest_first[:3]
        assert resp.headers["X-Total-Count"] == "10"
        assert resp.headers["X-Page"] == "1"
        assert resp.headers["X-Page-Size"] == "3"
        assert resp.headers["X-Total-Pages"] == "4"  # ceil(10/3)

    def test_second_page_continues_where_first_ended(self, client, db_session):
        rid = seed_resident(db_session)
        newest_first = seed_history(db_session, rid, 10)

        page2 = client.get(history_url(rid), params={"page": 2, "page_size": 3}).json()
        assert [c["complaint_id"] for c in page2] == newest_first[3:6]

    def test_pages_cover_everything_once(self, client, db_session):
        rid = seed_resident(db_session)
        newest_first = seed_history(db_session, rid, 10)

        collected = []
        for page in range(1, 5):
            collected += [
                c["complaint_id"]
                for c in client.get(history_url(rid), params={"page": page, "page_size": 3}).json()
            ]
        assert collected == newest_first            # same order, no gaps
        assert len(set(collected)) == 10            # no duplicates

    def test_page_only_defaults_page_size(self, client, db_session):
        rid = seed_resident(db_session)
        seed_history(db_session, rid, 25)
        resp = client.get(history_url(rid), params={"page": 1})
        assert resp.headers["X-Page-Size"] == "20"   # DEFAULT_HISTORY_PAGE_SIZE
        assert len(resp.json()) == 20


# ── Edge cases ──────────────────────────────────────────────────────────────────

class TestEdgeCases:

    def test_no_history_unpaginated(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.get(history_url(rid))
        assert resp.status_code == 200
        assert resp.json() == []
        assert resp.headers["X-Total-Count"] == "0"

    def test_no_history_paginated(self, client, db_session):
        rid = seed_resident(db_session)
        resp = client.get(history_url(rid), params={"page": 1, "page_size": 10})
        assert resp.status_code == 200
        assert resp.json() == []
        assert resp.headers["X-Total-Count"] == "0"
        assert resp.headers["X-Total-Pages"] == "0"

    def test_page_past_the_end_is_empty_not_404(self, client, db_session):
        rid = seed_resident(db_session)
        seed_history(db_session, rid, 5)
        resp = client.get(history_url(rid), params={"page": 99, "page_size": 10})
        assert resp.status_code == 200
        assert resp.json() == []
        assert resp.headers["X-Total-Count"] == "5"

    def test_very_long_history_pages_end_to_end(self, client, db_session):
        rid = seed_resident(db_session)
        newest_first = seed_history(db_session, rid, 137)

        page_size = 25
        collected = []
        page = 1
        while True:
            resp = client.get(history_url(rid), params={"page": page, "page_size": page_size})
            assert resp.status_code == 200
            assert resp.headers["X-Total-Count"] == "137"
            chunk = resp.json()
            if not chunk:
                break
            assert len(chunk) <= page_size
            collected += [c["complaint_id"] for c in chunk]
            page += 1

        assert collected == newest_first
        assert len(set(collected)) == 137
        # 137 / 25 -> 6 pages, plus the 7th empty page that stops the loop.
        assert page == 7

    def test_full_unpaginated_returns_everything(self, client, db_session):
        rid = seed_resident(db_session)
        newest_first = seed_history(db_session, rid, 60)
        body = client.get(history_url(rid)).json()
        assert [c["complaint_id"] for c in body] == newest_first  # all 60, in order


# ── Validation ──────────────────────────────────────────────────────────────────

class TestValidation:

    def test_page_zero_is_rejected(self, client, db_session):
        rid = seed_resident(db_session)
        assert client.get(history_url(rid), params={"page": 0}).status_code == 422

    def test_negative_page_is_rejected(self, client, db_session):
        rid = seed_resident(db_session)
        assert client.get(history_url(rid), params={"page": -1}).status_code == 422

    def test_page_size_zero_is_rejected(self, client, db_session):
        rid = seed_resident(db_session)
        assert client.get(history_url(rid), params={"page_size": 0}).status_code == 422

    def test_page_size_over_max_is_rejected(self, client, db_session):
        rid = seed_resident(db_session)
        assert client.get(history_url(rid), params={"page_size": 101}).status_code == 422


# ── Unknown resident ────────────────────────────────────────────────────────────

class TestUnknownResident:

    def test_unknown_resident_unpaginated_returns_404(self, client, db_session):
        assert client.get(history_url("does-not-exist")).status_code == 404

    def test_unknown_resident_paginated_returns_404(self, client, db_session):
        resp = client.get(history_url("does-not-exist"), params={"page": 1, "page_size": 10})
        assert resp.status_code == 404
