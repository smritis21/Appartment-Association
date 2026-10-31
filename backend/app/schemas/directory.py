"""
Pydantic schemas for the Directory module (BE-23).

Only schemas that are genuinely new are defined here - resident/flat/family/
emergency-contact response shapes are reused from schemas/resident.py.
"""

from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.schemas.resident import FlatOut, ResidentSummary


# ── DirectoryOverview ─────────────────────────────────────────────────────────

class DirectoryOverview(BaseModel):
    total_flats:    int
    occupied_flats: int
    vacant_flats:   int
    total_residents: int
    active_residents: int
    blocks: list[str]


# ── DirectoryFlatOut ──────────────────────────────────────────────────────────
# Extends FlatOut with an embedded resident list and a count.
# Reuses ResidentSummary (already defined in schemas/resident.py) for each
# resident entry so there is no duplication of resident response shape.

class DirectoryFlatOut(FlatOut):
    resident_count: int = 0
    residents: list[ResidentSummary] = []

    model_config = ConfigDict(from_attributes=True)


# ── DirectorySearchResult ─────────────────────────────────────────────────────

class DirectorySearchResult(BaseModel):
    residents: list[ResidentSummary] = []
    flats: list[DirectoryFlatOut] = []
