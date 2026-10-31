/**
 * residentService.js - BE-18.
 *
 * Talks to the Residents API and translates between the backend's snake_case
 * contract and the camelCase shape ResidentManagementPage already uses.
 *
 * Endpoints used:
 *   GET    /residents                    - list residents (with optional filters)
 *   GET    /residents/search?q=...       - search by name / phone
 *   GET    /residents/{id}               - single resident detail
 *   POST   /residents                    - create a resident
 *   PUT    /residents/{id}               - update a resident
 *   DELETE /residents/{id}               - soft-delete (sets status=inactive)
 */

import apiClient from "./apiClient";

// ── Shape translator ──────────────────────────────────────────────────────────

/**
 * Backend ResidentOut -> UI resident shape (matches mock/residents.js fields).
 *
 * The backend Resident model has no `email` or `role` column (see
 * models/resident.py) - "owner" vs "tenant" only exists as the *flat's*
 * ownership_type, not per-resident, and email isn't captured on Resident at
 * all. `role` is approximated from the flat's ownership_type; `email` is
 * left blank for API-sourced residents until the backend model captures it.
 */
export function toUiResident(dto) {
  const ec = (dto.emergency_contacts ?? [])[0] ?? {};
  return {
    id:          dto.resident_id,
    name:        dto.name        ?? "",
    email:       dto.email       ?? "",
    phone:       dto.phone       ?? "",
    occupation:  dto.occupation  ?? "",
    role:        dto.role ?? (dto.flat?.ownership_type === "rented" ? "tenant" : "owner"),
    status:      dto.status      ?? "active",
    wing:        dto.flat?.block ?? dto.wing ?? "",
    flat:        dto.flat?.flat_number ?? dto.flat_number ?? "",
    moveInDate:  dto.move_in_date  ?? null,
    moveOutDate: dto.move_out_date ?? null,
    ownerName:   dto.owner_name   ?? null,
    leaseStart:  dto.lease_start  ?? null,
    leaseEnd:    dto.lease_end    ?? null,
    emergencyContact: {
      name:     ec.name         ?? "",
      relation: ec.relationship ?? ec.relation ?? "",
      phone:    ec.phone        ?? "",
    },
    documents:     dto.documents      ?? [],
    familyMembers: (dto.family_members ?? []).map(toUiFamilyMember),
  };
}

function toUiFlat(dto) {
  return {
    id:              dto.flat_id,
    block:           dto.block,
    floor:           dto.floor           ?? null,
    flatNumber:      dto.flat_number,
    ownershipType:   dto.ownership_type  ?? null,
    occupancyStatus: dto.occupancy_status ?? null,
  };
}

function toUiFamilyMember(dto) {
  return {
    id:       dto.member_id,
    name:     dto.name,
    relation: dto.relation ?? "",
    phone:    dto.phone    ?? "",
  };
}

function toUiEmergencyContact(dto) {
  return {
    id:           dto.contact_id,
    name:         dto.name,
    phone:        dto.phone,
    relationship: dto.relationship ?? "",
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * Resolve (block, flatNumber) to a flat_id, creating the flat if it doesn't
 * exist yet. POST /residents requires an existing flat_id - this is the
 * step that turns free-text "Wing/Flat No." form fields into one.
 */
export async function findOrCreateFlat({ block, flatNumber, floor, ownershipType }, options = {}) {
  const data = await apiClient.post(
    "/residents/flats",
    {
      block,
      flat_number: flatNumber,
      floor: floor || null,
      ownership_type: ownershipType || null,
    },
    options
  );
  return toUiFlat(data);
}

export async function fetchResidents({ status, skip = 0, limit = 50 } = {}, options = {}) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  params.set("skip", skip);
  params.set("limit", limit);
  const data = await apiClient.get(`/residents?${params}`, options);
  return (data ?? []).map(toUiResident);
}

export async function searchResidents(query, { limit = 20 } = {}, options = {}) {
  const params = new URLSearchParams({ q: query, limit });
  const data = await apiClient.get(`/residents/search?${params}`, options);
  return (data ?? []).map(toUiResident);
}

export async function fetchResident(residentId, options = {}) {
  const data = await apiClient.get(`/residents/${encodeURIComponent(residentId)}`, options);
  return toUiResident(data);
}

export async function createResident(payload, options = {}) {
  const data = await apiClient.post("/residents", payload, options);
  return toUiResident(data);
}

export async function updateResident(residentId, payload, options = {}) {
  const data = await apiClient.put(
    `/residents/${encodeURIComponent(residentId)}`,
    payload,
    options
  );
  return toUiResident(data);
}

export async function deleteResident(residentId, options = {}) {
  return apiClient.delete(`/residents/${encodeURIComponent(residentId)}`, options);
}

