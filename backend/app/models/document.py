"""SQLAlchemy model for the Document Management module (BE-38); file bytes live on disk, this table holds metadata."""

import uuid

from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func

from app.database import Base


def _uuid() -> str:
    """Generate a new UUID4 string. Used as default PK value."""
    return str(uuid.uuid4())


class Document(Base):
    __tablename__ = "documents"

    document_id     = Column(String, primary_key=True, default=_uuid)

    # Human-readable metadata
    title           = Column(String(200), nullable=False)
    # ENUM values: rules | minutes | notices | financial | legal | other
    category        = Column(String(50), nullable=False, default="other")
    description     = Column(String(500), nullable=True)

    # File storage info
    filename        = Column(String(255), nullable=False)       # original filename
    stored_filename = Column(String(255), nullable=False)       # UUID-prefixed on disk
    file_path       = Column(String(500), nullable=False)       # absolute path on server
    mime_type       = Column(String(100), nullable=False)
    file_size_bytes = Column(Integer, nullable=False)

    # Access control
    # ENUM values: public | resident | admin
    access_role     = Column(String(20), nullable=False, default="resident")
    uploaded_by     = Column(String(100), nullable=True)        # placeholder for future auth

    created_at      = Column(DateTime, server_default=func.now(), nullable=False)
