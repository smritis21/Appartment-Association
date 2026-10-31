"""
main.py - FastAPI application entry point.

Responsibilities:
  - Create the FastAPI app with Swagger/OpenAPI metadata
  - Configure CORS middleware
  - Register all routers
  - Expose a health-check endpoint

To run locally:
    uvicorn app.main:app --reload

Swagger UI:   http://localhost:8000/docs
ReDoc:        http://localhost:8000/redoc
OpenAPI JSON: http://localhost:8000/openapi.json
"""

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import Base, engine
import app.models  # noqa: F401 - registers all models with Base before create_all

from app.routers import (
    alerts,
    analytics,
    announcements,
    assistant,
    audit,
    auth,
    billing,
    communication,
    community,
    complaints,
    directory,
    documents,
    events,
    facilities,
    forum,
    maintenance,
    marketplace,
    notifications,
    onboarding,
    payments,
    reminders,
    reports,
    residents,
    settings as settings_router,  # aliased: app.config.settings is already bound above
    staff,
    temple,
    workforce,
    visitors,
)
# ── Database tables ───────────────────────────────────────────────────────────
# Guarded to DEBUG mode (local SQLite development only).
# In production (PostgreSQL), use Alembic migrations instead:
#   alembic upgrade head
# Never rely on create_all() in a shared or production environment.
if settings.DEBUG:
    Base.metadata.create_all(bind=engine)

# ── App instance ──────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "Backend API for the Jains Kences Retreat Apartment Association "
        "Management System. Covers residents, payments, billing, complaints, "
        "visitors, maintenance, workforce, and community modules."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


@app.exception_handler(RequestValidationError)
async def epic3_request_validation_handler(
    request: Request,
    exc: RequestValidationError,
):
    """
    BE-01 explicitly requires invalid creation payloads to return 400, and
    BE-02 requires unknown status values to be rejected by its status update.
    Keep FastAPI's standard 422 response everywhere else in the application.
    """
    path = request.url.path.rstrip("/")
    is_complaint_create = request.method == "POST" and path == "/api/v1/complaints"
    is_complaint_status_update = (
        request.method == "PUT"
        and path.startswith("/api/v1/complaints/")
        and path.endswith("/status")
    )
    if is_complaint_create or is_complaint_status_update:
        return JSONResponse(
            status_code=400,
            content={"detail": jsonable_encoder(exc.errors())},
        )
    return await request_validation_exception_handler(request, exc)

# ── CORS ──────────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # Pagination metadata rides in response headers (e.g. resident complaint
    # history, BE-10); expose them so a browser client can actually read them.
    expose_headers=["X-Total-Count", "X-Page", "X-Page-Size", "X-Total-Pages"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
# Each teammate registers their router here once it is ready.
# Pattern:
#   from app.routers import <module>
#   app.include_router(<module>.router, prefix="/api/v1")

app.include_router(onboarding.router, prefix="/api/v1")
app.include_router(residents.router, prefix="/api/v1")
app.include_router(directory.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(announcements.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(complaints.router, prefix="/api/v1")
app.include_router(visitors.router, prefix="/api/v1")
app.include_router(staff.router, prefix="/api/v1")
app.include_router(workforce.router, prefix="/api/v1")
app.include_router(maintenance.router, prefix="/api/v1")
app.include_router(reminders.router, prefix="/api/v1")
app.include_router(alerts.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(facilities.router, prefix="/api/v1")
app.include_router(marketplace.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(assistant.router, prefix="/api/v1")
app.include_router(community.router, prefix="/api/v1")
app.include_router(temple.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(settings_router.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(communication.router, prefix="/api/v1")
app.include_router(forum.router, prefix="/api/v1")

# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/health", tags=["Health"], summary="Health check")
def health_check():
    """Returns 200 OK when the API is running."""
    return {"status": "ok", "version": settings.APP_VERSION}
