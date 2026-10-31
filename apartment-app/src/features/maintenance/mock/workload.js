import {
  workOrders,
  STAFF,
  WO_STATUS,
  isOverdue,
} from "./workOrders";

// The "workload" view aggregates the existing work-order board by assignee. A
// staff member's workload is simply the orders currently on their plate:
//   - active    = assigned or in progress (still needs doing)
//   - completed = finished
//   - overdue   = active *and* past its due date (a subset of active)
// Everything here is derived from the singleton `workOrders` array, so the
// dashboard stays in sync with the board within a session.

// Active = anything assigned to a person that isn't done yet.
export const ACTIVE_STATUSES = [WO_STATUS.ASSIGNED, WO_STATUS.IN_PROGRESS];

const isActive = (wo) => ACTIVE_STATUSES.includes(wo.status);

// Per-staff workload row. One entry per member of STAFF (including anyone with
// zero tasks, so the roster reads completely). `now` is injectable to keep the
// overdue rule testable.
export const getStaffWorkload = (now = new Date()) => {
  return STAFF.map((s) => {
    const orders = workOrders.filter((w) => w.assignee === s.id);
    const active = orders.filter(isActive);
    const completed = orders.filter((w) => w.status === WO_STATUS.COMPLETED);
    const overdue = active.filter((w) => isOverdue(w, now));
    const total = active.length + completed.length;
    return {
      staffId: s.id,
      name: s.name,
      trade: s.trade,
      active: active.length,
      completed: completed.length,
      overdue: overdue.length,
      total,
      // Share of a staff member's tasks that are done - used for the % label.
      completionRate: total ? Math.round((completed.length / total) * 100) : 0,
      orders,
    };
  });
};

// Society-wide totals for the stat tiles at the top of the dashboard.
export const getWorkloadSummary = (now = new Date()) => {
  const rows = getStaffWorkload(now);
  const active = rows.reduce((sum, r) => sum + r.active, 0);
  const completed = rows.reduce((sum, r) => sum + r.completed, 0);
  const overdue = rows.reduce((sum, r) => sum + r.overdue, 0);
  const withActive = rows.filter((r) => r.active > 0).length;
  return {
    staffCount: rows.length,
    active,
    completed,
    overdue,
    withActive,
    // How evenly work is spread - the busiest active count, so a Manager can
    // spot one person carrying too much.
    busiest: rows.reduce((m, r) => Math.max(m, r.active), 0),
  };
};

// The distinct trades present, for the filter dropdown.
export const WORKLOAD_TRADES = [...new Set(STAFF.map((s) => s.trade))].sort();

// Sort options exposed by the dashboard. Each returns a comparator over the
// workload rows produced by getStaffWorkload.
export const WORKLOAD_SORTS = {
  active: { label: "Active tasks (high → low)", cmp: (a, b) => b.active - a.active || a.name.localeCompare(b.name) },
  total: { label: "Total tasks (high → low)", cmp: (a, b) => b.total - a.total || a.name.localeCompare(b.name) },
  completed: { label: "Completed (high → low)", cmp: (a, b) => b.completed - a.completed || a.name.localeCompare(b.name) },
  overdue: { label: "Overdue (high → low)", cmp: (a, b) => b.overdue - a.overdue || a.name.localeCompare(b.name) },
  name: { label: "Name (A → Z)", cmp: (a, b) => a.name.localeCompare(b.name) },
};

