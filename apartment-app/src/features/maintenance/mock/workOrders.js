import { getAssetById } from "./assets";

// Reactive vs preventive: a reactive order is raised when something breaks; a
// preventive order is scheduled upkeep (often spawned from a recurring task).
export const WO_TYPE = {
  REACTIVE: "reactive",
  PREVENTIVE: "preventive",
};

export const WO_TYPE_META = {
  [WO_TYPE.REACTIVE]: { label: "Reactive", color: "error" },
  [WO_TYPE.PREVENTIVE]: { label: "Preventive", color: "info" },
};

// Lifecycle of a work order. The board renders one column per status and lets
// management advance an order along this flow.
export const WO_STATUS = {
  OPEN: "open",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
};

export const WO_STATUS_META = {
  [WO_STATUS.OPEN]: { label: "Open", color: "default" },
  [WO_STATUS.ASSIGNED]: { label: "Assigned", color: "info" },
  [WO_STATUS.IN_PROGRESS]: { label: "In Progress", color: "warning" },
  [WO_STATUS.COMPLETED]: { label: "Completed", color: "success" },
};

// Ordered lifecycle used to decide the "next" status when advancing an order.
export const WO_FLOW = [
  WO_STATUS.OPEN,
  WO_STATUS.ASSIGNED,
  WO_STATUS.IN_PROGRESS,
  WO_STATUS.COMPLETED,
];

export const PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

export const PRIORITY_META = {
  [PRIORITY.LOW]: { label: "Low", color: "default", rank: 0 },
  [PRIORITY.MEDIUM]: { label: "Medium", color: "info", rank: 1 },
  [PRIORITY.HIGH]: { label: "High", color: "warning", rank: 2 },
  [PRIORITY.CRITICAL]: { label: "Critical", color: "error", rank: 3 },
};

// Maintenance staff / vendors an order can be assigned to.
export const STAFF = [
  { id: "stf-ravi", name: "Ravi Kumar", trade: "Electrical" },
  { id: "stf-suresh", name: "Suresh Patel", trade: "Plumbing" },
  { id: "stf-otis", name: "OTIS Service (AMC)", trade: "Elevator" },
  { id: "stf-daikin", name: "Daikin Care (AMC)", trade: "HVAC" },
  { id: "stf-anil", name: "Anil Yadav", trade: "General" },
];

export const staffName = (id) => STAFF.find((s) => s.id === id)?.name ?? null;

// Society-wide work orders. Singleton array: the board and asset views both read
// from it, and mutations here are visible to every screen within a session.
export const workOrders = [
  {
    id: "WO-2026-031",
    title: "Elevator halting between floors",
    description: "Block B lift stops intermittently between the 3rd and 4th floor. Residents reported twice this week.",
    assetId: "AST-ELV-B",
    type: WO_TYPE.REACTIVE,
    priority: PRIORITY.CRITICAL,
    status: WO_STATUS.IN_PROGRESS,
    assignee: "stf-otis",
    createdAt: "2026-07-18T08:20:00.000Z",
    dueDate: "2026-07-21",
    completedAt: null,
    outcome: null,
  },
  {
    id: "WO-2026-032",
    title: "STP blower motor failure",
    description: "Sewage treatment plant blower tripped and won't restart. Plant is currently offline.",
    assetId: "AST-STP-1",
    type: WO_TYPE.REACTIVE,
    priority: PRIORITY.CRITICAL,
    status: WO_STATUS.ASSIGNED,
    assignee: "stf-anil",
    createdAt: "2026-07-19T06:10:00.000Z",
    dueDate: "2026-07-20",
    completedAt: null,
    outcome: null,
  },
  {
    id: "WO-2026-033",
    title: "Clubhouse AC not cooling",
    description: "First-floor clubhouse HVAC blowing warm air. Likely low refrigerant or clogged filter.",
    assetId: "AST-HVAC-CH",
    type: WO_TYPE.REACTIVE,
    priority: PRIORITY.HIGH,
    status: WO_STATUS.OPEN,
    assignee: null,
    createdAt: "2026-07-21T11:45:00.000Z",
    dueDate: "2026-07-24",
    completedAt: null,
    outcome: null,
  },
  {
    id: "WO-2026-034",
    title: "Corridor lights flickering - Block A 5th floor",
    description: "Two tube fittings flickering in the 5th-floor corridor. Replace drivers/LED panels.",
    assetId: "AST-LIGHT-CP",
    type: WO_TYPE.REACTIVE,
    priority: PRIORITY.LOW,
    status: WO_STATUS.OPEN,
    assignee: null,
    createdAt: "2026-07-20T15:30:00.000Z",
    dueDate: "2026-07-27",
    completedAt: null,
    outcome: null,
  },
  {
    id: "WO-2026-035",
    title: "Quarterly generator load test",
    description: "Scheduled load-bank test of the 250kVA DG set and battery health check.",
    assetId: "AST-GEN-1",
    type: WO_TYPE.PREVENTIVE,
    priority: PRIORITY.MEDIUM,
    status: WO_STATUS.ASSIGNED,
    assignee: "stf-ravi",
    createdAt: "2026-07-15T09:00:00.000Z",
    dueDate: "2026-07-30",
    completedAt: null,
    outcome: null,
  },
  {
    id: "WO-2026-028",
    title: "Overhead tank pump servicing",
    description: "Monthly greasing and impeller check of the overhead-tank pump.",
    assetId: "AST-PUMP-1",
    type: WO_TYPE.PREVENTIVE,
    priority: PRIORITY.MEDIUM,
    status: WO_STATUS.COMPLETED,
    assignee: "stf-suresh",
    createdAt: "2026-07-01T07:30:00.000Z",
    dueDate: "2026-07-05",
    completedAt: "2026-07-05T12:15:00.000Z",
    outcome: "Serviced. Replaced worn gasket; pump running within normal pressure.",
  },
  {
    id: "WO-2026-024",
    title: "Fire extinguisher refill & pressure check",
    description: "Half-yearly refill of all floor extinguishers and hydrant pressure verification.",
    assetId: "AST-FIRE-1",
    type: WO_TYPE.PREVENTIVE,
    priority: PRIORITY.HIGH,
    status: WO_STATUS.COMPLETED,
    assignee: "stf-anil",
    createdAt: "2026-06-20T08:00:00.000Z",
    dueDate: "2026-06-28",
    completedAt: "2026-06-27T16:40:00.000Z",
    outcome: "All 42 extinguishers refilled and tagged. Hydrant pressure normal.",
  },
  {
    id: "WO-2026-019",
    title: "Elevator Block A annual inspection",
    description: "Statutory annual inspection and rope-tension adjustment.",
    assetId: "AST-ELV-A",
    type: WO_TYPE.PREVENTIVE,
    priority: PRIORITY.MEDIUM,
    status: WO_STATUS.COMPLETED,
    assignee: "stf-otis",
    createdAt: "2026-06-05T09:20:00.000Z",
    dueDate: "2026-06-12",
    completedAt: "2026-06-11T13:00:00.000Z",
    outcome: "Passed inspection. Ropes re-tensioned; certificate renewed till Jun 2027.",
  },
];

