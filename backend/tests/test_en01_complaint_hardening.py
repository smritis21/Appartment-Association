"""
EN-01 — Harden Complaint Submission.

Story: as a resident, I want robust complaint submission so that bad input and
large images are handled gracefully.

Additional tests beyond test_be01_complaint_submission.py:
  - Inline image upload is validated for type and size at the boundary.
  - Oversized images are rejected with 413 — both a genuinely large decoded
    image and an oversized raw payload that is refused before it is decoded.
  - Non-image and disallowed types (PDF, SVG, GIF) are rejected with 415, by
    sniffing the real bytes — a spoofed content_type does not get through.
  - Malformed / empty base64 is rejected with 400.
  - A valid image is stored and its reference is recorded on the complaint.
  - Negative tests for missing / blank / unknown fields still return 400.
  - The pre-existing external image_reference path is unchanged.

Fixtures (client, db_session) are defined in conftest.py.
"""

import base64
import os

import pytest

from app.config import settings
from app.models.complaint import Complaint
from app.utils.images import validate_complaint_image

COMPLAINTS_URL = "/api/v1/complaints"


# ── Payload / image helpers ────────────────────────────────────────────────────

def complaint_payload(**overrides) -> dict:
    defaults = {
        "category": "Plumbing",
        "description": "Kitchen tap is leaking continuously.",
        "location": "A-101 kitchen",
        "raised_by": "resident-001",
    }
    defaults.update(overrides)
    return defaults


def b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")


# Magic-byte prefixes are all the validator inspects, so these minimal blobs are
# enough to be recognised as their type without shipping real image files.
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff\xe0"
WEBP_BYTES = b"RIFF\x00\x00\x00\x00WEBP" + b"\x00" * 8
GIF_BYTES = b"GIF89a" + b"\x00" * 16
PDF_BYTES = b"%PDF-1.4\n%background\n" + b"\x00" * 16
SVG_BYTES = b'<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'


def png_of_size(total_bytes: int) -> bytes:
    """A byte blob that sniffs as PNG and is exactly `total_bytes` long."""
    return PNG_MAGIC + b"\x00" * (total_bytes - len(PNG_MAGIC))


@pytest.fixture
def upload_tmp(monkeypatch, tmp_path):
    """Redirect stored images into a temp dir so tests never touch the repo."""
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    return tmp_path


# ── Valid inline image is accepted and stored ──────────────────────────────────

class TestValidInlineImage:

    def test_png_upload_is_accepted_and_stored(self, client, db_session, upload_tmp):
        payload = complaint_payload(
            image={"data": b64(png_of_size(2048)), "content_type": "image/png"}
        )
        resp = client.post(COMPLAINTS_URL, json=payload)

        assert resp.status_code == 201
        ref = resp.json()["image_reference"]
        assert ref.startswith("complaints/")
        assert ref.endswith(".png")
        # The bytes were actually written to the upload directory.
        assert os.path.exists(os.path.join(str(upload_tmp), ref))

    def test_jpeg_upload_is_accepted(self, client, upload_tmp):
        payload = complaint_payload(
            image={"data": b64(JPEG_MAGIC + b"\x00" * 100), "content_type": "image/jpeg"}
        )
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 201
        assert resp.json()["image_reference"].endswith(".jpg")

    def test_data_uri_form_is_accepted(self, client, upload_tmp):
        payload = complaint_payload(
            image={"data": "data:image/png;base64," + b64(png_of_size(512))}
        )
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 201

    def test_content_type_is_optional_when_bytes_are_valid(self, client, upload_tmp):
        payload = complaint_payload(image={"data": b64(WEBP_BYTES)})
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 201
        assert resp.json()["image_reference"].endswith(".webp")

    def test_inline_image_wins_over_external_reference(self, client, upload_tmp):
        payload = complaint_payload(
            image_reference="https://example.com/old.png",
            image={"data": b64(png_of_size(256)), "content_type": "image/png"},
        )
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 201
        # The stored reference replaces the external one so the row points at
        # the image we actually hold.
        assert resp.json()["image_reference"].startswith("complaints/")

    def test_image_at_exactly_the_limit_is_accepted(self, client, upload_tmp):
        payload = complaint_payload(
            image={"data": b64(png_of_size(settings.MAX_COMPLAINT_IMAGE_BYTES))}
        )
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 201


# ── Oversized images are rejected (413) ────────────────────────────────────────

