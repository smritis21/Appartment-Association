/**
 * onboardingService.js - BE-22.
 *
 * Talks to the Onboarding & Approval API. Registration is two calls in
 * sequence: `POST /auth/register` creates the (pending) login account,
 * then `POST /onboarding/register` files the application against that
 * account's user_id - that link is what lets approve() later activate the
 * account and set its resident_id (see onboarding_service.py::approve).
 *
 * Endpoints used:
 *   POST /onboarding/register                 - submit an application
 *   POST /onboarding/upload-document           - attach a KYC document
 *   GET  /onboarding/status/{id}                - status lookup
 *   GET  /onboarding/pending                    - review queue (secretary/admin/president)
 *   GET  /onboarding/{id}                       - application detail (reviewer)
 *   PUT  /onboarding/{id}/approve               - approve
 *   PUT  /onboarding/{id}/reject                - reject
 */

import apiClient, { getAuthToken } from "./apiClient";

// ── Shape translator ──────────────────────────────────────────────────────────

/** Backend ApplicationOut/ApplicationSummary -> UI application shape (matches mock/onboarding.js fields). */
export function toUiApplication(dto) {
  return {
    id: dto.application_id,
    userId: dto.user_id ?? null,
    applicantName: dto.applicant_name,
    email: dto.email,
    phone: dto.phone ?? "",
    applicantType: dto.applicant_type,
    block: dto.block,
    floor: dto.floor ?? "",
    flatNumber: dto.flat_number,
    flatId: dto.flat_id ?? null,
    moveInDate: dto.move_in_date ?? null,
    occupation: dto.occupation ?? "",
    ownerName: dto.owner_name ?? "",
    status: dto.status,
    rejectionReason: dto.rejection_reason ?? null,
    reviewedBy: dto.reviewed_by ?? null,
    reviewedAt: dto.reviewed_at ?? null,
    residentId: dto.resident_id ?? null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    documents: (dto.documents ?? []).map(toUiDocument),
  };
}

/**
 * toUiApplication()'s output, reshaped to match the older mock/onboarding.js
 * field names (name/role/wing/flat/submittedAt) that ApprovalQueuePage,
 * ApprovalStatusPage and ApprovalCard already render.
 */
export function toUiApplicationRow(dto) {
  const app = dto.applicantName !== undefined ? dto : toUiApplication(dto);
  return {
    id: app.id,
    name: app.applicantName,
    email: app.email,
    phone: app.phone,
    role: app.applicantType,
    wing: app.block,
    flat: app.flatNumber,
    occupation: app.occupation,
    submittedAt: app.createdAt,
    status: app.status,
    ownerName: app.ownerName ?? null,
    leaseStart: null,
    leaseEnd: null,
    remarks: app.rejectionReason ?? "",
    documents: app.documents ?? [],
  };
}

export const DOC_TYPE_MAP = {
  aadhaar: "id_proof",
  id_proof: "id_proof",
  pan: "address_proof",
  address_proof: "address_proof",
  sale_deed: "ownership_deed",
  ownership_deed: "ownership_deed",
  rental_agreement: "rental_agreement",
  photo: "other",
  other: "other",
};

export function normalizeDocumentType(type) {
  if (!type) return "other";
  const key = String(type).toLowerCase().trim();
  return DOC_TYPE_MAP[key] || (["id_proof", "address_proof", "ownership_deed", "rental_agreement", "other"].includes(key) ? key : "other");
}

