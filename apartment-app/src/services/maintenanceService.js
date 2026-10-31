/**
 * maintenanceService.js - INT-15, INT-17, INT-24
 *
 * Covers three backend modules that all live under /maintenance and /staff:
 *   INT-15 Staff Workload   → GET /staff/workload
 *   INT-17 Schedule         → GET/POST /maintenance/schedule
 *   INT-24 Work Orders      → GET/POST /maintenance/work-orders + mutations
 */

import apiClient from "./apiClient";

// ── INT-15: Staff workload ──────────────────────────────────────────────────
/**
 * GET /staff/workload
 * Returns [{staff_id, name, trade, assigned, completed, total}, ...]
 * Maps to the shape WorkloadDashboardPage expects.
 */
export async function fetchWorkload(options = {}) {
  const rows = await apiClient.get("/staff/workload", options);
  return (rows ?? []).map((r) => ({
    staffId:        r.staff_id,
    name:           r.name,
    trade:          r.trade ?? "-",
    active:         r.assigned ?? 0,   // API calls these "assigned" (open)
    completed:      r.completed ?? 0,
    overdue:        0,                  // BE-15 doesn't track overdue; keep 0
    total:          (r.assigned ?? 0) + (r.completed ?? 0),
    completionRate:
      r.assigned + r.completed > 0
        ? Math.round((r.completed / (r.assigned + r.completed)) * 100)
        : 0,
  }));
}

// ── INT-17: Maintenance Schedule ────────────────────────────────────────────
/**
 * GET /maintenance/schedule
 */
export async function fetchSchedules(options = {}) {
  const rows = await apiClient.get("/maintenance/schedule", options);
  return (rows ?? []).map(toUiSchedule);
}

/**
 * POST /maintenance/schedule
 */
export async function createSchedule(data, options = {}) {
  const dto = {
    title:      data.title,
    date:       data.date,
    time:       data.time,
    facilities: data.facilities ?? [],
    priority:   data.priority ?? "medium",
    assignee:   data.assignee ?? null,
    notes:      data.notes ?? "",
  };
  const created = await apiClient.post("/maintenance/schedule", dto, options);
  return toUiSchedule(created);
}

function toUiSchedule(s) {
  return {
    id:         s.id,
    title:      s.title,
    date:       s.date,
    time:       s.time,
    facilities: s.facilities ?? [],
    priority:   s.priority ?? "medium",
    assignee:   s.assignee ?? null,
    notes:      s.notes ?? "",
    createdAt:  s.created_at ?? null,
  };
}

// ── INT-24: Work Orders ─────────────────────────────────────────────────────
/**
 * GET /maintenance/work-orders/stats
 */
export async function fetchWorkOrderStats(options = {}) {
  const s = await apiClient.get("/maintenance/work-orders/stats", options);
  return {
    total:     s.total     ?? 0,
    open:      s.open      ?? 0,
    overdue:   s.overdue   ?? 0,
    completed: s.completed ?? 0,
  };
}

/**
 * GET /maintenance/work-orders
 */
export async function fetchWorkOrders(filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.status)     params.set("status",      filters.status);
  if (filters.type)       params.set("type",         filters.type);
  if (filters.priority)   params.set("priority",     filters.priority);
  if (filters.assignedTo) params.set("assigned_to",  filters.assignedTo);
  const query = params.toString() ? `?${params}` : "";
  const rows = await apiClient.get(`/maintenance/work-orders${query}`, options);
  return (rows ?? []).map(toUiWorkOrder);
}

/**
 * POST /maintenance/work-orders
 */
export async function createWorkOrder(data, options = {}) {
  const dto = {
    title:       data.title,
    type:        data.type,
    priority:    data.priority,
    asset_id:    data.assetId ?? null,
    due_date:    data.dueDate ?? null,
    description: data.description ?? "",
    assigned_to: data.assignee ?? null,
  };
  const created = await apiClient.post("/maintenance/work-orders", dto, options);
  return toUiWorkOrder(created);
}

/**
 * PUT /maintenance/work-orders/{id}/assign
 */
export async function assignWorkOrder(workOrderId, staffId, options = {}) {
  const updated = await apiClient.put(
    `/maintenance/work-orders/${workOrderId}/assign`,
    { staff_id: staffId },
    options,
  );
  return toUiWorkOrder(updated);
}

/**
 * PUT /maintenance/work-orders/{id}/status
 */
export async function updateWorkOrderStatus(workOrderId, status, outcome, options = {}) {
  const updated = await apiClient.put(
    `/maintenance/work-orders/${workOrderId}/status`,
    { status, outcome: outcome ?? null },
    options,
  );
  return toUiWorkOrder(updated);
}

function toUiWorkOrder(w) {
  return {
    id:          w.id,
    title:       w.title,
    type:        w.type,
    priority:    w.priority,
    status:      w.status,
    assetId:     w.asset_id ?? null,
    assignee:    w.assigned_to ?? null,
    dueDate:     w.due_date ?? null,
    description: w.description ?? "",
    outcome:     w.outcome ?? null,
    createdAt:   w.created_at ?? null,
    updatedAt:   w.updated_at ?? null,
  };
}

