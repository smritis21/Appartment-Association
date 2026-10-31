"""
Complaint image validation and storage (EN-01).

A resident may attach one photo when submitting a complaint. The submission
endpoint must never trust what the client says the file is, and must never let
a huge payload through - either would let a bad or oversized image reach
storage. Everything needed to accept an image safely lives here:

  - `validate_complaint_image` - the pure, side-effect-free guard. It parses
    the payload (raw base64 or a `data:` URI), rejects oversized payloads
    *before* fully materialising them, decodes the bytes, and confirms the
    real content is an allowed image type by sniffing its magic bytes rather
    than believing the declared MIME type. Raises HTTPException with a precise
    status code and a human-readable message on every rejection.

  - `store_complaint_image` - writes validated bytes under UPLOAD_DIR and
    returns the relative reference to persist on the complaint row.

Keeping validation pure means the tests can hammer the limits without touching
the filesystem, and the service layer stays a thin orchestrator.
"""

from __future__ import annotations

import base64
import binascii
import os
import uuid
from typing import NamedTuple

from fastapi import HTTPException, status

from app.config import settings

# ── Magic-byte signatures ──────────────────────────────────────────────────────
# The declared content type is a hint from the client and can be wrong or
# forged, so the real type is decided from the first bytes of the decoded
# content. A few non-image types are recognised too, purely so the error can
# say "this is a PDF" instead of a vague "unknown".

_EXTENSION_BY_TYPE = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}


def _sniff_content_type(content: bytes) -> str | None:
    """Best-effort MIME type from the leading bytes, or None if unrecognised."""
    if content[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    if content[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if content[:5] == b"%PDF-":
        return "application/pdf"
    head = content[:512].lstrip().lower()
    if head.startswith(b"<?xml") or head.startswith(b"<svg"):
        return "image/svg+xml"
    return None


def _human_mb(num_bytes: int) -> str:
    """'5.0 MB' - a size a resident can read, not a raw byte count."""
    return f"{num_bytes / (1024 * 1024):.1f} MB"


class ValidatedImage(NamedTuple):
    content: bytes
    content_type: str  # the sniffed, trusted type
    extension: str


def _parse_payload(data: str) -> tuple[str | None, str]:
    """
    Split the incoming string into (declared_type, base64_payload).

    Accepts either a bare base64 string or a base64 `data:` URI
    ("data:image/png;base64,iVBORw0..."). URL-encoded data URIs are refused:
    only base64 image payloads are supported here.
    """
    raw = data.strip()
    if raw.startswith("data:"):
        header, sep, payload = raw.partition(",")
        if not sep:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Malformed image data URI: no ',' separating the header from the data.",
            )
        meta = header[len("data:"):]
        if ";base64" not in meta.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only base64-encoded image data URIs are supported.",
            )
        declared = meta.split(";", 1)[0].strip() or None
        return declared, payload
    return None, raw


def validate_complaint_image(
    data: str,
    declared_type: str | None = None,
) -> ValidatedImage:
    """
    Validate a base64 (or data-URI) complaint image against the size and type
    limits in settings, returning the decoded bytes and their trusted type.

    Raises HTTPException:
      400 - the payload is not valid base64 / an empty or malformed image.
      413 - the image is larger than MAX_COMPLAINT_IMAGE_BYTES.
      415 - the content is not one of the allowed image types, or the declared
            type does not match the actual bytes.
    """
    max_bytes = settings.MAX_COMPLAINT_IMAGE_BYTES
    allowed = settings.allowed_complaint_image_types

    declared_from_uri, payload = _parse_payload(data)
    declared_type = (declared_type or declared_from_uri)
    payload = "".join(payload.split())  # drop any embedded whitespace/newlines

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image data was provided.",
        )

    # Reject an oversized payload before decoding it. Base64 inflates bytes by
    # ~4/3, so a payload longer than this cannot possibly fit under the limit -
    # bailing here means a 500 MB string is refused without allocating 500 MB.
    max_encoded = (max_bytes // 3 + 1) * 4 + 16
    if len(payload) > max_encoded:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Image is too large. The maximum allowed size is "
                f"{_human_mb(max_bytes)}."
            ),
        )

    try:
        content = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image data is not valid base64.",
        )

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The decoded image is empty.",
        )

    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"Image is {_human_mb(len(content))}, which exceeds the "
                f"{_human_mb(max_bytes)} limit."
            ),
        )

    sniffed = _sniff_content_type(content)
    allowed_list = ", ".join(sorted(allowed))

    if sniffed is None or sniffed not in allowed:
        label = sniffed or (declared_type or "unknown")
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported image type '{label}'. "
                f"Allowed types: {allowed_list}."
            ),
        )

    # The bytes are a valid, allowed image. If the client also declared a type,
    # it must agree with the content - a png labelled as jpeg is a sign the
    # upload was mishandled and should not pass silently.
    if declared_type and declared_type.strip().lower() != sniffed:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Declared content type '{declared_type}' does not match the "
                f"actual image content ('{sniffed}')."
            ),
        )

    return ValidatedImage(
        content=content,
        content_type=sniffed,
        extension=_EXTENSION_BY_TYPE.get(sniffed, "bin"),
    )


def store_complaint_image(image: ValidatedImage) -> str:
    """
    Persist validated image bytes under UPLOAD_DIR/<subdir> and return the
    relative reference to store on the complaint (e.g. "complaints/ab12.png").

    UPLOAD_DIR is read from settings at call time so tests can redirect it to a
    temp directory. The filename is a fresh UUID: it never comes from the
    client, so a crafted filename cannot escape the upload directory.
    """
    subdir = settings.COMPLAINT_IMAGE_SUBDIR
    dest_dir = os.path.join(settings.UPLOAD_DIR, subdir)
    os.makedirs(dest_dir, exist_ok=True)

    name = f"{uuid.uuid4().hex}.{image.extension}"
    with open(os.path.join(dest_dir, name), "wb") as handle:
        handle.write(image.content)

    return f"{subdir}/{name}"
