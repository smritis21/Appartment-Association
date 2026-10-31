/**
 * eventsService.js - BE-31.
 *
 * Talks to the Community Hub Events API.
 *
 * Endpoints used:
 *   GET  /events                          - list events
 *   POST /events                          - create event
 *   GET  /events/{id}                     - get event
 *   POST   /events/{id}/register           - RSVP or volunteer
 *   DELETE /events/{id}/register           - cancel an RSVP or volunteer registration
 *   GET    /events/{id}/registrations      - list registrations
 */

import apiClient from "./apiClient";

// ── Shape translator ──────────────────────────────────────────────────────────

export function toUiEvent(dto) {
  return {
    id:             dto.event_id,
    title:          dto.title,
    description:    dto.description ?? "",
    eventDate:      dto.event_date,
    venue:          dto.venue ?? "",
    capacity:       dto.capacity ?? null,
    gallery:        dto.gallery ?? [],
    createdBy:      dto.created_by ?? null,
    status:         dto.status,
    rsvpCount:      dto.rsvp_count ?? 0,
    volunteerCount: dto.volunteer_count ?? 0,
    spotsRemaining: dto.spots_remaining ?? null,
    createdAt:      dto.created_at,
    updatedAt:      dto.updated_at,
  };
}

export function toUiRegistration(dto) {
  return {
    id:         dto.registration_id,
    eventId:    dto.event_id,
    residentId: dto.resident_id,
    type:       dto.type,
    registeredAt: dto.registered_at,
  };
}

// ── Events ────────────────────────────────────────────────────────────────────

export async function fetchEvents({ status, dateFrom, dateTo } = {}, options = {}) {
  const params = new URLSearchParams();
  if (status)   params.set("status", status);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo)   params.set("date_to", dateTo);
  const data = await apiClient.get(`/events?${params}`, options);
  return (data ?? []).map(toUiEvent);
}

export async function fetchEvent(eventId, options = {}) {
  const data = await apiClient.get(`/events/${encodeURIComponent(eventId)}`, options);
  return toUiEvent(data);
}

export async function registerForEvent(eventId, residentId, type = "rsvp", options = {}) {
  const data = await apiClient.post(
    `/events/${encodeURIComponent(eventId)}/register`,
    { resident_id: residentId, type },
    options
  );
  return toUiRegistration(data);
}

/**
 * Cancel a resident's existing RSVP or volunteer registration.
 *
 * Counterpart to registerForEvent - "Cancel RSVP"/"Cancel Volunteering" must
 * call this, not re-POST the same registration (the backend correctly
 * rejects a duplicate POST with a 409 whose message reads like a bug when
 * shown to someone trying to cancel).
 */
export async function unregisterFromEvent(eventId, residentId, type = "rsvp", options = {}) {
  await apiClient.delete(
    `/events/${encodeURIComponent(eventId)}/register?resident_id=${encodeURIComponent(residentId)}&type=${encodeURIComponent(type)}`,
    options
  );
}

export async function fetchRegistrations(eventId, { type } = {}, options = {}) {
  const params = new URLSearchParams();
  if (type) params.set("type", type);
  const data = await apiClient.get(
    `/events/${encodeURIComponent(eventId)}/registrations?${params}`,
    options
  );
  return (data ?? []).map(toUiRegistration);
}

