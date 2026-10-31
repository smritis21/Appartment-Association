"""
pytest tests for BE-35 — Staff Attendance & Shift API.

Story: as the Manager, I want endpoints so that attendance and shifts are
stored.

Covers:
  - POST /staff/shifts allocates a shift for an existing staff member
  - Overlapping shifts for the same staff member on the same day are
    rejected with 409; non-overlapping shifts (including back-to-back ones)
    are allowed
  - end_time <= start_time is rejected with 422
  - Allocating a shift for an unknown staff member returns 404
  - GET /staff/shifts filters by staff and date
  - POST /staff/attendance records a day's attendance and rejects a second
    record for the same staff member/date with 409
  - Attendance tied to a shift belonging to a different staff member
    returns 400; an unknown shift_id returns 404
  - Unknown attendance status is rejected with 422
  - GET /staff/attendance filters by staff, status and date range

Fixtures (client, db_session) are defined in conftest.py.
"""

from app.models.complaint import Staff

SHIFTS_URL = "/api/v1/staff/shifts"
ATTENDANCE_URL = "/api/v1/staff/attendance"


def seed_staff(db_session, **overrides) -> str:
    defaults = {"name": "Raju Kumar", "role": "maintenance", "phone": "9876500001"}
    defaults.update(overrides)
    staff = Staff(**defaults)
    db_session.add(staff)
    db_session.commit()
    db_session.refresh(staff)
    return staff.staff_id


def shift_payload(staff_id: str, **overrides) -> dict:
    defaults = {
        "staff_id": staff_id,
        "shift_date": "2026-08-15",
        "start_time": "09:00:00",
        "end_time": "17:00:00",
        "shift_type": "morning",
    }
    defaults.update(overrides)
    return defaults


# ── Shift allocation ─────────────────────────────────────────────────────────

def test_allocate_shift_succeeds(client, db_session):
    staff_id = seed_staff(db_session)

    response = client.post(SHIFTS_URL, json=shift_payload(staff_id))

    assert response.status_code == 201
    body = response.json()
    assert body["staff_id"] == staff_id
    assert body["shift_type"] == "morning"
    assert body["shift_id"]


def test_allocate_shift_unknown_staff_returns_404(client):
    response = client.post(SHIFTS_URL, json=shift_payload("does-not-exist"))
    assert response.status_code == 404


def test_end_time_before_start_time_returns_422(client, db_session):
    staff_id = seed_staff(db_session)
    response = client.post(
        SHIFTS_URL, json=shift_payload(staff_id, start_time="17:00:00", end_time="09:00:00")
    )
    assert response.status_code == 422


def test_overlapping_shift_returns_409(client, db_session):
    staff_id = seed_staff(db_session)
    client.post(SHIFTS_URL, json=shift_payload(staff_id, start_time="09:00:00", end_time="17:00:00"))

    response = client.post(
        SHIFTS_URL, json=shift_payload(staff_id, start_time="15:00:00", end_time="22:00:00")
    )
    assert response.status_code == 409


def test_back_to_back_shifts_do_not_conflict(client, db_session):
    staff_id = seed_staff(db_session)
    client.post(SHIFTS_URL, json=shift_payload(staff_id, start_time="09:00:00", end_time="17:00:00"))

    response = client.post(
        SHIFTS_URL, json=shift_payload(staff_id, start_time="17:00:00", end_time="22:00:00")
    )
    assert response.status_code == 201


def test_same_time_different_staff_does_not_conflict(client, db_session):
    staff_a = seed_staff(db_session, name="Staff A")
    staff_b = seed_staff(db_session, name="Staff B")
    client.post(SHIFTS_URL, json=shift_payload(staff_a))

    response = client.post(SHIFTS_URL, json=shift_payload(staff_b))
    assert response.status_code == 201


def test_same_shift_different_day_does_not_conflict(client, db_session):
    staff_id = seed_staff(db_session)
    client.post(SHIFTS_URL, json=shift_payload(staff_id, shift_date="2026-08-15"))

    response = client.post(SHIFTS_URL, json=shift_payload(staff_id, shift_date="2026-08-16"))
    assert response.status_code == 201


