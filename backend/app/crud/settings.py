"""CRUD operations for the Settings & Configuration module (BE-40)."""

from sqlalchemy.orm import Session

from app.models.settings import ApartmentConfig, UserPreference


# ── User preferences ──────────────────────────────────────────────────────────

def get_preference(db: Session, user_id: str) -> UserPreference | None:
    return db.query(UserPreference).filter(UserPreference.user_id == user_id).first()


def create_default_preference(db: Session, user_id: str) -> UserPreference:
    preference = UserPreference(user_id=user_id)
    db.add(preference)
    return preference


# ── Apartment configuration ──────────────────────────────────────────────────

def get_config(db: Session, key: str) -> ApartmentConfig | None:
    return db.query(ApartmentConfig).filter(ApartmentConfig.key == key).first()


def list_config(db: Session) -> list[ApartmentConfig]:
    return db.query(ApartmentConfig).order_by(ApartmentConfig.key).all()


def upsert_config(db: Session, key: str, value: str, updated_by: str | None) -> ApartmentConfig:
    config = get_config(db, key)
    if config:
        config.value = value
        config.updated_by = updated_by
    else:
        config = ApartmentConfig(key=key, value=value, updated_by=updated_by)
        db.add(config)
    return config
