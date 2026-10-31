/**
 * facilityService.js - INT-32: Integrate Facility Booking
 *
 * Talks to:
 *   GET  /facilities                         - list facilities
 *   GET  /facilities/{id}                    - get one facility
 *   GET  /facilities/{id}/availability       - slot grid for a date
 *   POST /facilities/{id}/bookings           - create a booking
 *   GET  /facilities/{id}/bookings           - list bookings for a facility
 *   POST /facilities/bookings/{id}/cancel    - cancel a booking
 *
 * The backend books fixed hourly bands (e.g. "06:00 - 07:00"), not an
 * open/close time range with a slot duration - see backend/app/schemas/
 * facility.py's TIME_SLOTS. Response/request field names below match that
 * schema exactly (facility_id/booking_id/booking_date/slot), not the id/
 * date/time/endTime shape this file used to assume.
 */

import apiClient from "./apiClient";

export async function fetchFacilities(options = {}) {
  const rows = await apiClient.get("/facilities?status=active", options);
  return (rows ?? []).map(toUiFacility);
}

export async function fetchFacility(facilityId, options = {}) {
  const f = await apiClient.get(`/facilities/${facilityId}`, options);
  return toUiFacility(f);
}

/**
 * Fetch the slot availability grid for a facility on a given date.
 * Returns { date, capacity, slots: [{ time, state, booked, spotsRemaining }] }
 */
export async function fetchAvailability(facilityId, date, options = {}) {
  const data = await apiClient.get(
    `/facilities/${facilityId}/availability?date=${date}`,
    options,
  );
  return {
    date:     data.booking_date,
    capacity: data.capacity,
    slots: (data.slots ?? []).map((s) => ({
      time:           s.slot,
      state:          s.state,
      booked:         s.booked,
      spotsRemaining: s.spots_remaining,
    })),
  };
}

/**
 * POST /facilities/{id}/bookings
 */
export async function createFacilityBooking(facilityId, data, options = {}) {
  const dto = {
    resident_id:  data.residentId,
    booking_date: data.date,
    slot:         data.time,
  };
  const created = await apiClient.post(`/facilities/${facilityId}/bookings`, dto, options);
  return toUiBooking(created);
}

/**
 * GET /facilities/{id}/bookings - all bookings for a facility
 */
export async function fetchFacilityBookings(facilityId, filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.date)       params.set("date",        filters.date);
  if (filters.residentId) params.set("resident_id", filters.residentId);
  if (filters.status)     params.set("status",      filters.status);
  const q = params.toString() ? `?${params}` : "";
  const rows = await apiClient.get(`/facilities/${facilityId}/bookings${q}`, options);
  return (rows ?? []).map(toUiBooking);
}

/**
 * POST /facilities/bookings/{id}/cancel
 */
export async function cancelFacilityBooking(bookingId, options = {}) {
  const updated = await apiClient.post(
    `/facilities/bookings/${bookingId}/cancel`,
    {},
    options,
  );
  return toUiBooking(updated);
}

function toUiFacility(f) {
  return {
    id:          f.facility_id,
    name:        f.name,
    description: f.description ?? "",
    location:    f.location ?? "",
    capacity:    f.capacity ?? 1,
    status:      f.status ?? "active",
  };
}

function toUiBooking(b) {
  return {
    id:         b.booking_id,
    facilityId: b.facility_id,
    residentId: b.resident_id ?? null,
    date:       b.booking_date,
    time:       b.slot,
    status:     b.status,
    createdAt:  b.created_at ?? null,
  };
}
