/**
 * notificationService.js - INT-03 / INT-37 (BE-03, BE-37).
 *
 * Talks to the Notifications API and translates it into the shape the
 * notifications panel and notification centre already render.
 *
 * Endpoints used:
 *   GET   /notifications?resident_id=…              - list + unread count
 *   PATCH /notifications/{resident_id}/mark-read    - mark some or all read
 *
 * Contract differences worth knowing:
 *   - The list endpoint is keyed by `resident_id`, which is not the same as
 *     the signed-in user's id. It lives on the user as `residentId`, and is
 *     null for accounts not linked to a flat (staff, for instance).
 *   - The unread count arrives in the envelope rather than being counted from
 *     the page of items, so it stays correct when the list is paginated.
 *   - Backend types are granular ("complaint_status_change"); the panel keys
 *     its icons off a shorter set, so the two are mapped explicitly.
 */

import apiClient from "./apiClient";

/** Backend notification_type -> the key the panel's icon map uses. */
const TYPE_TO_UI = {
  complaint_status_change: "complaint",
  booking_confirmed: "booking",
  payment_due: "payment",
  visitor_approval: "visitor",
  maintenance_update: "booking",
  announcement: "announcement",
  emergency_alert: "emergency",
  general: "announcement",
};

/**
 * Parse a timestamp coming from the API.
 *
 * The backend stores naive UTC ("2026-08-18T19:11:53" with no zone). JavaScript
 * reads a bare timestamp like that as *local* time, which shifted every
 * relative time by the machine's UTC offset - a notification created seconds
 * earlier read as "5 hours ago" in IST. Marking it as UTC when it carries no
 * zone of its own fixes that; strings that already specify one are left alone.
 */
export function parseApiDate(value) {
  if (!value) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
  const parsed = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** An ISO timestamp as the relative phrase the cards show ("2 min ago"). */
export function toRelativeTime(isoString) {
  const then = parseApiDate(isoString);
  if (!then) return "";

  const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";

  const steps = [
    ["min", 60],
    ["hour", 60],
    ["day", 24],
  ];
  let value = Math.floor(seconds / 60);
  let unit = "min";
  for (let i = 1; i < steps.length; i += 1) {
    if (value < steps[i][1]) break;
    value = Math.floor(value / steps[i][1]);
    unit = steps[i][0];
  }
  if (unit === "day" && value > 30) {
    return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

/** Backend NotificationSummary -> the shape the cards render. */
export function toUiNotification(raw) {
  return {
    id: raw.notification_id,
    type: TYPE_TO_UI[raw.notification_type] || "announcement",
    title: raw.title ?? "",
    // The list is a summary and carries no body; the title is the message on
    // a card that has nothing else to show.
    message: raw.message ?? "",
    time: toRelativeTime(raw.created_at),
    read: Boolean(raw.is_read),
    priority: raw.priority || "normal",
    sourceModule: raw.source_module || "general",
  };
}

/**
 * INT-03 - the panel's list and badge in one call.
 *
 * Returns `{ notifications, unreadCount }`. The count comes from the envelope
 * rather than the items, so it reflects everything unread and not just this
 * page.
 */
export async function fetchNotifications(residentId, { limit = 20 } = {}) {
  const params = new URLSearchParams({ resident_id: residentId, limit: String(limit) });
  const data = await apiClient.get(`/notifications?${params.toString()}`);
  return {
    notifications: (data?.notifications ?? []).map(toUiNotification),
    unreadCount: data?.unread_count ?? 0,
  };
}

/** INT-03 - mark one notification read. */
export async function markRead(residentId, notificationId) {
  return apiClient.patch(`/notifications/${residentId}/mark-read`, {
    notification_ids: [notificationId],
  });
}

/** INT-03 - mark every unread notification read. Omitting ids means "all". */
export async function markAllRead(residentId) {
  return apiClient.patch(`/notifications/${residentId}/mark-read`, {
    notification_ids: null,
  });
}

/** INT-37 - the notification centre's clear-all action. */
export async function clearAll(residentId) {
  return apiClient.delete(`/notifications/${residentId}`);
}

export default {
  fetchNotifications,
  markRead,
  markAllRead,
  clearAll,
  toUiNotification,
  toRelativeTime,
};

