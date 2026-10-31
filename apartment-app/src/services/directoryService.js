/**
 * directoryService.js - BE-23.
 *
 * Talks to the Directory API. Every endpoint here already requires a Bearer
 * token and does server-side RBAC masking (residents see their own data in
 * full, everyone else gets a masked phone / hidden emergency contacts) -
 * this service just forwards whatever the backend returns, so "UI privacy
 * matches the API" for free.
 *
 * The backend Resident model has no `role` (owner/tenant) or `email` column
 * - see residentService.js's toUiResident for the same note. `role` here is
 * likewise approximated from the flat's ownership_type.
 */

import apiClient from "./apiClient";
import { toUiResident } from "./residentService";

// ── Shape translators ─────────────────────────────────────────────────────────

function toUiSummary(dto) {
  return {
    id: dto.resident_id,
    name: dto.name ?? "",
    phone: dto.phone ?? "",
    status: dto.status ?? "active",
    role: dto.flat?.ownership_type === "rented" ? "tenant" : "owner",
    wing: dto.flat?.block ?? "",
    flat: dto.flat?.flat_number ?? "",
  };
}

/** Backend DirectoryFlatOut -> UI "row" shape (matches mock/directory.js's buildDirectoryRow). */
export function toUiFlatRow(dto) {
  const residents = (dto.residents ?? []).map(toUiSummary);
  const owner = residents.find((r) => r.role === "owner") ?? null;
  const tenant = residents.find((r) => r.role === "tenant") ?? null;
  return {
    flat: {
      id: dto.flat_id,
      wing: dto.block,
      flat: dto.flat_number,
      floor: dto.floor ?? "",
      status: dto.occupancy_status ?? "vacant",
      ownershipType: dto.ownership_type ?? null,
    },
    owner,
    tenant,
    residents,
    residentCount: dto.resident_count ?? residents.length,
  };
}

function toUiFamilyMember(dto) {
  return {
    id: dto.member_id,
    name: dto.name,
    relation: dto.relation ?? "",
    phone: dto.phone ?? "",
  };
}

function toUiEmergencyContact(dto) {
  return {
    id: dto.contact_id,
    name: dto.name,
    relation: dto.relationship ?? "",
    phone: dto.phone,
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchOverview(options = {}) {
  return apiClient.get("/directory", options);
}

export async function fetchDirectoryResidents(filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.block) params.set("block", filters.block);
  if (filters.residentType) params.set("resident_type", filters.residentType);
  params.set("skip", filters.skip ?? 0);
  params.set("limit", filters.limit ?? 100);
  const data = await apiClient.get(`/directory/residents?${params}`, options);
  return (data ?? []).map(toUiSummary);
}

export async function fetchDirectoryResident(residentId, options = {}) {
  const data = await apiClient.get(`/directory/residents/${encodeURIComponent(residentId)}`, options);
  return toUiResident(data);
}

export async function fetchDirectoryFlats(filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.block) params.set("block", filters.block);
  if (filters.ownershipType) params.set("ownership_type", filters.ownershipType);
  if (filters.occupancyStatus) params.set("occupancy_status", filters.occupancyStatus);
  params.set("skip", filters.skip ?? 0);
  params.set("limit", filters.limit ?? 100);
  const data = await apiClient.get(`/directory/flats?${params}`, options);
  return (data ?? []).map(toUiFlatRow);
}

export async function fetchDirectoryFlat(flatId, options = {}) {
  const data = await apiClient.get(`/directory/flats/${encodeURIComponent(flatId)}`, options);
  return toUiFlatRow(data);
}

export async function fetchHousehold(residentId, options = {}) {
  const data = await apiClient.get(`/directory/household/${encodeURIComponent(residentId)}`, options);
  return (data ?? []).map(toUiFamilyMember);
}

export async function fetchEmergencyContacts(residentId, options = {}) {
  const data = await apiClient.get(`/directory/emergency-contacts/${encodeURIComponent(residentId)}`, options);
  return (data ?? []).map(toUiEmergencyContact);
}

export async function searchDirectory(query, { limit = 20 } = {}, options = {}) {
  const params = new URLSearchParams({ q: query, limit });
  const data = await apiClient.get(`/directory/search?${params}`, options);
  return {
    residents: (data.residents ?? []).map(toUiSummary),
    flats: (data.flats ?? []).map(toUiFlatRow),
  };
}

