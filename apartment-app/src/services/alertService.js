/**
 * alertService.js - FE-19 / BE-19.
 *
 * Talks to the Emergency Alert API and translates the backend's snake_case
 * contract into the camelCase shape the alert screens use.
 *
 * Endpoints used:
 *   POST /alerts/emergency               - broadcast to all (or one block)
 *   GET  /alerts                         - past broadcasts with delivery counts
 *   GET  /alerts/{id}/deliveries         - per-recipient delivery status
 */

import apiClient from "./apiClient";

/** Delivery statuses the backend records per recipient. */
export const DELIVERY_STATUS = {
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
};

/**
 * The FE-19 target buttons map onto the API's optional `target_block`.
 * "all" means omit the field entirely; the tower options send their block
 * letter. Keeping the mapping here means the page never has to know that
 * "all" is expressed as an absent field rather than a value.
 */
export const TARGET_BLOCKS = {
  all: null,
  tower_a: "A",
  tower_b: "B",
  tower_c: "C",
};

export function targetToBlock(target) {
  return TARGET_BLOCKS[target] ?? null;
}

/** Backend AlertDeliveryOut -> UI shape. */
export function toUiDelivery(dto) {
  return {
    id: dto.delivery_id,
    residentId: dto.resident_id,
    name: dto.recipient_name ?? "Unknown resident",
    phone: dto.recipient_phone ?? null,
    flat: dto.flat_number ?? "-",
    channel: dto.channel,
    status: dto.status,
    failureReason: dto.failure_reason ?? null,
    deliveredAt: dto.delivered_at ?? null,
  };
}

/** Backend AlertOut / AlertSummaryOut -> UI shape. */
export function toUiAlert(dto) {
  return {
    id: dto.alert_id,
    title: dto.title,
    message: dto.message,
    severity: dto.severity,
    targetBlock: dto.target_block ?? null,
    raisedBy: dto.raised_by ?? null,
    recipientCount: dto.recipient_count ?? 0,
    sentCount: dto.sent_count ?? 0,
    failedCount: dto.failed_count ?? 0,
    createdAt: dto.created_at,
    // Only the detail responses carry deliveries; the list omits them.
    deliveries: (dto.deliveries ?? []).map(toUiDelivery),
  };
}

/**
 * Broadcast an emergency alert.
 *
 * @param {{ title: string, message: string, target?: string, raisedBy?: string }} alert
 * @returns the created alert in UI shape, including the per-recipient log
 *
 * Errors surfaced to the caller as ApiError:
 *   400 - unknown target block, or no active residents to notify
 *   422 - title missing, or message under 10 characters
 * NetworkError means the backend is unreachable; the caller decides whether
 * to fall back.
 */
export async function broadcastEmergencyAlert({ title, message, target = "all", raisedBy }) {
  const payload = { title, message };

  const block = targetToBlock(target);
  if (block) payload.target_block = block;
  if (raisedBy) payload.raised_by = raisedBy;

  return toUiAlert(await apiClient.post("/alerts/emergency", payload));
}

/** Past emergency broadcasts, newest-first, without their delivery rows. */
export async function fetchAlerts(limit = 50) {
  const data = await apiClient.get(`/alerts?limit=${encodeURIComponent(limit)}`);
  return (data ?? []).map(toUiAlert);
}

/**
 * Per-recipient delivery log for one alert.
 *
 * @param {string} alertId
 * @param {string} [status] "sent" | "failed" | "pending" to filter
 */
export async function fetchAlertDeliveries(alertId, status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  const data = await apiClient.get(
    `/alerts/${encodeURIComponent(alertId)}/deliveries${query}`
  );
  return (data ?? []).map(toUiDelivery);
}

