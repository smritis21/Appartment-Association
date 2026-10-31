/**
 * visitorService.js - FE-05 / BE-05.
 *
 * Talks to the Visitors API and translates between the backend's snake_case
 * contract and the camelCase shape the visitor components already use, so
 * VisitorRequestCard and friends did not need rewriting.
 *
 * Endpoints used:
 *   GET  /visitors?resident_id=...        - load the approval queue
 *   POST /visitors/{id}/decision          - record approve / reject / left_at_gate
 */

import apiClient from "./apiClient";
import { VISITOR_STATUS } from "../features/visitors/mock/visitors";
import { PASS_TYPE, ENTRY_STATE } from "../features/visitors/mock/passes";

/** Backend VisitorOut -> the shape the visitor UI components expect. */
export function toUiRequest(dto) {
  return {
    id: dto.visitor_id,
    residentId: dto.resident_id ?? null,
    name: dto.visitor_name,
    purpose: dto.purpose ?? "",
    phone: dto.phone ?? "",
    flat: dto.flat_number ?? "-",
    gate: dto.gate ?? "Main Gate",
    vehicle: dto.vehicle ?? null,
    requestedAt: dto.requested_at,
    status: dto.status,
    decision: dto.decision ?? null,
    decidedAt: dto.decided_at ?? null,
    decidedBy: dto.decided_by ?? null,
    notes: dto.decision_notes ?? null,
    collectedBy: dto.collected_by ?? null,
    pickupLocation: dto.pickup_location ?? null,
  };
}

/**
 * Backend VisitorOut -> the "pass" shape GateDeskPage / MyPassesPage expect
 * (mock/passes.js). The backend has no explicit pass "type" field - it's
 * approximated from `purpose`. `host` and `flat` are resolved server-side
 * from the issuing resident (see visitor_service._to_visitor_out()), not
 * left blank.
 */
export function toUiPass(dto) {
  const entry = dto.exit_time
    ? ENTRY_STATE.EXITED
    : dto.entry_time
    ? ENTRY_STATE.ON_PREMISE
    : ENTRY_STATE.AWAITING;
  return {
    id: dto.visitor_id,
    residentId: dto.resident_id ?? null,
    code: dto.pass_code ?? "",
    type: (dto.purpose ?? "").toLowerCase() === "delivery" ? PASS_TYPE.DELIVERY : PASS_TYPE.GUEST,
    visitorName: dto.visitor_name,
    purpose: dto.purpose ?? "",
    phone: dto.phone ?? "",
    flat: dto.flat_number ?? "-",
    host: dto.resident_name ?? "",
    validFrom: dto.valid_from,
    validTo: dto.valid_until,
    entry,
    entryAt: dto.entry_time ?? null,
    exitAt: dto.exit_time ?? null,
    gate: dto.gate ?? "Main Gate",
  };
}

/**
 * Fetch visitor requests, optionally scoped to one resident.
 * Throws NetworkError when the backend is unreachable - callers decide
 * whether to fall back to mock data.
 */
export async function fetchVisitorRequests(residentId) {
  const query = residentId ? `?resident_id=${encodeURIComponent(residentId)}` : "";
  const data = await apiClient.get(`/visitors${query}`);
  return (data ?? []).map(toUiRequest);
}

/**
 * Record a decision on a visitor request.
 *
 * @param {string} visitorId
 * @param {"approved"|"rejected"|"left_at_gate"} decision
 * @param {{ decidedBy?: string, notes?: string }} [options]
 * @returns the updated request in UI shape
 *
 * Errors surfaced to the caller as ApiError:
 *   409 - a decision was already recorded (duplicate)
 *   400 - request expired, or left_at_gate on a non-delivery
 *   404 - unknown request
 */
export async function submitVisitorDecision(visitorId, decision, options = {}) {
  const payload = { decision };
  if (options.decidedBy) payload.decided_by = options.decidedBy;
  if (options.notes) payload.notes = options.notes;

  const data = await apiClient.post(
    `/visitors/${encodeURIComponent(visitorId)}/decision`,
    payload
  );
  return toUiRequest(data);
}

/** Fetch passes issued by/for a resident, or a broader filtered history for the gate desk. */
export async function fetchPasses({ residentId, gate, dateFrom, dateTo, skip = 0, limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (residentId) params.set("resident_id", residentId);
  if (gate) params.set("gate", gate);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  params.set("skip", skip);
  params.set("limit", limit);
  const data = await apiClient.get(`/visitors?${params}`);
  return (data ?? []).map(toUiPass);
}

/** Issue a pre-authorised pass on behalf of a resident. Already "approved" on creation. */
export async function issuePass(payload) {
  const data = await apiClient.post("/visitors/passes", {
    visitor_name: payload.visitorName,
    purpose: payload.purpose,
    phone: payload.phone || null,
    resident_id: payload.residentId,
    gate: payload.gate || null,
    valid_from: payload.validFrom,
    valid_until: payload.validTo,
  });
  return toUiPass(data);
}

/**
 * Read-only preview of a pass by code - does NOT record entry or consume
 * the pass's single use. Use approvePassEntry() to actually check someone in.
 */
export async function lookupPassByCode(code) {
  const data = await apiClient.get(`/visitors/passes/${encodeURIComponent(code)}`);
  return toUiPass(data);
}

/** Redeem a pass at the gate - stamps entry_time. Single-use: a second call 409s. */
export async function approvePassEntry(code, gate) {
  const data = await apiClient.post("/visitors/passes/verify", { pass_code: code, gate: gate || null });
  return toUiPass(data);
}

/** Log a visitor's exit. Requires a prior entry; a second call 409s. */
export async function recordExit(visitorId) {
  const data = await apiClient.put(`/visitors/${encodeURIComponent(visitorId)}/exit`);
  return toUiPass(data);
}

/** The decisions the backend will accept - mirrors the API's enum. */
export const DECISIONS = {
  APPROVED: VISITOR_STATUS.APPROVED,
  REJECTED: VISITOR_STATUS.REJECTED,
  LEFT_AT_GATE: VISITOR_STATUS.LEFT_AT_GATE,
};

