/**
 * templeService.js - BE-33.
 *
 * Talks to the Temple Management API.
 *
 * Endpoints used:
 *   POST /temple/sevas                        - book a seva
 *   GET  /temple/sevas                        - list bookings
 *   POST /temple/sevas/{id}/cancel            - cancel booking
 *   POST /temple/donations                    - record donation
 *   GET  /temple/donations                    - list donations
 *   GET  /temple/donations/{id}               - get donation
 *   POST /temple/events                       - create an event
 *   GET  /temple/events                       - list events
 *   POST /temple/events/{id}/signup           - signup for event
 *   GET  /temple/events/{id}/signups          - list signups
 */

import apiClient from "./apiClient";

// ── Shape translators ─────────────────────────────────────────────────────────

export function toUiBooking(dto) {
  return {
    id:          dto.booking_id,
    residentId:  dto.resident_id,
    sevaType:    (dto.seva_type || "").replace(/_/g, "-"),
    bookingDate: dto.booking_date,
    slot:        dto.slot ?? null,
    amount:      Number(dto.amount),
    status:      dto.status,
    createdAt:   dto.created_at,
    updatedAt:   dto.updated_at,
  };
}

export function toUiDonation(dto) {
  return {
    id:          dto.donation_id,
    residentId:  dto.resident_id ?? null,
    donorName:   dto.donor_name ?? null,
    purpose:     dto.purpose ?? "general",
    amount:      Number(dto.amount),
    paymentMode: dto.payment_mode ?? null,
    receiptNo:   dto.receipt_no ?? null,
    notes:       dto.notes ?? null,
    donatedAt:   dto.donated_at,
    createdAt:   dto.created_at,
  };
}

export function toUiTempleEvent(dto) {
  return {
    id:               dto.event_id,
    title:            dto.title,
    description:      dto.description ?? "",
    eventDate:        dto.event_date,
    venue:            dto.venue ?? "",
    volunteersNeeded: dto.volunteers_needed ?? null,
    volunteersJoined: dto.volunteers_joined ?? 0,
    status:           dto.status,
    createdAt:        dto.created_at,
    updatedAt:        dto.updated_at,
  };
}

export function toUiSignup(dto) {
  return {
    id:            dto.signup_id,
    eventId:       dto.event_id,
    residentId:    dto.resident_id,
    residentName:  dto.resident_name ?? "Resident",
    residentPhone: dto.resident_phone ?? null,
    flat:          dto.flat ?? null,
    type:          dto.type,
    signedUpAt:    dto.signed_up_at,
  };
}

// ── Seva Bookings ─────────────────────────────────────────────────────────────

export async function createSevaBooking({ residentId, sevaType, bookingDate, slot, amount } = {}, options = {}) {
  const normalizedSevaType = (sevaType || "").toLowerCase().replace(/-/g, "_");
  const data = await apiClient.post("/temple/sevas", {
    resident_id:  residentId,
    seva_type:    normalizedSevaType,
    booking_date: bookingDate,
    slot:         slot ?? null,
    amount:       String(amount),
  }, options);
  return toUiBooking(data);
}

export async function fetchSevaBookings({ residentId, sevaType, status, dateFrom, dateTo } = {}, options = {}) {
  const params = new URLSearchParams();
  if (residentId) params.set("resident_id", residentId);
  if (sevaType)   params.set("seva_type", sevaType.toLowerCase().replace(/-/g, "_"));
  if (status)     params.set("status", status);
  if (dateFrom)   params.set("date_from", dateFrom);
  if (dateTo)     params.set("date_to", dateTo);
  const data = await apiClient.get(`/temple/sevas?${params}`, options);
  return (data ?? []).map(toUiBooking);
}

export async function cancelSevaBooking(bookingId, options = {}) {
  const data = await apiClient.post(
    `/temple/sevas/${encodeURIComponent(bookingId)}/cancel`,
    undefined,
    options
  );
  return toUiBooking(data);
}

// ── Donations ─────────────────────────────────────────────────────────────────

export async function createDonation({ residentId, donorName, purpose, amount, paymentMode, receiptNo, notes } = {}, options = {}) {
  const body = { amount: String(amount) };
  if (residentId)  body.resident_id  = residentId;
  if (donorName)   body.donor_name   = donorName;
  if (purpose)     body.purpose      = purpose;
  if (paymentMode) body.payment_mode = paymentMode;
  if (receiptNo)   body.receipt_no   = receiptNo;
  if (notes)       body.notes        = notes;
  const data = await apiClient.post("/temple/donations", body, options);
  return toUiDonation(data);
}

export async function fetchDonations({ residentId, purpose, dateFrom, dateTo } = {}, options = {}) {
  const params = new URLSearchParams();
  if (residentId) params.set("resident_id", residentId);
  if (purpose)    params.set("purpose", purpose);
  if (dateFrom)   params.set("date_from", dateFrom);
  if (dateTo)     params.set("date_to", dateTo);
  const data = await apiClient.get(`/temple/donations?${params}`, options);
  return (data ?? []).map(toUiDonation);
}

export async function fetchDonation(donationId, options = {}) {
  const data = await apiClient.get(`/temple/donations/${encodeURIComponent(donationId)}`, options);
  return toUiDonation(data);
}

// ── Temple Events ─────────────────────────────────────────────────────────────

/**
 * POST /temple/events - publish a new temple event.
 *
 * Field mapping matches TempleEventCreate (schemas/temple.py) exactly:
 *   title, description, event_date, venue, volunteers_needed, status.
 */
export async function createTempleEvent(
  { title, description, eventDate, venue, volunteersNeeded, status } = {},
  options = {}
) {
  const body = {
    title,
    event_date: eventDate,
  };
  if (description) body.description = description;
  if (venue) body.venue = venue;
  if (volunteersNeeded) body.volunteers_needed = Number(volunteersNeeded);
  if (status) body.status = status;
  const data = await apiClient.post("/temple/events", body, options);
  return toUiTempleEvent(data);
}

export async function fetchTempleEvents({ status, dateFrom, dateTo } = {}, options = {}) {
  const params = new URLSearchParams();
  if (status)   params.set("status", status);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo)   params.set("date_to", dateTo);
  const data = await apiClient.get(`/temple/events?${params}`, options);
  return (data ?? []).map(toUiTempleEvent);
}

export async function signupForTempleEvent(eventId, residentId, type = "rsvp", options = {}) {
  const data = await apiClient.post(
    `/temple/events/${encodeURIComponent(eventId)}/signup`,
    { resident_id: residentId, type },
    options
  );
  return toUiSignup(data);
}

export async function fetchTempleEventSignups(eventId, options = {}) {
  const data = await apiClient.get(
    `/temple/events/${encodeURIComponent(eventId)}/signups`,
    options
  );
  return (data ?? []).map(toUiSignup);
}

export async function withdrawTempleEventSignup(eventId, residentId, type = "volunteer", options = {}) {
  const params = new URLSearchParams({
    resident_id: residentId,
    type,
  });
  return apiClient.delete(`/temple/events/${encodeURIComponent(eventId)}/signup?${params}`, options);
}

