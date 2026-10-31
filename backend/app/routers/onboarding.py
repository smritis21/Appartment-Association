"""FastAPI router for the Onboarding & Approval module (BE-22)."""

from fastapi import APIRouter, Depends, File, Form, UploadFile, status
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db, require_roles
from app.schemas.onboarding import (
    ApplicationOut,
    ApplicationSummary,
    ApproveApplication,
    DocumentOut,
    DocumentUpload,
    OnboardingRegister,
    OwnerLookupOut,
    RejectApplication,
)
from app.services import onboarding_service as service

router = APIRouter(prefix="/onboarding", tags=["Onboarding"])

# Roles that can review applications
_REVIEWER_ROLES = ("secretary", "admin", "president")


# ── Public / resident endpoints ───────────────────────────────────────────────

@router.post(
    "/register",
    response_model=ApplicationOut,
    status_code=status.HTTP_201_CREATED,
    summary="Submit an onboarding registration",
    description=(
        "Creates a new onboarding application with `status = pending`. "
        "Duplicate active applications for the same email are rejected with 409."
    ),
    responses={
        201: {"description": "Application created successfully"},
        409: {"description": "Active application already exists for this email"},
        422: {"description": "Validation error"},
    },
)
def register(data: OnboardingRegister, db: Session = Depends(get_db)):
    return service.register(db, data)


@router.post(
    "/upload-document",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a KYC / supporting document",
    description=(
        "Attaches a document reference to an existing pending application. "
        "Supply a file path, base64 data URL, or object-storage key."
    ),
    responses={
        201: {"description": "Document recorded successfully"},
        400: {"description": "Application is not in pending status"},
        404: {"description": "Application not found"},
    },
)
def upload_document(data: DocumentUpload, db: Session = Depends(get_db)):
    return service.upload_document(db, data)


@router.post(
    "/upload-file",
    response_model=DocumentOut,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a KYC document file binary",
    description="Uploads a binary document file (PDF, PNG, JPG) stored per flat.",
)
async def upload_file(
    application_id: str = Form(...),
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    content = await file.read()
    return service.save_uploaded_document_file(
        db,
        application_id=application_id,
        document_type=document_type,
        filename=file.filename or f"{document_type}.bin",
        content=content,
    )


@router.get(
    "/documents/{document_id}/file",
    summary="Preview document file",
    description="Streams the uploaded KYC document file inline for browser preview.",
)
def preview_document_file(
    document_id: str,
    db: Session = Depends(get_db),
):
    return service.get_document_file_response(db, document_id, inline=True)


@router.get(
    "/documents/{document_id}/download",
    summary="Download document file",
    description="Downloads the uploaded KYC document file with original filename.",
)
def download_document_file(
    document_id: str,
    db: Session = Depends(get_db),
):
    return service.get_document_file_response(db, document_id, inline=False)


@router.get(
    "/status/{application_id}",
    response_model=ApplicationOut,
    summary="Get application status",
    description="Returns the current status and full detail of an application.",
    responses={
        200: {"description": "Application returned"},
        404: {"description": "Application not found"},
    },
)
def get_status(application_id: str, db: Session = Depends(get_db)):
    return service.get_application(db, application_id)


@router.get(
    "/owner-lookup",
    response_model=OwnerLookupOut,
    summary="Look up the owner of record for a block/flat",
    description=(
        "Used by the tenant registration form to auto-fill the 'Owner Name' "
        "field: returns the applicant name from the most recent *approved* "
        "owner application on file for the given block/flat, if any. Public "
        "(no auth) - called before an applicant has an active account."
    ),
    responses={
        200: {"description": "Lookup result returned (found may be false)"},
        422: {"description": "Validation error"},
    },
)
def owner_lookup(
    block: str,
    flat_number: str,
    db: Session = Depends(get_db),
):
    return service.lookup_owner_for_flat(db, block, flat_number)


# ── Management endpoints (secretary / admin / president) ──────────────────────

@router.get(
    "/pending",
    response_model=list[ApplicationSummary],
    summary="List pending applications",
    description="Returns all applications awaiting review, oldest first.",
    responses={
        200: {"description": "Pending applications returned"},
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient role"},
    },
)
def list_pending(
    db: Session = Depends(get_db),
    _: object = Depends(require_roles(*_REVIEWER_ROLES)),
):
    return service.list_pending(db)


@router.get(
    "/{application_id}",
    response_model=ApplicationOut,
    summary="Get application detail",
    description="Returns full application detail including uploaded documents.",
    responses={
        200: {"description": "Application returned"},
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient role"},
        404: {"description": "Application not found"},
    },
)
def get_application(
    application_id: str,
    db: Session = Depends(get_db),
    _: object = Depends(require_roles(*_REVIEWER_ROLES)),
):
    return service.get_application(db, application_id)


@router.put(
    "/{application_id}/approve",
    response_model=ApplicationOut,
    summary="Approve an application",
    description=(
        "Approves a pending application. Creates the Resident record (BE-18), "
        "activates the linked User account (BE-21), and writes an audit log entry. "
        "Only pending applications can be approved."
    ),
    responses={
        200: {"description": "Application approved"},
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient role"},
        404: {"description": "Application or flat not found"},
        409: {"description": "Application is not pending"},
    },
)
def approve(
    application_id: str,
    data: ApproveApplication = None,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*_REVIEWER_ROLES)),
):
    return service.approve(
        db,
        application_id,
        data or ApproveApplication(),
        reviewer_id=current_user.user_id,
        reviewer_role=current_user.role,
    )


@router.put(
    "/{application_id}/reject",
    response_model=ApplicationOut,
    summary="Reject an application",
    description=(
        "Rejects a pending application with a mandatory reason. "
        "No Resident or User is created. Writes an audit log entry."
    ),
    responses={
        200: {"description": "Application rejected"},
        401: {"description": "Authentication required"},
        403: {"description": "Insufficient role"},
        404: {"description": "Application not found"},
        409: {"description": "Application is not pending"},
    },
)
def reject(
    application_id: str,
    data: RejectApplication,
    db: Session = Depends(get_db),
    current_user=Depends(require_roles(*_REVIEWER_ROLES)),
):
    return service.reject(
        db,
        application_id,
        data,
        reviewer_id=current_user.user_id,
        reviewer_role=current_user.role,
    )
