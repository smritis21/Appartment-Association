/**
 * reminderService.js - BE-12.
 *
 * Talks to the Payment Reminders API and translates between the backend's
 * snake_case contract and the camelCase shape RemindersPage already uses.
 *
 * Endpoints used:
 *   POST /reminders                      - send a reminder
 *   GET  /reminders                      - list reminders
 *   GET  /reminders/stats                - aggregate statistics
 *   GET  /reminders/{id}                 - single reminder
 *   PUT  /reminders/{id}/dismiss         - dismiss a reminder
 */

import apiClient from "./apiClient";

// ── Shape translator ──────────────────────────────────────────────────────────

/** Backend ReminderOut -> UI reminder shape (matches mock/reminders.js fields) */
export function toUiReminder(dto) {
  return {
    id:          dto.reminder_id,
    billId:      dto.bill_id,
    residentId:  dto.resident_id,
    type:        dto.reminder_type,   // first_notice | second_notice | final_notice | custom
    channel:     dto.channel,
    status:      dto.status,          // sent | dismissed | failed
    sentAt:      dto.sent_at,
    dismissedAt: dto.dismissed_at ?? null,
    createdAt:   dto.created_at,
  };
}

/** Backend ReminderStats -> UI stats shape (matches getReminderStats() in mock) */
export function toUiStats(dto) {
  return {
    total:     dto.total     ?? 0,
    sent:      dto.sent      ?? 0,
    dismissed: dto.dismissed ?? 0,
    failed:    dto.failed    ?? 0,
    byType:    dto.by_type    ?? {},
    byChannel: dto.by_channel ?? {},
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function sendReminder(billId, residentId, reminderType, channel = "in_app", options = {}) {
  const data = await apiClient.post("/reminders", {
    bill_id:       billId,
    resident_id:   residentId,
    reminder_type: reminderType,
    channel,
  }, options);
  return toUiReminder(data);
}

export async function fetchReminders({ residentId, billId, status, skip = 0, limit = 50 } = {}, options = {}) {
  const params = new URLSearchParams();
  if (residentId) params.set("resident_id", residentId);
  if (billId)     params.set("bill_id", billId);
  if (status)     params.set("status", status);
  params.set("skip", skip);
  params.set("limit", limit);
  const data = await apiClient.get(`/reminders?${params}`, options);
  return (data?.items ?? []).map(toUiReminder);
}

export async function fetchReminderStats(options = {}) {
  const data = await apiClient.get("/reminders/stats", options);
  return toUiStats(data);
}

export async function fetchReminder(reminderId, options = {}) {
  const data = await apiClient.get(`/reminders/${encodeURIComponent(reminderId)}`, options);
  return toUiReminder(data);
}

export async function dismissReminder(reminderId, options = {}) {
  const data = await apiClient.put(
    `/reminders/${encodeURIComponent(reminderId)}/dismiss`,
    undefined,
    options
  );
  return toUiReminder(data);
}

