/**
 * workforceService.js - INT-26: Integrate Workforce Management
 *
 * Talks to:
 *   GET/POST /workforce/house-help
 *   GET/POST /workforce/house-help/bookings
 *   PUT      /workforce/house-help/bookings/{id}/status
 *   GET/POST /workforce/house-help/attendance
 *   POST     /workforce/house-help/ratings
 *   GET      /workforce/house-help/{id}/ratings
 *   GET/POST /workforce/providers
 *   GET/POST /workforce/provider-jobs
 *   PUT      /workforce/provider-jobs/{id}/status
 */

import apiClient from "./apiClient";

// ── House Help ──────────────────────────────────────────────────────────────

export async function fetchHouseHelp(filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.serviceType) params.set("service_type", filters.serviceType);
  if (filters.activeOnly)  params.set("active_only",  "true");
  const q = params.toString() ? `?${params}` : "";
  const rows = await apiClient.get(`/workforce/house-help${q}`, options);
  return (rows ?? []).map(toUiHouseHelp);
}

function toUiHouseHelp(h) {
  return {
    id:          h.id,
    name:        h.name,
    serviceType: h.service_type,
    phone:       h.phone ?? "",
    active:      h.active ?? true,
    avgRating:   h.avg_rating ?? null,
    ratingCount: h.rating_count ?? 0,
  };
}

// ── Bookings ────────────────────────────────────────────────────────────────

export async function fetchBookings(filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.houseHelpId) params.set("house_help_id", filters.houseHelpId);
  if (filters.residentId)  params.set("resident_id",   filters.residentId);
  if (filters.status)      params.set("status",         filters.status);
  const q = params.toString() ? `?${params}` : "";
  const rows = await apiClient.get(`/workforce/house-help/bookings${q}`, options);
  return (rows ?? []).map(toUiBooking);
}

export async function createBooking(data, options = {}) {
  const dto = {
    house_help_id: data.houseHelpId,
    resident_id:   data.residentId,
    date:          data.date,
    start_time:    data.startTime,
    end_time:      data.endTime,
    notes:         data.notes ?? "",
  };
  const created = await apiClient.post("/workforce/house-help/bookings", dto, options);
  return toUiBooking(created);
}

export async function updateBookingStatus(bookingId, status, options = {}) {
  const updated = await apiClient.put(
    `/workforce/house-help/bookings/${bookingId}/status`,
    { status },
    options,
  );
  return toUiBooking(updated);
}

function toUiBooking(b) {
  return {
    id:          b.id,
    houseHelpId: b.house_help_id,
    residentId:  b.resident_id,
    date:        b.date,
    startTime:   b.start_time,
    endTime:     b.end_time,
    status:      b.status,
    notes:       b.notes ?? "",
    createdAt:   b.created_at ?? null,
  };
}

// ── Attendance ──────────────────────────────────────────────────────────────

export async function fetchHouseHelpAttendance(filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.houseHelpId) params.set("house_help_id", filters.houseHelpId);
  if (filters.dateFrom)    params.set("date_from",     filters.dateFrom);
  if (filters.dateTo)      params.set("date_to",       filters.dateTo);
  const q = params.toString() ? `?${params}` : "";
  const rows = await apiClient.get(`/workforce/house-help/attendance${q}`, options);
  return (rows ?? []).map(toUiAttendance);
}

function toUiAttendance(a) {
  return {
    id:          a.id,
    houseHelpId: a.house_help_id,
    bookingId:   a.booking_id ?? null,
    date:        a.date,
    status:      a.status,
    notes:       a.notes ?? "",
  };
}

// ── Ratings ─────────────────────────────────────────────────────────────────

export async function fetchRatings(houseHelpId, options = {}) {
  const rows = await apiClient.get(`/workforce/house-help/${houseHelpId}/ratings`, options);
  return (rows ?? []).map((r) => ({
    id:          r.id,
    houseHelpId: r.house_help_id,
    bookingId:   r.booking_id,
    rating:      r.rating,
    comment:     r.comment ?? "",
    createdAt:   r.created_at ?? null,
  }));
}

export async function submitRating(data, options = {}) {
  return apiClient.post("/workforce/house-help/ratings", {
    house_help_id: data.houseHelpId,
    booking_id:    data.bookingId,
    rating:        data.rating,
    comment:       data.comment ?? "",
  }, options);
}

// ── Service Providers ────────────────────────────────────────────────────────

export async function fetchProviders(filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.trade) params.set("trade", filters.trade);
  const q = params.toString() ? `?${params}` : "";
  const rows = await apiClient.get(`/workforce/providers${q}`, options);
  return (rows ?? []).map((p) => ({
    id:          p.id,
    name:        p.name,
    trade:       p.trade,
    phone:       p.phone ?? "",
    active:      p.active ?? true,
    avgRating:   p.avg_rating ?? null,
  }));
}

// ── Provider Jobs ────────────────────────────────────────────────────────────

export async function fetchProviderJobs(filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.status)    params.set("status",      filters.status);
  if (filters.providerId) params.set("provider_id", filters.providerId);
  const q = params.toString() ? `?${params}` : "";
  const rows = await apiClient.get(`/workforce/provider-jobs${q}`, options);
  return (rows ?? []).map(toUiJob);
}

export async function createProviderJob(data, options = {}) {
  const dto = {
    provider_id:  data.providerId ?? null,
    trade:        data.trade,
    title:        data.title,
    description:  data.description ?? "",
    requested_by: data.requestedBy ?? null,
    scheduled_at: data.scheduledAt ?? null,
  };
  const created = await apiClient.post("/workforce/provider-jobs", dto, options);
  return toUiJob(created);
}

export async function updateJobStatus(jobId, status, options = {}) {
  const updated = await apiClient.put(
    `/workforce/provider-jobs/${jobId}/status`,
    { status },
    options,
  );
  return toUiJob(updated);
}

function toUiJob(j) {
  return {
    id:          j.id,
    providerId:  j.provider_id ?? null,
    trade:       j.trade,
    title:       j.title,
    description: j.description ?? "",
    status:      j.status,
    requestedBy: j.requested_by ?? null,
    scheduledAt: j.scheduled_at ?? null,
    createdAt:   j.created_at ?? null,
  };
}

