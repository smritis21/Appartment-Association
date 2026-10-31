import { getAssetById } from "./assets";
import { PRIORITY, PRIORITY_META, STAFF, staffName } from "./workOrders";

// Manager-planned, one-off maintenance activities. Unlike `preventiveTasks`
// (fixed recurring cadences the system expands automatically), these are
// created ad-hoc from the scheduling screen: the Manager picks a date, a time
// and the facilities the work affects. Singleton array - the schedule page
// re-reads it after every mutation, matching the workOrders / workforce pattern.

export const scheduledEvents = [
  {
    id: "SCH-2026-001",
    title: "Overhead tank cleaning",
    date: "2026-07-24",
    time: "09:00",
    facilities: ["AST-PUMP-1"],
    priority: PRIORITY.HIGH,
    assignee: "stf-suresh",
    notes: "Water supply to Blocks A & B paused 9-11 AM.",
  },
  {
    id: "SCH-2026-002",
    title: "Generator annual servicing",
    date: "2026-07-28",
    time: "14:30",
    facilities: ["AST-GEN-1"],
    priority: PRIORITY.MEDIUM,
    assignee: "stf-ravi",
    notes: "",
  },
  {
    id: "SCH-2026-003",
    title: "Clubhouse deep-clean & HVAC filter change",
    date: "2026-07-30",
    time: "11:00",
    facilities: ["AST-HVAC-CH", "AST-GYM-1", "AST-POOL-1"],
    priority: PRIORITY.LOW,
    assignee: "stf-daikin",
    notes: "Clubhouse amenities closed for the morning.",
  },
];

// --- id generation -------------------------------------------------------
let seq = scheduledEvents.length;
export const nextScheduledEventId = () =>
  `SCH-2026-${String(++seq).padStart(3, "0")}`;

// --- mutations -----------------------------------------------------------
// Creates and stores a new scheduled event, returning the stored record. The
// caller (form) has already validated the payload, so this just normalises it.
export const addScheduledEvent = (data) => {
  const event = {
    id: nextScheduledEventId(),
    title: data.title.trim(),
    date: data.date,
    time: data.time,
    facilities: data.facilities ?? [],
    priority: data.priority ?? PRIORITY.MEDIUM,
    assignee: data.assignee || null,
    notes: (data.notes ?? "").trim(),
  };
  scheduledEvents.push(event);
  return event;
};

export const removeScheduledEvent = (id) => {
  const i = scheduledEvents.findIndex((e) => e.id === id);
  if (i !== -1) scheduledEvents.splice(i, 1);
};

// --- read helpers --------------------------------------------------------
// Resolve the stored facility ids into displayable asset names.
export const facilityNames = (ids = []) =>
  ids.map((id) => getAssetById(id)?.name ?? id);

export const eventAssigneeName = (id) => staffName(id) ?? "Unassigned";

// Priority chip metadata for an event, reusing the work-order palette.
export const eventPriorityMeta = (priority) =>
  PRIORITY_META[priority] ?? PRIORITY_META[PRIORITY.MEDIUM];

// Events on a given ISO date, sorted by time - used by the calendar day cells.
export const getEventsOnDate = (iso) =>
  scheduledEvents
    .filter((e) => e.date === iso)
    .sort((a, b) => a.time.localeCompare(b.time));

// Events grouped by ISO date, for quick per-day lookup in the calendar grid.
export const getEventMap = () => {
  const map = {};
  for (const e of scheduledEvents) (map[e.date] ??= []).push(e);
  for (const iso of Object.keys(map)) map[iso].sort((a, b) => a.time.localeCompare(b.time));
  return map;
};

// All events in date+time order - used by the list view.
export const getEventsSorted = () =>
  scheduledEvents
    .slice()
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

// Re-export so pages/components can pull staff + priority from one module.
export { STAFF, PRIORITY, PRIORITY_META };

