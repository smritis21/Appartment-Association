"""
Pydantic schemas for the Audit Log module (BE-39).

There is no router-exposed create endpoint - see app/crud/audit.py - but
AuditLogCreate exists so audit_service.log_action() has a typed shape to
build, same reasoning as CommunityActivityCreate/TempleBookingCreate being
used by unrouted crud helpers elsewhere.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AuditLogCreate(BaseModel):
    actor_id: Optional[str] = None
    actor_role: Optional[str] = Field(None, max_length=30)
    module: str = Field(..., max_length=50)
    action: str = Field(..., max_length=100)
    target_type: Optional[str] = Field(None, max_length=50)
    target_id: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None


class AuditLogOut(BaseModel):
    log_id: str
    actor_id: Optional[str] = None
    actor_role: Optional[str] = None
    module: str
    action: str
    target_type: Optional[str] = None
    target_id: Optional[str] = None
    description: Optional[str] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogListResponse(BaseModel):
    """Response envelope for GET /audit - pagination shape mirrors ComplaintReportResponse."""

    total: int = Field(..., ge=0, description="Total matching entries (before pagination)")
    page: int = Field(..., ge=1)
    page_size: int = Field(..., ge=1)
    pages: int = Field(..., ge=0, description="Total number of pages")
    items: list[AuditLogOut] = []
