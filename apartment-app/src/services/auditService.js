/**
 * auditService.js - BE-39.
 *
 * Talks to the Audit Log API (admin-only).
 *
 * The backend AuditLogOut is much leaner than mock/auditLogs.js: it has no
 * severity, status, IP/device/browser, or resolved actor/resident name -
 * entries are only ever written for actions that already succeeded, so
 * `status` is always mapped to "Success" and `severity` to "Info" (there's
 * no failure/severity signal to derive them from). actor_id is shown as-is
 * since the log doesn't capture a human-readable name for who performed it.
 *
 * Endpoints used:
 *   GET /audit - filterable, paginated (admin-only)
 */

import apiClient from "./apiClient";
import { AUDIT_STATUS, AUDIT_SEVERITY } from "../features/audit/mock/auditLogs";

// Matches the module values actually passed to audit_service.log_action()
// across the backend (see app/services/*.py) - not every module writes
// audit entries yet (e.g. residents, billing, payments, visitors don't).
const MODULE_LABELS = {
  auth: "Authentication",
  onboarding: "Onboarding",
  communication: "Communication",
  community: "Community",
  events: "Events",
  facilities: "Facilities",
  maintenance: "Maintenance",
  marketplace: "Marketplace",
  temple: "Temple",
  billing: "Billing",
  payments: "Payments",
};

/** Backend AuditLogOut -> the shape AuditLogTable/AuditActivityCard/AuditTimeline expect. */
export function toUiLog(dto) {
  return {
    id: dto.log_id,
    timestamp: dto.timestamp,
    module: MODULE_LABELS[dto.module] ?? dto.module,
    category: MODULE_LABELS[dto.module] ?? dto.module,
    action: dto.action,
    performedBy: dto.actor_id ?? "System",
    performedRole: dto.actor_role ?? "-",
    residentId: dto.target_type === "resident" ? dto.target_id : null,
    residentName: null,
    wing: null,
    flat: null,
    status: AUDIT_STATUS.SUCCESS,
    ipAddress: "-",
    device: "-",
    browser: "-",
    description: dto.description ?? "",
    severity: AUDIT_SEVERITY.INFO,
  };
}

export async function fetchAuditLogs(filters = {}, options = {}) {
  const params = new URLSearchParams();
  if (filters.module) params.set("module", filters.module);
  if (filters.action) params.set("action", filters.action);
  if (filters.actorId) params.set("actor_id", filters.actorId);
  if (filters.targetId) params.set("target_id", filters.targetId);
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  params.set("page", filters.page ?? 1);
  params.set("page_size", filters.pageSize ?? 100);
  const data = await apiClient.get(`/audit?${params}`, options);
  return {
    items: (data.items ?? []).map(toUiLog),
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
    pages: data.pages,
  };
}

