"""Service layer for the Settings & Configuration module (BE-40).

Admin-only config writes are gated at the router with
Depends(require_roles("admin")), the same as routers/maintenance.py and
routers/onboarding.py, so that check is not repeated here.
"""

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.crud import settings as crud
from app.schemas.settings import ConfigOut, PreferenceOut, PreferenceUpdate
from app.services import audit_service


# ── Apartment config: allowed keys and per-key value validation ─────────────
# Single source of truth for which config keys exist and what a valid value
# looks like. Adding a new key means adding one entry here - no migration,
# since apartment_config is a key/value table.

def _validate_gst_rate(value: str) -> None:
    try:
        parsed = float(value)
    except ValueError:
        raise ValueError("gst_rate must be a number.")
    if not (0 <= parsed <= 100):
        raise ValueError("gst_rate must be between 0 and 100.")


def _validate_visitor_pass_hours(value: str) -> None:
    try:
        parsed = int(value)
    except ValueError:
        raise ValueError("visitor_pass_default_hours must be an integer.")
    if not (1 <= parsed <= 72):
        raise ValueError("visitor_pass_default_hours must be between 1 and 72.")


def _validate_maintenance_due_day(value: str) -> None:
    try:
        parsed = int(value)
    except ValueError:
        raise ValueError("maintenance_due_day must be an integer.")
    if not (1 <= parsed <= 28):
        raise ValueError("maintenance_due_day must be between 1 and 28 (safe for every month).")


def _validate_society_name(value: str) -> None:
    if not value.strip():
        raise ValueError("society_name cannot be blank.")


def _validate_emergency_contact_number(value: str) -> None:
    digits = value.strip()
    if not digits.isdigit() or not (7 <= len(digits) <= 15):
        raise ValueError("emergency_contact_number must be 7-15 digits.")



# ── Late-fee rules (BE-28) ───────────────────────────────────────────────────

def _validate_late_fee_grace_days(value: str) -> None:
    try:
        parsed = int(value)
    except ValueError:
        raise ValueError("late_fee_grace_days must be an integer.")
    if not (0 <= parsed <= 90):
        raise ValueError("late_fee_grace_days must be between 0 and 90.")


def _validate_late_fee_rate_percent(value: str) -> None:
    try:
        parsed = float(value)
    except ValueError:
        raise ValueError("late_fee_rate_percent must be a number.")
    if not (0 <= parsed <= 10):
        raise ValueError(
            "late_fee_rate_percent must be between 0 and 10 (percent per month)."
        )


def _validate_late_fee_max_percent(value: str) -> None:
    try:
        parsed = float(value)
    except ValueError:
        raise ValueError("late_fee_max_percent must be a number.")
    if not (0 <= parsed <= 100):
        raise ValueError(
            "late_fee_max_percent must be between 0 and 100 (percent of bill total)."
        )


def _validate_late_fee_proration(value: str) -> None:
    if value not in ("daily", "monthly"):
        raise ValueError("late_fee_proration must be either 'daily' or 'monthly'.")


ALLOWED_CONFIG_KEYS: dict[str, callable] = {
    "gst_rate": _validate_gst_rate,
    "visitor_pass_default_hours": _validate_visitor_pass_hours,
    "maintenance_due_day": _validate_maintenance_due_day,
    "society_name": _validate_society_name,
    "emergency_contact_number": _validate_emergency_contact_number,
    "late_fee_grace_days": _validate_late_fee_grace_days,
    "late_fee_rate_percent": _validate_late_fee_rate_percent,
    "late_fee_max_percent": _validate_late_fee_max_percent,
    "late_fee_proration": _validate_late_fee_proration,
}


# ── User preferences ──────────────────────────────────────────────────────────

def get_preferences(db: Session, user_id: str) -> PreferenceOut:
    """Returns the user's preferences, creating the default row on first read."""
    preference = crud.get_preference(db, user_id)
    if not preference:
        preference = crud.create_default_preference(db, user_id)
        db.commit()
        db.refresh(preference)
    return PreferenceOut.model_validate(preference)


def update_preferences(db: Session, user_id: str, data: PreferenceUpdate) -> PreferenceOut:
    """Updates only the fields supplied; creates the default row first if needed."""
    preference = crud.get_preference(db, user_id)
    if not preference:
        preference = crud.create_default_preference(db, user_id)

    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        if field in ("notification_email", "notification_sms"):
            value = "true" if value else "false"
        setattr(preference, field, value)

    db.commit()
    db.refresh(preference)
    return PreferenceOut.model_validate(preference)


# ── Apartment configuration ──────────────────────────────────────────────────

def list_config(db: Session) -> list[ConfigOut]:
    rows = crud.list_config(db)
    return [ConfigOut.model_validate(row) for row in rows]


def get_config(db: Session, key: str) -> ConfigOut:
    config = crud.get_config(db, key)
    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Config key '{key}' has not been set.",
        )
    return ConfigOut.model_validate(config)


def update_config(
    db: Session, key: str, value: str, updated_by: str, updated_by_role: str
) -> ConfigOut:
    """
    Set or update an apartment configuration value.

    Errors:
      400 - key is not a recognised configuration key, or the value fails
            that key's validation rule
    """
    validator = ALLOWED_CONFIG_KEYS.get(key)
    if validator is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"'{key}' is not a recognised configuration key. "
                f"Allowed keys: {', '.join(sorted(ALLOWED_CONFIG_KEYS))}."
            ),
        )
    try:
        validator(value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    config = crud.upsert_config(db, key, value, updated_by)
    audit_service.log_action(
        db,
        actor_id=updated_by,
        actor_role=updated_by_role,
        module="settings",
        action="config_updated",
        target_type="apartment_config",
        target_id=key,
        description=f"Config '{key}' set to '{value}'.",
    )
    db.commit()
    db.refresh(config)
    return ConfigOut.model_validate(config)
