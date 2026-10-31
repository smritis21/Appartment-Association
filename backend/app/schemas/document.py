"""Pydantic schemas for the Document Management module (BE-38)."""

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Allowed ENUM values ───────────────────────────────────────────────────────

DocumentCategory = Literal["rules", "minutes", "notices", "financial", "legal", "other"]
AccessRole       = Literal["admin", "resident", "public"]


# ── Document schemas ──────────────────────────────────────────────────────────

class DocumentBase(BaseModel):
    title:       str                     = Field(..., min_length=1, max_length=200)
    category:    DocumentCategory        = "other"
    description: Optional[str]           = Field(None, max_length=500)
    access_role: AccessRole              = "resident"
    uploaded_by: Optional[str]           = Field(None, max_length=100)


class DocumentSummary(BaseModel):
    """Lightweight response used in list endpoints - no file_path exposed."""
    document_id:     str
    title:           str
    category:        str
    description:     Optional[str]
    mime_type:       str
    file_size_bytes: int
    access_role:     str
    uploaded_by:     Optional[str]
    created_at:      datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentOut(DocumentSummary):
    """Full document record - includes original filename."""
    filename:    str
    stored_filename: str

    model_config = ConfigDict(from_attributes=True)
