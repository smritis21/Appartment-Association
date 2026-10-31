/**
 * staffShiftService.js - INT-35: Integrate Attendance and Shifts
 *
 * Talks to:
 *   POST /staff/shifts          - allocate a shift
 *   GET  /staff/shifts          - list shifts (filter by staff/date)
 *   POST /staff/attendance      - record daily attendance
 *   GET  /staff/attendance      - list attendance records
 */

import apiClient from "./apiClient";

// ── Shifts ──────────────────────────────────────────────────────────────────

export async function fetchShifts(filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.staffId)   params.set("staff_id",   filters.staffId);
  if (filters.shiftDate) params.set("shift_date", filters.shiftDate);
  if (filters.skip)      params.set("skip",        String(filters.skip));
  if (filters.limit)     params.set("limit",       String(filters.limit ?? 200));
  const q = params.toString() ? `?${params}` : "";
  const rows = await apiClient.get(`/staff/shifts${q}`, options);
  return (rows ?? []).map(toUiShift);
}

/**
 * Allocate a shift to a staff member.
 * @param {{ staffId, date, startTime, endTime, shiftType }} data
 */
export async function allocateShift(data, options = {}) {
  const dto = {
    staff_id:   data.staffId,
    date:       data.date,
    start_time: data.startTime,
    end_time:   data.endTime,
    shift_type: data.shiftType ?? "morning",
  };
  const created = await apiClient.post("/staff/shifts", dto, options);
  return toUiShift(created);
}

function toUiShift(s) {
  return {
    id:        s.id,
    staffId:   s.staff_id,
    date:      s.date,
    startTime: s.start_time,
    endTime:   s.end_time,
    shiftType: s.shift_type ?? null,
    createdAt: s.created_at ?? null,
  };
}

// ── Attendance ──────────────────────────────────────────────────────────────

export async function fetchAttendance(filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.staffId)  params.set("staff_id",  filters.staffId);
  if (filters.status)   params.set("status",    filters.status);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo)   params.set("date_to",   filters.dateTo);
  if (filters.limit)    params.set("limit",     String(filters.limit ?? 200));
  const q = params.toString() ? `?${params}` : "";
  const rows = await apiClient.get(`/staff/attendance${q}`, options);
  return (rows ?? []).map(toUiAttendance);
}

/**
 * Record attendance for one staff member on one day.
 * @param {{ staffId, date, status, shiftId?, notes? }} data
 */
export async function markAttendance(data, options = {}) {
  const dto = {
    staff_id: data.staffId,
    date:     data.date,
    status:   data.status,           // present / absent / half_day / on_leave
    shift_id: data.shiftId ?? null,
    notes:    data.notes ?? "",
  };
  const created = await apiClient.post("/staff/attendance", dto, options);
  return toUiAttendance(created);
}

function toUiAttendance(a) {
  return {
    id:      a.id,
    staffId: a.staff_id,
    shiftId: a.shift_id ?? null,
    date:    a.date,
    status:  a.status,
    notes:   a.notes ?? "",
  };
}

