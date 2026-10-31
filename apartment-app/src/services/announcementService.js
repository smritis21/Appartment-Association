/**
 * announcementService.js - INT-04 / INT-08 / INT-09 (BE-04, BE-08, BE-09).
 *
 * Talks to the Announcements API and translates the backend contract into the
 * shape the announcement components already render, so the UI did not have to
 * change to accept live data.
 *
 * Endpoints used:
 *   GET  /announcements/                    - dashboard list (INT-04)
 *   GET  /announcements/search              - keyword/category/date (INT-09)
 *   POST /announcements/                    - publish a notice (INT-08)
 *   PUT  /announcements/{id}                - edit a notice (INT-08)
 *
 * Contract differences worth knowing:
 *   - The backend keys announcements by an integer id; the mock used strings
 *     like "a8", and React keys/compares them, so ids are normalised to
 *     strings on the way in.
 *   - `created_at` is an ISO timestamp; the cards show a human date.
 */

import apiClient from "./apiClient";

/**
 * "2026-03-28T10:00:00" -> "28 March 2026", matching the mock's format.
 *
 * The backend sends naive UTC, which JavaScript would otherwise read as local
 * time - enough to show the wrong day for anything posted late in the evening.
 */
export function toDisplayDate(isoString) {
  if (!isoString) return "";
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(isoString);
  const parsed = new Date(hasZone ? isoString : `${isoString}Z`);
  if (Number.isNaN(parsed.getTime())) return String(isoString);
  return parsed.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** Backend AnnouncementResponse -> the shape the cards and detail pane use. */
export function toUiAnnouncement(raw) {
  return {
    id: String(raw.id),
    title: raw.title ?? "",
    body: raw.body ?? "",
    // Category is nullable server-side; the filter chips assume a value.
    category: raw.category || "General",
    author: raw.author || "Association",
    date: toDisplayDate(raw.created_at),
    visibility: raw.visibility || "public",
    pinned: Boolean(raw.pinned),
    status: raw.status || "published",
    scheduledFor: raw.scheduled_for ?? null,
    createdAt: raw.created_at ?? null,
  };
}

/** UI form values -> the AnnouncementCreate/Update body the API expects. */
export function toApiAnnouncement(values) {
  const body = {
    title: values.title,
    body: values.body,
    author: values.author || undefined,
    category: values.category || undefined,
    visibility: values.visibility || "public",
    pinned: Boolean(values.pinned),
  };

  // Drafts and scheduled notices are held back from the resident list by the
  // API. These are only sent when the caller actually set them, so that an
  // edit which touches neither cannot reset a draft to published or wipe an
  // existing schedule.
  if (values.status !== undefined) body.status = values.status;
  if (values.scheduledFor !== undefined) body.scheduled_for = values.scheduledFor;

  return body;
}

/**
 * INT-04 - the dashboard list.
 *
 * `filterType` maps to the backend's current/historical split; "all" is the
 * default the dashboard uses.
 */
export async function fetchAnnouncements({ filterType = "all", limit = 100 } = {}) {
  const params = new URLSearchParams({ filter_type: filterType, limit: String(limit) });
  const rows = await apiClient.get(`/announcements/?${params.toString()}`);
  return (rows ?? []).map(toUiAnnouncement);
}

/**
 * INT-09 - server-side search.
 *
 * Only non-empty filters are sent, so an untouched search box returns the full
 * list rather than filtering on empty strings. An empty result set is a normal
 * 200 with `[]`, which the page renders as its empty state.
 */
export async function searchAnnouncements({ keyword, category, date } = {}) {
  const params = new URLSearchParams();
  if (keyword) params.set("keyword", keyword);
  if (category && category !== "All") params.set("category", category);
  if (date) params.set("date", date);

  const query = params.toString();
  const rows = await apiClient.get(`/announcements/search${query ? `?${query}` : ""}`);
  return (rows ?? []).map(toUiAnnouncement);
}

/** INT-08 - publish a new notice. */
export async function createAnnouncement(values) {
  const created = await apiClient.post("/announcements/", toApiAnnouncement(values));
  return toUiAnnouncement(created);
}

/** INT-08 - edit an existing notice. */
export async function updateAnnouncement(id, values) {
  const updated = await apiClient.put(`/announcements/${id}`, toApiAnnouncement(values));
  return toUiAnnouncement(updated);
}

export default {
  fetchAnnouncements,
  searchAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  toUiAnnouncement,
  toApiAnnouncement,
  toDisplayDate,
};