def test_list_shifts_filters_by_staff_and_date(client, db_session):
    staff_a = seed_staff(db_session, name="Staff A")
    staff_b = seed_staff(db_session, name="Staff B")
    client.post(SHIFTS_URL, json=shift_payload(staff_a, shift_date="2026-08-15"))
    client.post(SHIFTS_URL, json=shift_payload(staff_b, shift_date="2026-08-16"))

    response = client.get(f"{SHIFTS_URL}?staff_id={staff_a}")
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["staff_id"] == staff_a

    by_date = client.get(f"{SHIFTS_URL}?shift_date=2026-08-16")
    assert len(by_date.json()) == 1
    assert by_date.json()[0]["staff_id"] == staff_b


# ── Attendance ────────────────────────────────────────────────────────────────

def test_mark_attendance_succeeds(client, db_session):
    staff_id = seed_staff(db_session)

    response = client.post(
        ATTENDANCE_URL,
        json={"staff_id": staff_id, "attendance_date": "2026-08-15", "status": "present"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "present"
    assert body["staff_id"] == staff_id


def test_mark_attendance_unknown_staff_returns_404(client):
    response = client.post(
        ATTENDANCE_URL,
        json={"staff_id": "does-not-exist", "attendance_date": "2026-08-15", "status": "present"},
    )
    assert response.status_code == 404


def test_duplicate_attendance_same_day_returns_409(client, db_session):
    staff_id = seed_staff(db_session)
    payload = {"staff_id": staff_id, "attendance_date": "2026-08-15", "status": "present"}
    client.post(ATTENDANCE_URL, json=payload)

    response = client.post(ATTENDANCE_URL, json={**payload, "status": "absent"})
    assert response.status_code == 409


def test_attendance_same_staff_different_day_succeeds(client, db_session):
    staff_id = seed_staff(db_session)
    client.post(ATTENDANCE_URL, json={"staff_id": staff_id, "attendance_date": "2026-08-15", "status": "present"})

    response = client.post(ATTENDANCE_URL, json={"staff_id": staff_id, "attendance_date": "2026-08-16", "status": "absent"})
    assert response.status_code == 201


def test_attendance_with_shift_from_another_staff_returns_400(client, db_session):
    staff_a = seed_staff(db_session, name="Staff A")
    staff_b = seed_staff(db_session, name="Staff B")
    shift_id = client.post(SHIFTS_URL, json=shift_payload(staff_a)).json()["shift_id"]

    response = client.post(
        ATTENDANCE_URL,
        json={"staff_id": staff_b, "attendance_date": "2026-08-15", "status": "present", "shift_id": shift_id},
    )
    assert response.status_code == 400


def test_attendance_with_unknown_shift_returns_404(client, db_session):
    staff_id = seed_staff(db_session)
    response = client.post(
        ATTENDANCE_URL,
        json={"staff_id": staff_id, "attendance_date": "2026-08-15", "status": "present", "shift_id": "no-such-shift"},
    )
    assert response.status_code == 404


def test_unknown_attendance_status_returns_422(client, db_session):
    staff_id = seed_staff(db_session)
    response = client.post(
        ATTENDANCE_URL,
        json={"staff_id": staff_id, "attendance_date": "2026-08-15", "status": "on_vacation"},
    )
    assert response.status_code == 422


def test_list_attendance_filters_by_status_and_date_range(client, db_session):
    staff_id = seed_staff(db_session)
    client.post(ATTENDANCE_URL, json={"staff_id": staff_id, "attendance_date": "2026-08-14", "status": "present"})
    client.post(ATTENDANCE_URL, json={"staff_id": staff_id, "attendance_date": "2026-08-15", "status": "absent"})

    by_status = client.get(f"{ATTENDANCE_URL}?status=absent")
    assert len(by_status.json()) == 1
    assert by_status.json()[0]["attendance_date"] == "2026-08-15"

    by_range = client.get(f"{ATTENDANCE_URL}?date_from=2026-08-15&date_to=2026-08-15")
    assert len(by_range.json()) == 1
    assert by_range.json()[0]["status"] == "absent"
