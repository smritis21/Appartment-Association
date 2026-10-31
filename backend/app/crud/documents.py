"""CRUD operations for the Document Management module (BE-38)."""

from sqlalchemy.orm import Session

from app.models.document import Document


# ── Read ──────────────────────────────────────────────────────────────────────

def get_document(db: Session, document_id: str) -> Document | None:
    return db.query(Document).filter(Document.document_id == document_id).first()


def list_documents(
    db: Session,
    category: str | None = None,
    access_roles: list[str] | None = None,
    skip: int = 0,
    limit: int = 20,
) -> list[Document]:
    """
    Return documents filtered by category and/or accessible access_roles.

    access_roles: list of role values the requester is allowed to see.
    e.g. admin sees ['admin','resident','public'], resident sees ['resident','public'],
    anonymous sees ['public'].
    """
    q = db.query(Document)
    if category:
        q = q.filter(Document.category == category)
    if access_roles:
        q = q.filter(Document.access_role.in_(access_roles))
    return q.order_by(Document.created_at.desc()).offset(skip).limit(limit).all()


# ── Create ────────────────────────────────────────────────────────────────────

def create_document(db: Session, **kwargs) -> Document:
    doc = Document(**kwargs)
    db.add(doc)
    return doc


# ── Delete ────────────────────────────────────────────────────────────────────

def delete_document(db: Session, document: Document) -> None:
    """Hard-delete the document metadata row. File cleanup is done by the service."""
    db.delete(document)
