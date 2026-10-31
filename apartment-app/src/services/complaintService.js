/**
 * complaintService.js - FE-07 / BE-07.
 *
 * Talks to the Complaint Statistics API and translates the backend's
 * snake_case contract into the camelCase shape the dashboard components use.
 *
 * Endpoints used:
 *   GET  /complaints/stats?months=N   - dashboard counts, category split, trend
 *   POST /complaints                  - raise a complaint (INT-01)
 *   GET  /complaints/{id}/status       - current stage and its timestamp (INT-02)
 *   GET  /residents/{id}/complaints    - a resident's complaints, with progress logs
 *   PUT  /complaints/{id}/assign       - allocate a complaint to staff (INT-06)
 *   GET  /staff/workload               - the assignable staff list (INT-06)
 *   GET  /complaints/categories        - the categories the selector offers (INT-13)
 *   PUT  /complaints/{id}/progress     - record a staff progress update (INT-16)
 *
 * Also exports buildStatsFromComplaints(), which computes the exact same
 * shape from the in-memory complaint list. That is what the offline fallback
 * renders when the backend is unreachable, so the dashboard looks and behaves
 * identically either way - only the data source changes.
 */

import apiClient from "./apiClient";

/** Statuses the backend groups into each dashboard bucket. Kept in sync with
 *  complaint_service.PENDING_STATUSES / ONGOING_STATUSES / COMPLETED_STATUSES. */
const PENDING_STATUSES = ["submitted"];
const ONGOING_STATUSES = ["assigned", "in_progress"];
const COMPLETED_STATUSES = ["resolved", "closed"];

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Default trend window, mirroring the backend's DEFAULT_TREND_MONTHS. */
export const DEFAULT_TREND_MONTHS = 6;

/**
 * "lift_maintenance" -> "Lift Maintenance".
 * The backend stores categories as snake_case slugs; the UI has always shown
 * them title-cased. Values that are already title-cased (the mock data) pass
 * through unchanged, so this is safe to apply to both sources.
 */
