"""
seed_demo_users.py - Seed demo accounts into the backend database.

Bug 30 fix: each demo user is now also given a Flat + Resident row, with
User.resident_id pointing at it - mirroring how onboarding_service.py::approve()
links a User to a Resident once an application is approved. Without this link,
resident-scoped pages (Payment History, My Passes, ...) have no resident_id to
query against and silently show an empty/unexplained state for every demo login.
"""
from datetime import date, datetime, timezone

from app.database import SessionLocal, engine, Base
import app.models  # noqa: F401 - ensure all models are registered with Base
from app.models.user import User
from app.models.resident import Flat, Resident
from app.models.complaint import Staff, Complaint, ComplaintProgressLog
from app.models.notification import Notification
from app.utils.security import hash_password

# Each demo account gets its own flat so resident-scoped pages (payments,
# visitor passes, directory, ...) have something distinct to show per role.
users_data = [
    ("owner@jkr.com",        "Rajesh Sharma",  "owner",       "A", "101"),
    ("tenant@jkr.com",       "Ananya Roy",     "tenant",      "B", "102"),
    ("president@jkr.com",   "Suresh Kumar",   "president",   "C", "103"),
    ("secretary@jkr.com",   "Meena Iyer",     "secretary",   "D", "104"),
    ("admin@jkr.com",       "Karthik Raja",   "admin",       "E", "105"),
    ("maintenance@jkr.com", "Ramesh Babu",    "maintenance", "F", "106"),
    ("security@jkr.com",    "Guard Bahadur",  "security",    "G", "107"),
]


def _get_or_create_flat(db, block: str, flat_number: str) -> Flat:
    flat = (
        db.query(Flat)
        .filter(Flat.block == block, Flat.flat_number == flat_number)
        .first()
    )
    if flat:
        return flat
    flat = Flat(
        block=block,
        floor=flat_number[0],
        flat_number=flat_number,
        ownership_type="owned",
        occupancy_status="occupied",
    )
    db.add(flat)
    db.flush()
    return flat


def _get_or_create_resident(db, user: User, flat: Flat) -> Resident:
    resident = (
        db.query(Resident)
        .filter(Resident.user_id == user.user_id)
        .first()
    )
    if resident:
        return resident
    resident = Resident(
        user_id=user.user_id,
        flat_id=flat.flat_id,
        name=user.full_name,
        status="active",
        move_in_date=date.today(),
    )
    db.add(resident)
    db.flush()
    return resident


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    pwd_hash = hash_password("password123")

    count = 0
    for email, name, role, block, flat_number in users_data:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                full_name=name,
                role=role,
                hashed_password=pwd_hash,
                account_status="active",
            )
            db.add(user)
            db.flush()
        else:
            user.hashed_password = pwd_hash
            user.account_status = "active"
            user.role = role

        # Give every demo account a linked resident record + flat so
        # resident-scoped pages (payments, visitor passes, etc.) have
        # something real to query instead of a null resident_id.
        flat = _get_or_create_flat(db, block, flat_number)
        resident = _get_or_create_resident(db, user, flat)
        user.resident_id = resident.resident_id
        count += 1

    db.commit()

    # 4. Staff members
    staff_members = [
        ("Ramesh Babu", "maintenance", "9876543210"),
        ("Raju Kumar", "plumber", "9876500001"),
        ("Selvam R", "electrician", "9876500002"),
        ("Murugan S", "carpenter", "9876500003"),
    ]
    for s_name, s_role, s_phone in staff_members:
        existing_staff = db.query(Staff).filter(Staff.name == s_name).first()
        if not existing_staff:
            db.add(Staff(name=s_name, role=s_role, phone=s_phone, is_active="true"))
    db.commit()

    # 5. Complaints for Owner
    owner_user = db.query(User).filter(User.email == "owner@jkr.com").first()
    owner_res_id = owner_user.resident_id if owner_user else "res-owner-001"

    complaints_data = [
        ("cmp-001", "CMP-2026-0001", "electrical", "Bedroom fan not working properly", "Flat A-101", owner_res_id, "submitted"),
        ("cmp-002", "CMP-2026-0002", "plumbing", "Kitchen sink leakage near pipe joint", "Flat A-101", owner_res_id, "submitted"),
    ]
    for cid, ref, cat, desc, loc, raised, st in complaints_data:
        existing = db.query(Complaint).filter((Complaint.complaint_id == cid) | (Complaint.reference == ref)).first()
        if not existing:
            c = Complaint(
                complaint_id=cid,
                reference=ref,
                category=cat,
                description=desc,
                location=loc,
                raised_by=raised,
                status=st
            )
            db.add(c)
            log = ComplaintProgressLog(
                complaint_id=cid,
                status="submitted",
                notes="Complaint submitted by resident."
            )
            db.add(log)
        else:
            existing.raised_by = raised

    for comp in db.query(Complaint).all():
        if not comp.raised_by:
            comp.raised_by = owner_res_id
    db.commit()

    # 6. Notifications for Owner
    notifications_data = [
        ("notif-001", owner_res_id, "Complaint Submitted", "Your electrical complaint has been logged.", "complaint_status_change", "complaints", "cmp-001", False, "normal"),
        ("notif-002", owner_res_id, "Maintenance Bill Due", "Maintenance dues of Rs. 4,500 for September 2026 are generated.", "payment_due", "payments", None, False, "normal"),
        ("notif-003", owner_res_id, "Water Tank Cleaning", "Overhead tanks in Tower A will be cleaned tomorrow 10 AM.", "announcement", "announcements", None, False, "normal"),
    ]
    for nid, rid, title, msg, ntype, smod, seid, is_read, prio in notifications_data:
        existing = db.query(Notification).filter(Notification.notification_id == nid).first()
        if not existing:
            n = Notification(
                notification_id=nid,
                resident_id=rid,
                title=title,
                message=msg,
                notification_type=ntype,
                source_module=smod,
                source_event_id=seid,
                is_read=is_read,
                priority=prio
            )
            db.add(n)
        else:
            existing.resident_id = rid
    db.commit()

    print(f"Successfully seeded {count} demo accounts, flats, residents, staff, complaints, and notifications.")


if __name__ == "__main__":
    seed()
