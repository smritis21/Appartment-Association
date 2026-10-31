/**
 * settingsService.js - BE-40.
 *
 * Talks to the Settings & Configuration API.
 *
 * The backend only tracks two notification channels (email/SMS) and two
 * appearance fields (theme/language) per user - the richer per-category
 * toggles and accentColor/fontSize/density in mock/settings.js have no
 * server-side field, so those stay local-only preferences until the model
 * grows to support them.
 *
 * Config keys (admin-only writes) currently recognised by the backend:
 *   society_name, emergency_contact_number, maintenance_due_day, gst_rate,
 *   visitor_pass_default_hours, late_fee_grace_days, late_fee_rate_percent,
 *   late_fee_max_percent, late_fee_proration
 *
 * Endpoints used:
 *   GET  /settings/preferences        - own preferences (auto-created on first read)
 *   PUT  /settings/preferences        - update own preferences (partial)
 *   GET  /settings/config             - list all apartment config
 *   GET  /settings/config/{key}       - read one config value
 *   PUT  /settings/config/{key}       - set a config value (admin only)
 */

import apiClient from "./apiClient";

// ── Shape translators ─────────────────────────────────────────────────────────

function toUiPreferences(dto) {
  return {
    emailNotifications: dto.notification_email,
    smsNotifications: dto.notification_sms,
    language: dto.language,
    theme: dto.theme,
    updatedAt: dto.updated_at,
  };
}

function toUiConfig(dto) {
  return {
    key: dto.key,
    value: dto.value,
    updatedBy: dto.updated_by ?? null,
    updatedAt: dto.updated_at,
  };
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchPreferences(options = {}) {
  const data = await apiClient.get("/settings/preferences", options);
  return toUiPreferences(data);
}

export async function updatePreferences(payload, options = {}) {
  const body = {};
  if (payload.emailNotifications !== undefined) body.notification_email = payload.emailNotifications;
  if (payload.smsNotifications !== undefined) body.notification_sms = payload.smsNotifications;
  if (payload.language !== undefined) body.language = payload.language;
  if (payload.theme !== undefined) body.theme = payload.theme;
  const data = await apiClient.put("/settings/preferences", body, options);
  return toUiPreferences(data);
}

export async function fetchAllConfig(options = {}) {
  const data = await apiClient.get("/settings/config", options);
  return (data ?? []).map(toUiConfig);
}

export async function fetchConfig(key, options = {}) {
  const data = await apiClient.get(`/settings/config/${encodeURIComponent(key)}`, options);
  return toUiConfig(data);
}

/** Admin-only - 403s for any other role. */
export async function setConfig(key, value, options = {}) {
  const data = await apiClient.put(`/settings/config/${encodeURIComponent(key)}`, { value: String(value) }, options);
  return toUiConfig(data);
}

