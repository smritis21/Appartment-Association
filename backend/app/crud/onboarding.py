"""CRUD operations for the Onboarding & Approval module (BE-22)."""

from sqlalchemy.orm import Session, joinedload

from app.models.onboarding import OnboardingApplication, UploadedDocument
from app.schemas.onboarding import DocumentUpload, OnboardingRegister


# ── OnboardingApplication ─────────────────────────────────────────────────────

def get_application(db: Session, application_id: str) -> OnboardingApplication | None:
    return (
        db.query(OnboardingApplication)
        .options(joinedload(OnboardingApplication.documents))
        .filter(OnboardingApplication.application_id == application_id)
        .first()
    )


def get_active_application_by_email(
    db: Session, email: str
) -> OnboardingApplication | None:
    """Return a pending or approved application for this email, if any."""
    return (
        db.query(OnboardingApplication)
        .filter(
            OnboardingApplication.email == email.lower(),
            OnboardingApplication.status.in_(["pending", "approved"]),
        )
        .first()
    )


def list_pending(db: Session) -> list[OnboardingApplication]:
    return (
        db.query(OnboardingApplication)
        .options(joinedload(OnboardingApplication.documents))
        .filter(OnboardingApplication.status == "pending")
        .order_by(OnboardingApplication.created_at)
        .all()
    )


def create_application(
    db: Session, data: OnboardingRegister
) -> OnboardingApplication:
    app = OnboardingApplication(
        user_id=data.user_id,
        applicant_name=data.applicant_name,
        email=data.email.lower(),
        phone=data.phone,
        applicant_type=data.applicant_type,
        block=data.block,
        floor=data.floor,
        flat_number=data.flat_number,
        move_in_date=data.move_in_date,
        occupation=data.occupation,
        owner_name=data.owner_name,
        status="pending",
    )
    db.add(app)
    return app


def get_approved_owner_for_flat(
    db: Session, block: str, flat_number: str
) -> OnboardingApplication | None:
    """Return the most recent approved *owner* application on file for this
    block/flat, if any. Used to auto-fill a tenant application's "Owner
    Name" field - the owner's name is the `applicant_name` on their own
    (approved) application, not a field they fill in themselves."""
    return (
        db.query(OnboardingApplication)
        .filter(
            OnboardingApplication.block == block,
            OnboardingApplication.flat_number == flat_number,
            OnboardingApplication.applicant_type == "owner",
            OnboardingApplication.status == "approved",
        )
        .order_by(OnboardingApplication.reviewed_at.desc())
        .first()
    )


# ── UploadedDocument ──────────────────────────────────────────────────────────

def get_document(db: Session, document_id: str) -> UploadedDocument | None:
    return (
        db.query(UploadedDocument)
        .filter(UploadedDocument.document_id == document_id)
        .first()
    )


def get_document_by_type(
    db: Session, application_id: str, document_type: str
) -> UploadedDocument | None:
    return (
        db.query(UploadedDocument)
        .filter(
            UploadedDocument.application_id == application_id,
            UploadedDocument.document_type == document_type,
        )
        .first()
    )


def create_document(db: Session, data: DocumentUpload) -> UploadedDocument:
    doc = UploadedDocument(
        application_id=data.application_id,
        document_type=data.document_type,
        file_reference=data.file_reference,
        original_filename=data.original_filename,
    )
    db.add(doc)
    return doc


def create_or_update_document(
    db: Session,
    application_id: str,
    document_type: str,
    file_reference: str,
    original_filename: str | None = None,
) -> UploadedDocument:
    doc = get_document_by_type(db, application_id, document_type)
    if doc:
        doc.file_reference = file_reference
        doc.original_filename = original_filename or doc.original_filename
        return doc
    doc = UploadedDocument(
        application_id=application_id,
        document_type=document_type,
        file_reference=file_reference,
        original_filename=original_filename,
    )
    db.add(doc)
    return doc

