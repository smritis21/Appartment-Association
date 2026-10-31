"""Service layer for the Document Management module (BE-38).

Access hierarchy is public < resident < admin: 'public' docs are visible
to everyone, 'resident' docs to residents and admins, 'admin' docs to
admins only. Only admins may upload or delete. Role is passed via the
'X-User-Role' header, a placeholder until JWT is wired in.
"""

import os
import uuid

from fastapi import HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.crud import documents as crud
from app.models.document import Document
from app.schemas.document import DocumentCategory, AccessRole

# ── Constants ─────────────────────────────────────────────────────────────────

ALLOWED_MIME_TYPES: set[str] = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "text/plain",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/msword",  # .doc
}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# Role hierarchy: which access_role values a given requester can see
_VISIBLE_ROLES: dict[str, list[str]] = {
    "admin":    ["admin", "resident", "public"],
    "resident": ["resident", "public"],
    "public":   ["public"],
    # Unknown / unauthenticated roles get public-only access
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_upload_dir() -> str:
    """Return the upload directory from config (or a sensible default)."""
    try:
        from app.config import settings
        upload_dir = getattr(settings, "UPLOAD_DIR", "uploads")
    except Exception:
        upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    return upload_dir


def _get_visible_roles(requester_role: str) -> list[str]:
    """Return the list of access_role values this requester can read."""
    return _VISIBLE_ROLES.get(requester_role, ["public"])


def _get_doc_or_404(db: Session, document_id: str) -> Document:
    doc = crud.get_document(db, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' not found.",
        )
    return doc


def _check_read_access(doc: Document, requester_role: str) -> None:
    """Raise 403 if the requester cannot read this document."""
    visible = _get_visible_roles(requester_role)
    if doc.access_role not in visible:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                f"Access denied. Document requires role '{doc.access_role}' "
                f"but requester has role '{requester_role}'."
            ),
        )


def _require_admin(requester_role: str) -> None:
    """Raise 403 if the requester is not an admin."""
    if requester_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can perform this action.",
        )


# ── Upload ────────────────────────────────────────────────────────────────────

async def upload_document(
    db: Session,
    file: UploadFile,
    title: str,
    category: str,
    description: str | None,
    access_role: str,
    uploaded_by: str | None,
    requester_role: str,
) -> Document:
    """
    Validate, save file to disk, and persist metadata to DB.
    Only admins may upload.
    """
    _require_admin(requester_role)

    # ── Validate MIME type ────────────────────────────────────────────────────
    content_type = file.content_type or ""
    if content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"File type '{content_type}' is not allowed. "
                f"Allowed types: {sorted(ALLOWED_MIME_TYPES)}"
            ),
        )

    # ── Read file bytes and check size ────────────────────────────────────────
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"File size {len(file_bytes)} bytes exceeds the "
                f"{MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB limit."
            ),
        )
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # ── Validate category ─────────────────────────────────────────────────────
    valid_categories = {"rules", "minutes", "notices", "financial", "legal", "other"}
    if category not in valid_categories:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid category '{category}'. Valid: {sorted(valid_categories)}",
        )

    # ── Validate access_role ──────────────────────────────────────────────────
    valid_roles = {"admin", "resident", "public"}
    if access_role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid access_role '{access_role}'. Valid: {sorted(valid_roles)}",
        )

    # ── Save to disk ──────────────────────────────────────────────────────────
    upload_dir = _get_upload_dir()
    stored_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(upload_dir, stored_filename)

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    # ── Persist metadata ──────────────────────────────────────────────────────
    doc = crud.create_document(
        db,
        title=title,
        category=category,
        description=description,
        filename=file.filename,
        stored_filename=stored_filename,
        file_path=os.path.abspath(file_path),
        mime_type=content_type,
        file_size_bytes=len(file_bytes),
        access_role=access_role,
        uploaded_by=uploaded_by,
    )
    db.commit()
    db.refresh(doc)
    return doc


# ── List ──────────────────────────────────────────────────────────────────────

def list_documents(
    db: Session,
    category: str | None,
    skip: int,
    limit: int,
    requester_role: str,
) -> list[Document]:
    """Return documents the requester is allowed to see, optionally by category."""
    visible_roles = _get_visible_roles(requester_role)
    return crud.list_documents(
        db,
        category=category,
        access_roles=visible_roles,
        skip=skip,
        limit=limit,
    )


# ── Get metadata ──────────────────────────────────────────────────────────────

def get_document(db: Session, document_id: str, requester_role: str) -> Document:
    """Return document metadata if the requester has access."""
    doc = _get_doc_or_404(db, document_id)
    _check_read_access(doc, requester_role)
    return doc


# ── Download ──────────────────────────────────────────────────────────────────

def download_document(
    db: Session,
    document_id: str,
    requester_role: str,
) -> FileResponse:
    """Stream the document file to the client if the requester has access."""
    doc = _get_doc_or_404(db, document_id)
    _check_read_access(doc, requester_role)

    if not os.path.exists(doc.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="File not found on server. It may have been removed.",
        )

    return FileResponse(
        path=doc.file_path,
        media_type=doc.mime_type,
        filename=doc.filename,
    )


# ── Delete ────────────────────────────────────────────────────────────────────

def delete_document(
    db: Session,
    document_id: str,
    requester_role: str,
) -> dict:
    """Delete document metadata and file from disk. Admin only."""
    _require_admin(requester_role)
    doc = _get_doc_or_404(db, document_id)

    # Remove the physical file (best-effort; don't fail if already gone)
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except OSError:
            pass  # log in production; not fatal

    crud.delete_document(db, doc)
    db.commit()
    return {"detail": f"Document '{document_id}' deleted successfully."}
