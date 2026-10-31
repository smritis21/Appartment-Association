"""
Application configuration.
Reads from environment variables (or a .env file at the project root).
All other modules import settings from here - never read os.environ directly.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────────────────────
    # SQLite by default so a fresh clone runs with no database setup: the app
    # and its tests both work immediately after `pip install -r requirements.txt`.
    # Point this at PostgreSQL via .env (see .env.example) for production.
    DATABASE_URL: str = "sqlite:///./apartment.db"

    # ── App metadata ──────────────────────────────────────────────────────────
    APP_NAME: str = "Jains Kences Retreat - Apartment Association Management System"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True

    # ── Document storage ──────────────────────────────────────────────────────
    UPLOAD_DIR: str = "uploads"  # relative or absolute path for uploaded files

    # ── Complaint image limits (EN-01) ────────────────────────────────────────
    # A resident may attach one photo to a complaint. The limits below are
    # enforced at the submission boundary so a malformed, wrong-type, or
    # oversized image is rejected with a clear error before it is ever stored.
    #
    # 5 MB comfortably holds a phone photo while stopping someone from posting a
    # multi-hundred-MB payload that would exhaust memory and disk. The type list
    # is deliberately narrow: raster photo formats only. SVG is excluded on
    # purpose - it is XML that can carry scripts, so it is not a safe "image".
    MAX_COMPLAINT_IMAGE_BYTES: int = 5 * 1024 * 1024  # 5 MB
    ALLOWED_COMPLAINT_IMAGE_TYPES: str = "image/jpeg,image/png,image/webp"
    COMPLAINT_IMAGE_SUBDIR: str = "complaints"  # stored under UPLOAD_DIR

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # ── Security (placeholder for future JWT) ─────────────────────────────────
    SECRET_KEY: str = "change-this-to-a-long-random-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # ── Optional AI provider (BE-41) ──────────────────────────────────────────
    # Off by default: the analytics layer computes every figure itself and
    # only uses a model to reword the summary sentence. Leave AI_PROVIDER
    # empty and the platform runs fully offline with no key and no cost.
    #   AI_PROVIDER=ollama             - local, free
    #   AI_PROVIDER=openai_compatible  - free hosted tier (Groq, Gemini, ...)
    # Where the assistant reaches the API when looking something up for a
    # user. It calls back through HTTP on purpose, so the endpoint's own auth
    # and role checks apply rather than being bypassed.
    SELF_BASE_URL: str = "http://127.0.0.1:8000"

    AI_PROVIDER: str = ""
    AI_BASE_URL: str = ""
    AI_API_KEY: str = ""
    AI_MODEL: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    @property
    def allowed_origins_list(self) -> list[str]:
        """Return ALLOWED_ORIGINS as a Python list."""
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",")]

    @property
    def allowed_complaint_image_types(self) -> set[str]:
        """ALLOWED_COMPLAINT_IMAGE_TYPES as a normalised set of MIME strings."""
        return {
            t.strip().lower()
            for t in self.ALLOWED_COMPLAINT_IMAGE_TYPES.split(",")
            if t.strip()
        }


# Single shared instance - import this everywhere
settings = Settings()
