/**
 * communityService.js - BE-34.
 *
 * Talks to the Community Corners API.
 *
 * Endpoints used:
 *   GET  /community/activities                        - list activities
 *   GET  /community/activities/{id}                   - get activity
 *   POST /community/activities/{id}/signup            - signup
 *   GET  /community/activities/{id}/signups           - list signups
 */

import apiClient from "./apiClient";

// ── Shape translator ──────────────────────────────────────────────────────────

export function toUiActivity(dto) {
  return {
    id:             dto.activity_id,
    corner:         dto.corner,
    title:          dto.title,
    description:    dto.description ?? "",
    activityDate:   dto.activity_date ?? null,
    capacity:       dto.capacity ?? null,
    status:         dto.status,
    signupCount:    dto.signup_count ?? 0,
    spotsRemaining: dto.spots_remaining ?? null,
    createdAt:      dto.created_at,
    updatedAt:      dto.updated_at,
  };
}

export function toUiSignup(dto) {
  return {
    id:          dto.signup_id,
    activityId:  dto.activity_id,
    residentId:  dto.resident_id,
    notes:       dto.notes ?? null,
    signedUpAt:  dto.signed_up_at,
  };
}

// ── Activities ────────────────────────────────────────────────────────────────

export async function fetchActivities({ corner, status, dateFrom, dateTo } = {}, options = {}) {
  const params = new URLSearchParams();
  if (corner)   params.set("corner", corner);
  if (status)   params.set("status", status);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo)   params.set("date_to", dateTo);
  const data = await apiClient.get(`/community/activities?${params}`, options);
  return (data ?? []).map(toUiActivity);
}

export async function fetchActivity(activityId, options = {}) {
  const data = await apiClient.get(
    `/community/activities/${encodeURIComponent(activityId)}`,
    options
  );
  return toUiActivity(data);
}

// ── Signups ───────────────────────────────────────────────────────────────────

export async function signupForActivity(activityId, residentId, notes = null, options = {}) {
  const body = { resident_id: residentId };
  if (notes) body.notes = notes;
  const data = await apiClient.post(
    `/community/activities/${encodeURIComponent(activityId)}/signup`,
    body,
    options
  );
  return toUiSignup(data);
}

export async function fetchSignups(activityId, options = {}) {
  const data = await apiClient.get(
    `/community/activities/${encodeURIComponent(activityId)}/signups`,
    options
  );
  return (data ?? []).map(toUiSignup);
}

