"""
conftest.py — shared pytest fixtures for the entire test suite.

Uses an in-memory SQLite database so tests run without a real PostgreSQL
instance. Every test gets a fresh, isolated database session.

Why a shared connection?
  SQLite in-memory databases are connection-scoped: a second connection sees
  an empty database. By pinning every operation to one connection we ensure
  that create_all(), the test session, and the FastAPI TestClient all share
  the same in-memory state.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.dependencies import get_db
from app.main import app

# ── In-memory SQLite engine for tests ────────────────────────────────────────
# connect_args + same_thread=False are required for SQLite.
# The "check_same_thread" flag is needed because FastAPI runs the endpoint
# in a thread-pool thread while the fixture lives on the main thread.

test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
)

# Keep a single shared connection so every operation (create_all, session,
# TestClient) sees the same in-memory database.
_shared_connection = test_engine.connect()

# Wrap every transaction in a SAVEPOINT so we can roll back after each test
# without dropping and recreating tables.
@event.listens_for(test_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, _):
    dbapi_conn.execute("PRAGMA foreign_keys=ON")

TestingSessionLocal = sessionmaker(
    bind=_shared_connection,
    autocommit=False,
    autoflush=False,
)

# Create all tables once for the entire session.
Base.metadata.create_all(bind=_shared_connection)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture(scope="function")
def db_session():
    """
    Provide a clean database session for each test.
    Wraps the test in a transaction that is rolled back afterwards so every
    test starts with an empty database without recreating the schema.
    """
    transaction = _shared_connection.begin_nested()  # SAVEPOINT
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()  # undo all inserts from this test


@pytest.fixture(scope="function")
def client(db_session):
    """
    Provide a FastAPI TestClient that uses the test database session.
    Overrides the get_db dependency for the duration of the test.
    """
    def override_get_db():
        try:
            yield db_session
        finally:
            pass  # session lifecycle managed by db_session fixture

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def _no_live_model(monkeypatch):
    """
    Keep the suite off the network and independent of anyone's .env.

    Configuring a real provider is a local choice, and once AI_PROVIDER is set
    the assistant would call it during tests — making results depend on a key,
    a quota and a network. The provider is switched off for every test; the
    ones that exercise the model path turn it back on with a stub.
    """
    from app.config import settings

    monkeypatch.setattr(settings, "AI_PROVIDER", "", raising=False)
    monkeypatch.setattr(settings, "AI_API_KEY", "", raising=False)