class TestOversizedImage:

    def test_image_one_byte_over_the_limit_is_rejected(self, client, upload_tmp):
        payload = complaint_payload(
            image={"data": b64(png_of_size(settings.MAX_COMPLAINT_IMAGE_BYTES + 1))}
        )
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 413
        assert "exceeds" in resp.json()["detail"].lower()

    def test_oversized_payload_is_rejected_before_decoding(self, client, upload_tmp):
        # A raw base64 string far larger than any image could be under the limit
        # must be refused up front, without allocating the decoded bytes.
        huge = "A" * (settings.MAX_COMPLAINT_IMAGE_BYTES * 4 // 3 + 1024)
        payload = complaint_payload(image={"data": huge})
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 413
        assert "too large" in resp.json()["detail"].lower()

    def test_oversized_image_creates_no_complaint(self, client, db_session, upload_tmp):
        payload = complaint_payload(
            image={"data": b64(png_of_size(settings.MAX_COMPLAINT_IMAGE_BYTES + 1))}
        )
        client.post(COMPLAINTS_URL, json=payload)
        assert db_session.query(Complaint).count() == 0


# ── Wrong / spoofed types are rejected (415) ───────────────────────────────────

class TestUnsupportedImageType:

    def test_pdf_bytes_are_rejected(self, client, upload_tmp):
        payload = complaint_payload(image={"data": b64(PDF_BYTES)})
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 415
        assert "application/pdf" in resp.json()["detail"]

    def test_svg_is_rejected(self, client, upload_tmp):
        payload = complaint_payload(
            image={"data": b64(SVG_BYTES), "content_type": "image/svg+xml"}
        )
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 415

    def test_gif_is_rejected(self, client, upload_tmp):
        payload = complaint_payload(image={"data": b64(GIF_BYTES)})
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 415
        assert "image/gif" in resp.json()["detail"]

    def test_spoofed_content_type_does_not_get_through(self, client, upload_tmp):
        # A PDF that claims to be a PNG is caught by sniffing the real bytes.
        payload = complaint_payload(
            image={"data": b64(PDF_BYTES), "content_type": "image/png"}
        )
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 415

    def test_declared_type_must_match_actual_bytes(self, client, upload_tmp):
        # Valid PNG bytes, but declared as JPEG — a mismatch is rejected.
        payload = complaint_payload(
            image={"data": b64(png_of_size(256)), "content_type": "image/jpeg"}
        )
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 415
        assert "does not match" in resp.json()["detail"]


# ── Malformed image data is rejected (400) ─────────────────────────────────────

class TestMalformedImageData:

    def test_non_base64_data_is_rejected(self, client, upload_tmp):
        payload = complaint_payload(image={"data": "@@@ not base64 @@@"})
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 400
        assert "base64" in resp.json()["detail"].lower()

    def test_empty_image_object_is_rejected(self, client, upload_tmp):
        # `data` is required on the image object → Pydantic 422 mapped to 400.
        payload = complaint_payload(image={})
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 400

    def test_non_image_data_uri_is_rejected(self, client, upload_tmp):
        payload = complaint_payload(image={"data": "data:text/plain,hello"})
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 400


# ── Negative tests: missing / blank / unknown fields (400) ─────────────────────

class TestBadFieldInput:

    def test_missing_category_returns_400(self, client):
        payload = complaint_payload()
        del payload["category"]
        assert client.post(COMPLAINTS_URL, json=payload).status_code == 400

    def test_missing_description_returns_400(self, client):
        payload = complaint_payload()
        del payload["description"]
        assert client.post(COMPLAINTS_URL, json=payload).status_code == 400

    def test_missing_location_returns_400(self, client):
        payload = complaint_payload()
        del payload["location"]
        assert client.post(COMPLAINTS_URL, json=payload).status_code == 400

    def test_invalid_category_returns_400(self, client):
        assert client.post(
            COMPLAINTS_URL, json=complaint_payload(category="Nonsense")
        ).status_code == 400

    def test_blank_description_returns_400(self, client):
        assert client.post(
            COMPLAINTS_URL, json=complaint_payload(description="   ")
        ).status_code == 400

    def test_blank_location_returns_400(self, client):
        assert client.post(
            COMPLAINTS_URL, json=complaint_payload(location="   ")
        ).status_code == 400

    def test_description_over_max_length_returns_400(self, client):
        assert client.post(
            COMPLAINTS_URL, json=complaint_payload(description="x" * 2001)
        ).status_code == 400

    def test_unknown_field_is_rejected(self, client):
        # extra="forbid" on the schema → unknown keys are 400, not silently kept.
        assert client.post(
            COMPLAINTS_URL, json=complaint_payload(priority="urgent")
        ).status_code == 400

    def test_empty_body_returns_400(self, client):
        assert client.post(COMPLAINTS_URL, json={}).status_code == 400


# ── The external image_reference path is unchanged ─────────────────────────────

class TestExternalReferenceUnchanged:

    def test_external_image_reference_still_accepted(self, client):
        payload = complaint_payload(image_reference="complaints/leaking-tap.jpg")
        resp = client.post(COMPLAINTS_URL, json=payload)
        assert resp.status_code == 201
        assert resp.json()["image_reference"] == "complaints/leaking-tap.jpg"

    def test_no_image_at_all_is_still_valid(self, client):
        resp = client.post(COMPLAINTS_URL, json=complaint_payload())
        assert resp.status_code == 201
        assert resp.json()["image_reference"] is None


# ── Unit-level coverage of the validator itself ────────────────────────────────

class TestValidatorUnit:

    def test_returns_sniffed_type_and_extension(self):
        result = validate_complaint_image(b64(png_of_size(64)))
        assert result.content_type == "image/png"
        assert result.extension == "png"
        assert result.content.startswith(PNG_MAGIC)

    def test_raises_on_empty_string(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            validate_complaint_image("")
        assert exc.value.status_code == 400
