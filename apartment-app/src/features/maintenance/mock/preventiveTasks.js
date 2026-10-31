import { getAssetById } from "./assets";
import { PRIORITY } from "./workOrders";

// Recurring preventive-maintenance schedules. Each one is linked to an asset and
// repeats on a fixed cadence; the calendar expands these into dated occurrences
// for whichever month is on screen.
export const FREQUENCY = {
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  HALF_YEARLY: "half_yearly",
};

export const FREQUENCY_META = {
  [FREQUENCY.WEEKLY]: { label: "Weekly", color: "info" },
  [FREQUENCY.MONTHLY]: { label: "Monthly", color: "primary" },
  [FREQUENCY.QUARTERLY]: { label: "Quarterly", color: "warning" },
  [FREQUENCY.HALF_YEARLY]: { label: "Half-yearly", color: "secondary" },
};

// `anchor` is a reference date the cadence is measured from. `weekday` (0=Sun) is
// used for weekly tasks; `day` (1-28) is the day-of-month for the rest.
export const PREVENTIVE_TASKS = [
  {
    id: "PM-ELV-A",
    title: "Elevator A - routine service",
    assetId: "AST-ELV-A",
    frequency: FREQUENCY.MONTHLY,
    day: 8,
    anchor: "2026-01-08",
    assignee: "stf-otis",
    priority: PRIORITY.MEDIUM,
  },
  {
    id: "PM-ELV-B",
    title: "Elevator B - routine service",
    assetId: "AST-ELV-B",
    frequency: FREQUENCY.MONTHLY,
    day: 9,
    anchor: "2026-01-09",
    assignee: "stf-otis",
    priority: PRIORITY.MEDIUM,
  },
  {
    id: "PM-GEN-1",
    title: "Generator load test",
    assetId: "AST-GEN-1",
    frequency: FREQUENCY.QUARTERLY,
    day: 30,
    anchor: "2026-01-30",
    assignee: "stf-ravi",
    priority: PRIORITY.MEDIUM,
  },
  {
    id: "PM-PUMP-1",
    title: "Water pump greasing",
    assetId: "AST-PUMP-1",
    frequency: FREQUENCY.MONTHLY,
    day: 5,
    anchor: "2026-01-05",
    assignee: "stf-suresh",
    priority: PRIORITY.MEDIUM,
  },
  {
    id: "PM-STP-1",
    title: "STP sludge & aerator check",
    assetId: "AST-STP-1",
    frequency: FREQUENCY.WEEKLY,
    weekday: 1, // Monday
    anchor: "2026-01-05",
    assignee: "stf-anil",
    priority: PRIORITY.HIGH,
  },
  {
    id: "PM-FIRE-1",
    title: "Fire system inspection",
    assetId: "AST-FIRE-1",
    frequency: FREQUENCY.HALF_YEARLY,
    day: 27,
    anchor: "2025-12-27",
    assignee: "stf-anil",
    priority: PRIORITY.HIGH,
  },
  {
    id: "PM-HVAC-CH",
    title: "Clubhouse HVAC filter clean",
    assetId: "AST-HVAC-CH",
    frequency: FREQUENCY.MONTHLY,
    day: 15,
    anchor: "2026-01-15",
    assignee: "stf-daikin",
    priority: PRIORITY.MEDIUM,
  },
  {
    id: "PM-POOL-1",
    title: "Pool filtration backwash",
    assetId: "AST-POOL-1",
    frequency: FREQUENCY.WEEKLY,
    weekday: 6, // Saturday
    anchor: "2026-01-03",
    assignee: "stf-anil",
    priority: PRIORITY.LOW,
  },
];

export const getPreventiveTaskById = (id) =>
  PREVENTIVE_TASKS.find((t) => t.id === id) ?? null;

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// How many months a monthly-family cadence advances by.
const MONTH_STEP = {
  [FREQUENCY.MONTHLY]: 1,
  [FREQUENCY.QUARTERLY]: 3,
  [FREQUENCY.HALF_YEARLY]: 6,
};

// Whether a given month (0-based) is "on cadence" relative to the anchor month,
// e.g. a quarterly task anchored in January also fires in Apr / Jul / Oct.
function monthOnCadence(task, year, month) {
  const anchor = new Date(task.anchor);
  const step = MONTH_STEP[task.frequency];
  const diff = (year - anchor.getFullYear()) * 12 + (month - anchor.getMonth());
  return diff >= 0 && diff % step === 0;
}

// All occurrences of a single task that fall inside the given month.
function taskOccurrencesInMonth(task, year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const out = [];

  if (task.frequency === FREQUENCY.WEEKLY) {
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      if (d.getDay() === task.weekday) out.push(toISO(d));
    }
    return out;
  }

  if (!monthOnCadence(task, year, month)) return out;
  const day = Math.min(task.day, daysInMonth);
  out.push(toISO(new Date(year, month, day)));
  return out;
}

// Every preventive occurrence in the given month, each carrying its date, the
// linked asset and scheduling metadata - this is what the calendar renders.
export function getOccurrencesForMonth(year, month) {
  const occurrences = [];
  for (const task of PREVENTIVE_TASKS) {
    for (const date of taskOccurrencesInMonth(task, year, month)) {
      occurrences.push({
        key: `${task.id}-${date}`,
        taskId: task.id,
        title: task.title,
        date,
        assetId: task.assetId,
        assetName: getAssetById(task.assetId)?.name ?? "-",
        frequency: task.frequency,
        assignee: task.assignee,
        priority: task.priority,
      });
    }
  }
  return occurrences.sort((a, b) => a.date.localeCompare(b.date));
}

// Occurrences grouped by ISO date, for quick per-day lookup in the calendar grid.
export function getOccurrenceMap(year, month) {
  const map = {};
  for (const occ of getOccurrencesForMonth(year, month)) {
    (map[occ.date] ??= []).push(occ);
  }
  return map;
}

// The next N upcoming occurrences from `from`, scanning up to 3 months ahead -
// used for the "upcoming" list beside the calendar.
export function getUpcomingOccurrences(from = new Date(), limit = 6) {
  const fromISO = toISO(from);
  const results = [];
  for (let i = 0; i < 3 && results.length < limit; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() + i, 1);
    const occ = getOccurrencesForMonth(d.getFullYear(), d.getMonth()).filter(
      (o) => o.date >= fromISO,
    );
    results.push(...occ);
  }
  return results.sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
}

