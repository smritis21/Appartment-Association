"""
Database configuration.

Provides:
  - engine          : SQLAlchemy engine connected to PostgreSQL
  - SessionLocal    : session factory (used by get_db dependency)
  - Base            : declarative base that all SQLAlchemy models inherit from

Usage in models:
    from app.database import Base
    class MyModel(Base): ...

Usage in routers (via dependency injection):
    from app.dependencies import get_db
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

# SQLite needs check_same_thread=False; PostgreSQL does not need it.
# This block handles both so you can switch by changing DATABASE_URL in .env.
_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

_engine_kwargs = {"pool_pre_ping": True}
if _is_sqlite:
    _engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(settings.DATABASE_URL, **_engine_kwargs)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)

# All SQLAlchemy models must inherit from this Base
Base = declarative_base()
