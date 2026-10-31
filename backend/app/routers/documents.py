"""
FastAPI router for the Document Management module (BE-38).

Role-based access is enforced via the 'X-User-Role' request header. Valid
roles: admin | resident | public (defaults to 'public' if header absent).
"""

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, Header, Query, status
from fastapi import UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.dependencies import get_db
from app.schemas.document import DocumentOut, DocumentSummary
from app.services import document_service as service

router = APIRouter(prefix="/documents", tags=["Documents"])


# Roles that manage society documents. The router speaks in terms of "admin",
# but the president and secretary are the people who actually publish rules and
# AGM minutes, so they are admitted on the same footing.
_ADMIN_ROLES = {"admin", "president", "secretary"}


def _get_role(
    x_user_role: Optional[str] = Header(default=None),
    authorization: Optional[str] = Header(default=None),
) -> str:
    """
    Work out what the requester is allowed to do.

    A signed-in user is the real answer, so a bearer token is read first and
    their stored role decides. The X-User-Role header is the interim stub this
    module was built against, kept as a fallback so existing callers and tests
    keep working; it should go once every caller sends a token.

    Defaults to 'public' when neither identifies the requester.
    """
    if authorization and authorization.lower().startswith("bearer "):
        try:
            from jose import jwt
            from app.config import settings

            claims = jwt.decode(
                authorization.split(" ", 1)[1],
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
            )
            role = (claims.get("role") or "").lower().strip()
            if role in _ADMIN_ROLES:
                return "admin"
            if role:
                return "resident"
        except Exception:
            # A bad or expired token is not proof of anything; fall through to
            # the header rather than failing the read outright.
            pass

    valid = {"admin", "resident", "public"}
    role = (x_user_role or "").lower().strip()
    return role if role in valid else "public"


# ── POST /documents/upload ────────────────────────────────────────────────────

@router.post(
    "/upload",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a society document",
    description=(
        "Upload a document file along with its metadata. "
        "**Admin role required** (send `X-User-Role: admin` header).\n\n"
        "**Allowed types:** PDF, JPEG, PNG, GIF, TXT, DOC, DOCX.\n\n"
        "**Max size:** 10 MB."
    ),
    responses={
        201: {"description": "Document uploaded successfully"},
        400: {"description": "Empty file"},
        403: {"description": "Admin role required"},
        413: {"description": "File exceeds 10 MB limit"},
        415: {"description": "Unsupported file type"},
        422: {"description": "Validation error"},
    },
)
async def upload_document(
    file:        UploadFile    = File(..., description="The file to upload"),
    title:       str           = Form(..., min_length=1, max_length=200, description="Document title"),
    category:    str           = Form("other", description="Category: rules | minutes | notices | financial | legal | other"),
    description: Optional[str] = Form(None,  max_length=500, description="Optional description"),
    access_role: str           = Form("resident", description="Who can access: public | resident | admin"),
    uploaded_by: Optional[str] = Form(None,  max_length=100, description="Uploader name/ID"),
    db:          Session       = Depends(get_db),
    requester_role: str        = Depends(_get_role),
):
    return await service.upload_document(
        db=db,
        file=file,
        title=title,
        category=category,
        description=description,
        access_role=access_role,
        uploaded_by=uploaded_by,
        requester_role=requester_role,
    )


# ── GET /documents ────────────────────────────────────────────────────────────

@router.get(
    "",
    response_model=list[DocumentSummary],
    summary="List society documents",
    description=(
        "Returns a list of documents accessible to the requester. "
        "Pass `X-User-Role` header to control visibility:\n\n"
        "- `admin` - sees all documents\n"
        "- `resident` - sees `resident` and `public` documents\n"
        "- `public` / absent - sees only `public` documents\n\n"
        "Optionally filter by `category`."
    ),
)
def list_documents(
    category: Optional[str] = Query(None, description="Filter by category: rules | minutes | notices | financial | legal | other"),
    skip:     int           = Query(0,  ge=0,        description="Records to skip"),
    limit:    int           = Query(20, ge=1, le=100, description="Max records to return (capped at 100)"),
    db:       Session       = Depends(get_db),
    requester_role: str     = Depends(_get_role),
):
    return service.list_documents(
        db=db,
        category=category,
        skip=skip,
        limit=limit,
        requester_role=requester_role,
    )


# ── GET /documents/{document_id} ──────────────────────────────────────────────

@router.get(
    "/{document_id}",
    response_model=DocumentOut,
    summary="Get document metadata",
    description=(
        "Returns the full metadata for a document. "
        "Returns 403 if the requester's role is insufficient."
    ),
    responses={
        200: {"description": "Document metadata"},
        403: {"description": "Access denied"},
        404: {"description": "Document not found"},
    },
)
def get_document(
    document_id:    str,
    db:             Session = Depends(get_db),
    requester_role: str     = Depends(_get_role),
):
    return service.get_document(db=db, document_id=document_id, requester_role=requester_role)


# ── GET /documents/{document_id}/download ─────────────────────────────────────

@router.get(
    "/{document_id}/download",
    summary="Download a document",
    description=(
        "Streams the document file to the client. "
        "Returns 403 if the requester's role is insufficient, "
        "or 404 if the file is missing from disk."
    ),
    response_class=FileResponse,
    responses={
        200: {"description": "File content", "content": {"application/octet-stream": {}}},
        403: {"description": "Access denied"},
        404: {"description": "Document or file not found"},
    },
)
def download_document(
    document_id:    str,
    db:             Session = Depends(get_db),
    requester_role: str     = Depends(_get_role),
):
    return service.download_document(
        db=db, document_id=document_id, requester_role=requester_role
    )


# ── DELETE /documents/{document_id} ──────────────────────────────────────────

@router.delete(
    "/{document_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete a document",
    description=(
        "Permanently deletes the document metadata and its file from disk. "
        "**Admin role required** (send `X-User-Role: admin` header)."
    ),
    responses={
        200: {"description": "Document deleted"},
        403: {"description": "Admin role required"},
        404: {"description": "Document not found"},
    },
)
def delete_document(
    document_id:    str,
    db:             Session = Depends(get_db),
    requester_role: str     = Depends(_get_role),
):
    return service.delete_document(
        db=db, document_id=document_id, requester_role=requester_role
    )