export function toUiDocument(dto) {
  if (!dto) return null;
  if (typeof dto === "string") {
    return {
      id: dto,
      type: dto,
      fileReference: dto,
      fileName: `${dto}.pdf`,
      fileUrl: null,
      downloadUrl: null,
      uploadedAt: null,
    };
  }
  const documentId = dto.document_id || dto.id;
  const rawRef = dto.file_reference || dto.fileReference || "";
  const isApiUrl = rawRef.startsWith("/api/v1") || rawRef.startsWith("http");
  const fileUrl = isApiUrl
    ? (rawRef.startsWith("http") ? rawRef : `${apiClient.baseUrl.replace(/\/api\/v1$/, "")}${rawRef}`)
    : (documentId ? `${apiClient.baseUrl}/onboarding/documents/${documentId}/file` : (rawRef.startsWith("data:") ? rawRef : null));

  return {
    id: documentId,
    applicationId: dto.application_id || dto.applicationId,
    type: dto.document_type || dto.type,
    fileReference: rawRef,
    fileName: dto.original_filename ?? dto.fileName ?? dto.file_reference ?? `${dto.document_type || "document"}.pdf`,
    fileUrl,
    downloadUrl: documentId ? `${apiClient.baseUrl}/onboarding/documents/${documentId}/download` : fileUrl,
    uploadedAt: dto.uploaded_at || dto.uploadedAt,
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function registerApplication(payload, options = {}) {
  const data = await apiClient.post(
    "/onboarding/register",
    {
      applicant_name: payload.applicantName,
      email: payload.email,
      phone: payload.phone || null,
      applicant_type: payload.applicantType,
      block: payload.block,
      floor: payload.floor || null,
      flat_number: payload.flatNumber,
      move_in_date: payload.moveInDate || null,
      occupation: payload.occupation || null,
      owner_name: payload.ownerName || null,
      user_id: payload.userId || null,
    },
    options
  );
  return toUiApplication(data);
}

/**
 * Look up the owner of record for a block/flat, so the tenant registration
 * form can auto-fill the "Owner Name" field. Returns { found, ownerName }.
 * Public endpoint (no auth) - safe to call as soon as the applicant has
 * picked a block and flat number, before any account exists.
 */
export async function lookupOwnerForFlat({ block, flatNumber }, options = {}) {
  const params = new URLSearchParams({ block, flat_number: flatNumber });
  const data = await apiClient.get(`/onboarding/owner-lookup?${params}`, options);
  return { found: !!data?.found, ownerName: data?.owner_name ?? "" };
}

export async function uploadDocument(payload, options = {}) {
  const data = await apiClient.post(
    "/onboarding/upload-document",
    {
      application_id: payload.applicationId,
      document_type: normalizeDocumentType(payload.documentType),
      file_reference: payload.fileReference,
      original_filename: payload.fileName || null,
    },
    options
  );
  return toUiDocument(data);
}

export async function uploadDocumentFile({ applicationId, documentType, file }, options = {}) {
  const formData = new FormData();
  formData.append("application_id", applicationId);
  formData.append("document_type", normalizeDocumentType(documentType));
  formData.append("file", file);

  const token = getAuthToken();
  const res = await fetch(`${apiClient.baseUrl}/onboarding/upload-file`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
    ...options,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Failed to upload document file");
  }
  const data = await res.json();
  return toUiDocument(data);
}

export async function downloadDocumentFile(documentId) {
  const token = getAuthToken();
  const res = await fetch(`${apiClient.baseUrl}/onboarding/documents/${documentId}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to download file");
  return res.blob();
}

export async function fetchStatus(applicationId, options = {}) {
  const data = await apiClient.get(
    `/onboarding/status/${encodeURIComponent(applicationId)}`,
    options
  );
  return toUiApplication(data);
}

export async function fetchPending(options = {}) {
  const data = await apiClient.get("/onboarding/pending", options);
  return (data ?? []).map(toUiApplication);
}

export async function fetchApplication(applicationId, options = {}) {
  const data = await apiClient.get(
    `/onboarding/${encodeURIComponent(applicationId)}`,
    options
  );
  return toUiApplication(data);
}

export async function approveApplication(applicationId, flatId, options = {}) {
  const data = await apiClient.put(
    `/onboarding/${encodeURIComponent(applicationId)}/approve`,
    flatId ? { flat_id: flatId } : {},
    options
  );
  return toUiApplication(data);
}

export async function rejectApplication(applicationId, rejectionReason, options = {}) {
  const data = await apiClient.put(
    `/onboarding/${encodeURIComponent(applicationId)}/reject`,
    { rejection_reason: rejectionReason },
    options
  );
  return toUiApplication(data);
}