export function toCategoryLabel(category) {
  if (!category) return "Uncategorised";
  return String(category)
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

/** Backend ComplaintStatsOut -> the shape the dashboard components expect. */
export function toUiStats(dto) {
  return {
    pending: dto.pending ?? 0,
    ongoing: dto.ongoing ?? 0,
    completed: dto.completed ?? 0,
    total: dto.total ?? 0,
    byStatus: {
      submitted: dto.by_status?.submitted ?? 0,
      assigned: dto.by_status?.assigned ?? 0,
      inProgress: dto.by_status?.in_progress ?? 0,
      resolved: dto.by_status?.resolved ?? 0,
      closed: dto.by_status?.closed ?? 0,
    },
    byCategory: (dto.by_category ?? []).map((row) => ({
      category: row.category,
      label: toCategoryLabel(row.category),
      value: row.count,
    })),
    trend: (dto.trend ?? []).map((point) => ({
      period: point.period,
      // SimpleBarChart uses `label` for the axis, so a short label keeps the
      // axis readable; the full "Jul 2026" stays available for tooltips.
      label: point.label.split(" ")[0],
      fullLabel: point.label,
      value: point.raised,          // the bar chart plots complaints raised
      raised: point.raised,
      resolved: point.resolved,
    })),
    trendMonths: dto.trend_months ?? DEFAULT_TREND_MONTHS,
    generatedAt: dto.generated_at ?? null,
  };
}

/**
 * Fetch dashboard statistics.
 *
 * @param {number} [months] size of the trend window (1–24)
 * @returns stats in UI shape
 *
 * Throws NetworkError when the backend is unreachable - callers decide
 * whether to fall back to locally computed stats.
 */
export async function fetchComplaintStats(months = DEFAULT_TREND_MONTHS, options = {}) {
  const data = await apiClient.get(
    `/complaints/stats?months=${encodeURIComponent(months)}`,
    options
  );
  return toUiStats(data);
}

// ── Offline fallback ─────────────────────────────────────────────────────────

/** The (year, month) pairs for the last `months` months, oldest first. */
function monthWindow(months) {
  const now = new Date();
  const window = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    window.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return window;
}

function periodKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Earliest timeline entry that moved a complaint into resolved/closed -
 * the same rule the backend applies to its audit trail. Falls back to the
 * complaint's creation date when there is no such entry.
 */
function resolutionDate(complaint) {
  const entry = (complaint.timeline ?? []).find((t) =>
    COMPLETED_STATUSES.includes(t.status)
  );
  return new Date(entry?.at ?? complaint.createdAt);
}

/**
 * Compute the same stats payload the API returns, from an in-memory complaint
 * list. Used when the backend is unreachable so the dashboard still renders.
 */
export function buildStatsFromComplaints(complaints, months = DEFAULT_TREND_MONTHS) {
  const list = complaints ?? [];
  const countWhere = (statuses) =>
    list.filter((c) => statuses.includes(c.status)).length;

  const categoryTotals = new Map();
  for (const c of list) {
    categoryTotals.set(c.category, (categoryTotals.get(c.category) ?? 0) + 1);
  }
  const byCategory = [...categoryTotals.entries()]
    .map(([category, value]) => ({ category, label: toCategoryLabel(category), value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const raised = new Map();
  const resolved = new Map();
  for (const c of list) {
    const created = new Date(c.createdAt);
    raised.set(periodKey(created), (raised.get(periodKey(created)) ?? 0) + 1);
    if (COMPLETED_STATUSES.includes(c.status)) {
      const done = resolutionDate(c);
      resolved.set(periodKey(done), (resolved.get(periodKey(done)) ?? 0) + 1);
    }
  }

  const trend = monthWindow(months).map(({ year, month }) => {
    const period = `${year}-${String(month + 1).padStart(2, "0")}`;
    const raisedCount = raised.get(period) ?? 0;
    return {
      period,
      label: MONTH_LABELS[month],
      fullLabel: `${MONTH_LABELS[month]} ${year}`,
      value: raisedCount,
      raised: raisedCount,
      resolved: resolved.get(period) ?? 0,
    };
  });

  return {
    pending: countWhere(PENDING_STATUSES),
    ongoing: countWhere(ONGOING_STATUSES),
    completed: countWhere(COMPLETED_STATUSES),
    total: list.length,
    byStatus: {
      submitted: countWhere(["submitted"]),
      assigned: countWhere(["assigned"]),
      inProgress: countWhere(["in_progress"]),
      resolved: countWhere(["resolved"]),
      closed: countWhere(["closed"]),
    },
    byCategory,
    trend,
    trendMonths: months,
    generatedAt: new Date().toISOString(),
  };
}


/**
 * INT-01 - raise a complaint.
 *
 * The API answers with the stored record, whose `complaint_id` is the real
 * reference the resident is shown. The category values the form offers are
 * the ones the API accepts, so they travel across unchanged.
 *
 * `raised_by` is the resident record, not the login. Accounts with no resident
 * link (staff) simply raise an unattributed complaint rather than failing.
 */
export async function createComplaint({ category, description, location, imageReference, residentId }) {
  const created = await apiClient.post("/complaints", {
    category,
    description: description?.trim(),
    location: location?.trim(),
    ...(imageReference ? { image_reference: imageReference } : {}),
    ...(residentId ? { raised_by: residentId } : {}),
  });
  return {
    id: created.complaint_id,
    // What the resident is shown and quotes back ("CMP-2026-0001"); the id
    // above stays the key used when tracking the complaint through the API.
    reference: created.reference || created.complaint_id,
    category: created.category,
    description: created.description,
    location: created.location,
    status: created.status,
    createdAt: created.created_at,
  };
}


/**
 * The complaint's history, oldest first.
 *
 * The API logs status *changes*, so raising the complaint leaves no row and
 * the first stage would read as still pending. The submission is added back
 * from `created_at`, which is when it actually happened.
 */
function buildTimeline(dto) {
  const logs = (dto.progress_logs ?? []).map((log) => ({
    status: log.status,
    at: log.updated_at,
    by: log.employee?.name || "Association",
    notes: log.notes || `Status changed to ${log.status}.`,
  }));

  const hasSubmitted = logs.some((entry) => entry.status === "submitted");
  if (!hasSubmitted && dto.created_at) {
    logs.unshift({
      status: "submitted",
      at: dto.created_at,
      by: "You",
      notes: "Complaint submitted",
    });
  }
  return logs.sort((a, b) => new Date(a.at) - new Date(b.at));
}

/** Backend ComplaintOut -> the shape the tracking and history screens render. */
export function toUiComplaint(dto) {
  return {
    id: dto.complaint_id,
    reference: dto.reference || dto.complaint_id,
    category: dto.category,
    description: dto.description,
    location: dto.location,
    status: dto.status,
    assignedTo: dto.assigned_to ?? null,
    assignedStaffName: dto.assigned_staff?.name ?? null,
    residentName: dto.raised_by ? "You" : "Resident",
    flat: dto.location ?? "-",
    image: dto.image_reference ?? null,
    createdAt: dto.created_at,
    feedback: dto.feedback ?? null,
    // The progress log is the real history of the complaint, so the activity
    // list and the stepper both read from it rather than from a timeline the
    // client assembled.
    timeline: buildTimeline(dto),
  };
}

/**
 * INT-02 - one complaint, with its stages and timestamps.
 *
 * There is no single-complaint endpoint: the API exposes a resident's list
 * (BE-10) and the current stage on its own (BE-02). The list carries the
 * detail and the progress log, and the status call is what confirms the stage
 * is current, so the two are combined here.
 */
export async function fetchComplaint(complaintId, residentId) {
  const [rows, stage] = await Promise.all([
    residentId ? apiClient.get(`/residents/${residentId}/complaints`) : Promise.resolve([]),
    apiClient.get(`/complaints/${complaintId}/status`),
  ]);

  const match = (rows ?? []).find((c) => c.complaint_id === complaintId);
  if (!match) {
    // The resident's list did not include it - fall back to what the status
    // endpoint knows so the screen can still show the stage.
    return {
      id: stage.complaint_id,
      reference: stage.complaint_id,
      status: stage.status,
      createdAt: stage.timestamp,
      timeline: [],
    };
  }

  const complaint = toUiComplaint(match);
  // The status endpoint is the authority on the current stage.
  return { ...complaint, status: stage.status, statusChangedAt: stage.timestamp };
}


/**
 * INT-10 - a resident's complaints, newest first.
 *
 * Resolved and closed complaints stay in the list; history is the record of
 * everything raised, not just what is still open.
 */
export async function fetchResidentComplaints(residentId) {
  if (!residentId) return [];
  const rows = await apiClient.get(`/residents/${residentId}/complaints`);
  return (rows ?? [])
    .map(toUiComplaint)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}


// ── INT-06 - live complaint assignment ────────────────────────────────────────

/**
 * The staff members a complaint can be assigned to.
 *
 * There is no "list all staff" endpoint, but GET /staff/workload (BE-15) returns
 * every staff member - including those with no assignments yet - with the id,
 * name and role the assignment dropdown needs. The workload counts ride along;
 * the dropdown ignores them.
 */
export async function fetchAssignableStaff(options = {}) {
  const rows = await apiClient.get("/staff/workload", options);
  return (rows ?? []).map((s) => ({
    id: s.staff_id,
    name: s.name,
    role: s.role,
  }));
}

/**
 * Assign (or reassign) a complaint to a staff member.
 *
 * Calls the live PUT /complaints/{id}/assign, which persists assigned_to and a
 * server-side assigned_at, and - the first time - moves a submitted complaint
 * to "assigned". The response is the stored ComplaintOut, so the caller can
 * re-display the persisted staff name and timestamp rather than guessing them
 * locally. `assignedBy` is recorded on the audit log (EN-06).
 *
 * A backend error (404 unknown complaint/staff, 400 inactive staff) surfaces as
 * an ApiError with the server's message; a NetworkError means the API was
 * unreachable and the caller can fall back to a local assignment.
 */
export async function assignComplaint(complaintId, staffId, assignedBy) {
  const dto = await apiClient.put(`/complaints/${complaintId}/assign`, {
    staff_id: staffId,
    ...(assignedBy ? { assigned_by: assignedBy } : {}),
  });
  return {
    id: dto.complaint_id,
    status: dto.status,
    assignedTo: dto.assigned_to ?? null,
    assignedStaffName: dto.assigned_staff?.name ?? null,
    assignedAt: dto.assigned_at ?? null,
  };
}


// ── INT-13 - live complaint categories ────────────────────────────────────────

/**
 * INT-13 - the categories a resident may choose from.
 *
 * BE-13 owns the canonical category list at GET /complaints/categories, and it
 * is the same set submission is validated against. Reading it here, rather than
 * hard-coding the values on the client, is what guarantees the category the
 * resident selects is one the API will accept and store - the selector and the
 * validator cannot drift apart, so the stored complaint always carries a valid
 * category.
 *
 * The response is `{ categories: [...], count }`; the screen only needs the
 * ordered names. A NetworkError propagates so the caller can fall back to the
 * bundled list and keep the form usable while the backend is unreachable.
 */
export async function fetchComplaintCategories(options = {}) {
  const data = await apiClient.get("/complaints/categories", options);
  return data?.categories ?? [];
}


/**
 * INT-16 - record a progress update on a complaint.
 *
 * Calls the live PUT /complaints/{id}/progress, which moves the complaint to the
 * new status and appends an immutable audit-trail entry (BE-16) recording the
 * acting staff member and a server-side timestamp. The response is the stored
 * ComplaintOut, so the caller re-displays the persisted status and the progress
 * log rather than guessing them locally - and the same change is what the
 * resident's tracking screen then reads back (INT-02).
 *
 * `employeeId` is the staff member the update is attributed to (the complaint's
 * assignee). It must be a valid, active staff record.
 *
 * A backend error surfaces as an ApiError with the server's message (400 for an
 * illegal transition, 403 for an inactive staff member, 404 for an unknown
 * complaint or employee); a NetworkError means the API was unreachable and the
 * caller can fall back to a local update.
 */
export async function updateComplaintProgress(complaintId, { status, employeeId, notes }) {
  const dto = await apiClient.put(`/complaints/${complaintId}/progress`, {
    status,
    employee_id: employeeId,
    ...(notes && notes.trim() ? { notes: notes.trim() } : {}),
  });
  // toUiComplaint turns progress_logs into the timeline the activity feed and
  // stepper render, so the desk shows the entry the API just recorded.
  return toUiComplaint(dto);
}