let seq = 35;
// Next human-readable reference, e.g. WO-2026-036.
export const nextWorkOrderId = () => `WO-2026-${String(++seq).padStart(3, "0")}`;

// Creates and stores a new work order, returning the created record. A brand-new
// order with an assignee starts "assigned"; otherwise it starts "open".
export const addWorkOrder = (data) => {
  const record = {
    id: nextWorkOrderId(),
    status: data.assignee ? WO_STATUS.ASSIGNED : WO_STATUS.OPEN,
    createdAt: new Date().toISOString(),
    completedAt: null,
    outcome: null,
    assignee: null,
    ...data,
  };
  workOrders.unshift(record);
  return record;
};

// Assigns an order to a staff member. If it was still open, moves it to assigned.
export const assignWorkOrder = (id, assignee) => {
  const wo = workOrders.find((w) => w.id === id);
  if (!wo) return null;
  wo.assignee = assignee;
  if (wo.status === WO_STATUS.OPEN) wo.status = WO_STATUS.ASSIGNED;
  return wo;
};

// Sets an order's status. Completing it stamps completedAt and records an
// outcome so it shows up in the asset's maintenance history.
export const setWorkOrderStatus = (id, status, outcome) => {
  const wo = workOrders.find((w) => w.id === id);
  if (!wo) return null;
  wo.status = status;
  if (status === WO_STATUS.COMPLETED) {
    wo.completedAt = new Date().toISOString();
    wo.outcome = outcome || wo.outcome || "Completed.";
  }
  return wo;
};

// Advances an order one step along the lifecycle (open → assigned → in_progress
// → completed). Returns the updated order, or null if already completed.
export const advanceWorkOrder = (id) => {
  const wo = workOrders.find((w) => w.id === id);
  if (!wo) return null;
  const idx = WO_FLOW.indexOf(wo.status);
  if (idx < 0 || idx >= WO_FLOW.length - 1) return wo;
  return setWorkOrderStatus(id, WO_FLOW[idx + 1]);
};

const pad = (n) => String(n).padStart(2, "0");
const todayISO = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// An order is overdue when it is past its due date and not yet completed. `now`
// is injectable so the rule stays testable.
export const isOverdue = (wo, now = new Date()) =>
  wo.status !== WO_STATUS.COMPLETED && !!wo.dueDate && wo.dueDate < todayISO(now);

// Completed work orders for an asset, newest first, shaped for the history table
// (date the work was done + the outcome recorded).
export const getHistoryForAsset = (assetId) =>
  workOrders
    .filter((w) => w.assetId === assetId && w.status === WO_STATUS.COMPLETED)
    .map((w) => ({
      id: w.id,
      title: w.title,
      type: w.type,
      date: w.completedAt || w.dueDate,
      assignee: w.assignee,
      outcome: w.outcome,
      asset: getAssetById(w.assetId)?.name,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

// Board summary counts used by the stat tiles at the top of the page.
export const getBoardStats = (now = new Date()) => ({
  total: workOrders.length,
  open: workOrders.filter((w) => w.status === WO_STATUS.OPEN).length,
  overdue: workOrders.filter((w) => isOverdue(w, now)).length,
  completed: workOrders.filter((w) => w.status === WO_STATUS.COMPLETED).length,
});

