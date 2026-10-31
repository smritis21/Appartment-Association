/**
 * complaintReportService.js - BE-14.
 *
 * Talks to GET /complaints/reports and translates the response into the
 * camelCase shape ComplaintReportsPage already uses for its local stats.
 *
 * This is intentionally separate from complaintService.js (which owns
 * BE-07 stats) so each file stays focused on one backend ticket.
 *
 * Endpoint used:
 *   GET /complaints/reports   - filtered, paginated complaint report
 *
 * Also exports getReportResolutionDays(), which derives the average turnaround
 * from the report's own items so the screen shows a real resolution figure for
 * the selected date range (INT-14) instead of a placeholder.
 */

import apiClient from "./apiClient";

// ── Shape translator ──────────────────────────────────────────────────────────

/** Backend ComplaintReportItem -> UI shape */
function toUiItem(dto) {
  return {
    id:           dto.complaint_id,
    category:     dto.category,
    description:  dto.description,
    location:     dto.location     ?? null,
    raisedBy:     dto.raised_by    ?? null,
    status:       dto.status,
    assignedTo:   dto.assigned_to  ?? null,
    assignedName: dto.assigned_name ?? null,
    assignedAt:   dto.assigned_at  ?? null,
    createdAt:    dto.created_at,
    updatedAt:    dto.updated_at,
  };
}

/** Backend ComplaintReportResponse -> UI shape */
export function toUiReport(dto) {
  return {
    total:       dto.total,
    page:        dto.page,
    pageSize:    dto.page_size,
    pages:       dto.pages,
    items:       (dto.items ?? []).map(toUiItem),
    byStatus: {
      submitted:  dto.by_status?.submitted   ?? 0,
      assigned:   dto.by_status?.assigned    ?? 0,
      inProgress: dto.by_status?.in_progress ?? 0,
      resolved:   dto.by_status?.resolved    ?? 0,
      closed:     dto.by_status?.closed      ?? 0,
    },
    byCategory:  (dto.by_category ?? []).map((c) => ({
      category: c.category,
      value:    c.count,
    })),
    generatedAt: dto.generated_at,
  };
}

// ── API call ──────────────────────────────────────────────────────────────────

/**
 * Fetch a filtered complaint report.
 *
 * @param {{
 *   status?: string,
 *   category?: string,
 *   assignedTo?: string,
 *   raisedBy?: string,
 *   dateFrom?: string,   // YYYY-MM-DD
 *   dateTo?: string,     // YYYY-MM-DD
 *   page?: number,
 *   pageSize?: number,
 * }} filters
 */
export async function fetchComplaintReport(filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.status)     params.set("status",      filters.status);
  if (filters.category)   params.set("category",    filters.category);
  if (filters.assignedTo) params.set("assigned_to", filters.assignedTo);
  if (filters.raisedBy)   params.set("raised_by",   filters.raisedBy);
  if (filters.dateFrom)   params.set("date_from",   filters.dateFrom);
  if (filters.dateTo)     params.set("date_to",     filters.dateTo);
  if (filters.page)       params.set("page",        filters.page);
  if (filters.pageSize)   params.set("page_size",   filters.pageSize);

  const data = await apiClient.get(`/complaints/reports?${params}`, options);
  return toUiReport(data);
}


/**
 * INT-14 - average days from a complaint being raised to being resolved,
 * computed over the report's own items for the selected date range.
 *
 * The report carries each complaint's createdAt and updatedAt; for a resolved
 * or closed complaint the last update *is* the resolution, so updatedAt minus
 * createdAt is its turnaround. Complaints still open are not counted, and a
 * negative span (clock skew) is treated as zero. Returns 0 when the range holds
 * nothing resolved yet, so the caller can render "0.0 days" rather than NaN.
 */
export function getReportResolutionDays(items) {
  const done = (items ?? []).filter((c) =>
    ["resolved", "closed"].includes(c.status)
  );
  if (done.length === 0) return 0;
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const totalDays = done.reduce((sum, c) => {
    const created  = new Date(c.createdAt);
    const resolved = new Date(c.updatedAt ?? c.createdAt);
    const days = (resolved - created) / MS_PER_DAY;
    return sum + (days > 0 ? days : 0);
  }, 0);
  return totalDays / done.length;
}
