/**
 * documentService.js - INT-38 (BE-38).
 *
 * Talks to the Documents API and translates it into the shape the document
 * list, preview dialog and detail page already render.
 *
 * Endpoints used:
 *   GET    /documents                    - the library
 *   POST   /documents/upload             - multipart upload (admin)
 *   GET    /documents/{id}               - metadata
 *   GET    /documents/{id}/download      - the file itself
 *   DELETE /documents/{id}               - remove (admin)
 *
 * Contract differences worth knowing:
 *   - The backend keys categories as short slugs ("rules", "minutes"); the UI
 *     shows them as titles ("Apartment Rules"), so the two are mapped both
 *     ways rather than one side being rewritten.
 *   - Sizes arrive in bytes; the cards show a human string.
 *   - Upload is multipart/form-data, so it bypasses the JSON apiClient helpers
 *     and uses fetch directly with the same auth header and error handling.
 */

import apiClient, { ApiError, NetworkError, getAuthToken } from "./apiClient";

const API_TO_UI_CATEGORY = {
  rules: "Apartment Rules",
  minutes: "AGM Minutes",
  notices: "Circulars",
  legal: "Society Certificates",
  financial: "Society Certificates",
  other: "Resident Documents",
};

const UI_TO_API_CATEGORY = {
  "Apartment Rules": "rules",
  "AGM Minutes": "minutes",
  Circulars: "notices",
  "Society Certificates": "legal",
  "Resident Documents": "other",
};

export function toApiCategory(uiCategory) {
  return UI_TO_API_CATEGORY[uiCategory] || "other";
}

/** 1258291 -> "1.2 MB", matching how the mock wrote sizes. */
export function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** "application/pdf" -> "PDF", which is what the file-type chip shows. */
export function fileTypeFromMime(mimeType = "", filename = "") {
  const fromName = filename.includes(".") ? filename.split(".").pop().toUpperCase() : "";
  if (fromName) return fromName;
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("word")) return "DOCX";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "XLSX";
  if (mimeType.includes("image")) return "IMG";
  return "FILE";
}

/** Backend DocumentSummary -> the shape the list and dialogs use. */
export function toUiDocument(raw) {
  const uploadDate = raw.created_at ? String(raw.created_at).slice(0, 10) : "";
  return {
    id: raw.document_id,
    title: raw.title ?? "",
    description: raw.description ?? "",
    category: API_TO_UI_CATEGORY[raw.category] || "Resident Documents",
    ownerName: raw.uploaded_by || "Society Admin",
    residentId: null,
    uploadedBy: raw.uploaded_by || "Society Admin",
    uploadDate,
    lastModified: uploadDate,
    fileType: fileTypeFromMime(raw.mime_type, raw.filename || ""),
    fileSize: formatFileSize(raw.file_size_bytes),
    // The API has no verification workflow; anything it serves is published.
    status: "Verified",
    visibility: raw.access_role === "public" ? "Public" : "Private",
    accessRole: raw.access_role || "resident",
    downloadable: true,
  };
}

/** INT-38 - the document library. */
export async function fetchDocuments({ category, limit = 100 } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (category && category !== "all") params.set("category", toApiCategory(category));
  const rows = await apiClient.get(`/documents?${params.toString()}`);
  return (rows ?? []).map(toUiDocument);
}

/**
 * INT-38 - admin upload.
 *
 * Multipart, so this cannot go through the JSON helper. The auth header and
 * the ApiError/NetworkError split are reproduced here so callers can handle
 * failures exactly as they do elsewhere - a 403 for a resident attempting an
 * admin upload has to reach the UI as a readable message.
 */
export async function uploadDocument({ file, title, category, description, accessRole = "resident", uploadedBy }) {
  const body = new FormData();
  body.append("file", file);
  body.append("title", title);
  body.append("category", toApiCategory(category));
  if (description) body.append("description", description);
  body.append("access_role", accessRole);
  if (uploadedBy) body.append("uploaded_by", uploadedBy);

  const token = getAuthToken?.();
  let response;
  try {
    response = await fetch(`${apiClient.baseUrl}/documents/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
  } catch {
    throw new NetworkError();
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail;
    const message = typeof detail === "string"
      ? detail
      : Array.isArray(detail) ? detail[0]?.msg : `Upload failed (${response.status}).`;
    throw new ApiError(response.status, message, payload);
  }
  return toUiDocument(payload);
}

/** INT-38 - the file itself, as a blob URL the browser can open or save. */
export async function downloadDocument(documentId) {
  const token = getAuthToken?.();
  let response;
  try {
    response = await fetch(`${apiClient.baseUrl}/documents/${documentId}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new NetworkError();
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(response.status, payload?.detail || `Download failed (${response.status}).`, payload);
  }
  return response.blob();
}

/**
 * Bug 8 - single-document metadata fetch, used by DocumentDetailPage and
 * DocumentPreviewDialog so both work off the real backend record instead of
 * the mock library (which only has fixture IDs, never a genuinely-uploaded
 * document's UUID).
 */
export async function fetchDocumentById(documentId) {
  const raw = await apiClient.get(`/documents/${documentId}`);
  return toUiDocument(raw);
}

/**
 * Bug 8 - hand the browser a blob to save under a given filename. Shared by
 * every "Download" button (DocumentManagementPage's table, DocumentDetailPage,
 * DocumentPreviewDialog) so there is exactly one implementation of "trigger a
 * save" rather than three copies of the same createElement("a") dance.
 */
export function saveBlobAsFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Bug 8 - fetch a document's file and save it under a name matching the
 * title/fileType shown in the UI. Throws NetworkError/ApiError like
 * downloadDocument() - callers decide how to surface that.
 */
export async function downloadDocumentAs(doc) {
  const blob = await downloadDocument(doc.id);
  saveBlobAsFile(blob, `${doc.title}.${(doc.fileType || "file").toLowerCase()}`);
}

/** INT-38 - remove a document (admin). */
export async function deleteDocument(documentId) {
  return apiClient.delete(`/documents/${documentId}`);
}

export default {
  fetchDocuments,
  fetchDocumentById,
  uploadDocument,
  downloadDocument,
  downloadDocumentAs,
  saveBlobAsFile,
  deleteDocument,
  toUiDocument,
  formatFileSize,
};

