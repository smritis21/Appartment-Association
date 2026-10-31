import {
  DEPARTMENT,
  SHIFT_ORDER,
  getStaff,
  requiredFor,
  staffByDepartment,
} from "./staff";
import { isOnLeave } from "./attendance";

// ---- date helpers -----------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());

// Monday of the week containing `ref`. Rosters are planned a week at a time.
export const startOfWeek = (ref = new Date()) => {
  const d = new Date(ref);
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
};

// The seven ISO dates (Mon→Sun) for the week containing `ref`.
export const getWeekDays = (ref = new Date()) => {
  const mon = startOfWeek(ref);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return toISO(d);
  });
};

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const weekdayLabel = (iso) => WEEKDAY[new Date(iso).getDay()];
export const dayLabel = (iso) => `${weekdayLabel(iso)} ${new Date(iso).getDate()}`;

// ---- roster store -----------------------------------------------------------
// A single flat assignment says: this staff member works this shift on this day.
// The roster grid, conflict checks and coverage summary all read this array, and
// mutations here are visible to every screen within the session.
export const assignments = [
  // Mon 2026-07-20
  { id: "RA-1001", staffId: "STF-01", date: "2026-07-20", shift: "morning" },
  { id: "RA-1002", staffId: "STF-02", date: "2026-07-20", shift: "morning" },
  { id: "RA-1003", staffId: "STF-03", date: "2026-07-20", shift: "evening" },
  { id: "RA-1004", staffId: "STF-04", date: "2026-07-20", shift: "evening" },
  { id: "RA-1005", staffId: "STF-05", date: "2026-07-20", shift: "night" },
  { id: "RA-1006", staffId: "STF-06", date: "2026-07-20", shift: "morning" },
  { id: "RA-1007", staffId: "STF-07", date: "2026-07-20", shift: "morning" },
  { id: "RA-1008", staffId: "STF-08", date: "2026-07-20", shift: "evening" },
  { id: "RA-1009", staffId: "STF-10", date: "2026-07-20", shift: "morning" },
  { id: "RA-1010", staffId: "STF-11", date: "2026-07-20", shift: "morning" },
  { id: "RA-1011", staffId: "STF-12", date: "2026-07-20", shift: "morning" },
  { id: "RA-1012", staffId: "STF-13", date: "2026-07-20", shift: "evening" },
  { id: "RA-1013", staffId: "STF-14", date: "2026-07-20", shift: "evening" },

  // Tue 2026-07-21
  { id: "RA-1020", staffId: "STF-01", date: "2026-07-21", shift: "morning" },
  { id: "RA-1021", staffId: "STF-02", date: "2026-07-21", shift: "evening" },
  { id: "RA-1022", staffId: "STF-03", date: "2026-07-21", shift: "evening" },
  { id: "RA-1023", staffId: "STF-04", date: "2026-07-21", shift: "night" },
  { id: "RA-1024", staffId: "STF-05", date: "2026-07-21", shift: "night" },
  { id: "RA-1025", staffId: "STF-06", date: "2026-07-21", shift: "morning" },
  { id: "RA-1026", staffId: "STF-08", date: "2026-07-21", shift: "morning" },
  { id: "RA-1027", staffId: "STF-09", date: "2026-07-21", shift: "evening" },
  { id: "RA-1028", staffId: "STF-10", date: "2026-07-21", shift: "morning" },
  { id: "RA-1029", staffId: "STF-11", date: "2026-07-21", shift: "morning" },
  { id: "RA-1030", staffId: "STF-13", date: "2026-07-21", shift: "evening" },

  // Wed 2026-07-22 (today) - deliberately thin so understaffing shows up
  { id: "RA-1040", staffId: "STF-01", date: "2026-07-22", shift: "morning" },
  { id: "RA-1041", staffId: "STF-02", date: "2026-07-22", shift: "morning" },
  { id: "RA-1042", staffId: "STF-03", date: "2026-07-22", shift: "evening" },
  { id: "RA-1043", staffId: "STF-05", date: "2026-07-22", shift: "night" },
  { id: "RA-1044", staffId: "STF-06", date: "2026-07-22", shift: "morning" },
  { id: "RA-1045", staffId: "STF-07", date: "2026-07-22", shift: "evening" },
  { id: "RA-1046", staffId: "STF-10", date: "2026-07-22", shift: "morning" },
  { id: "RA-1047", staffId: "STF-11", date: "2026-07-22", shift: "morning" },
  { id: "RA-1048", staffId: "STF-13", date: "2026-07-22", shift: "evening" },

  // Thu 2026-07-23
  { id: "RA-1060", staffId: "STF-02", date: "2026-07-23", shift: "morning" },
  { id: "RA-1061", staffId: "STF-03", date: "2026-07-23", shift: "morning" },
  { id: "RA-1062", staffId: "STF-04", date: "2026-07-23", shift: "evening" },
  { id: "RA-1063", staffId: "STF-01", date: "2026-07-23", shift: "night" },
  { id: "RA-1064", staffId: "STF-07", date: "2026-07-23", shift: "morning" },
  { id: "RA-1065", staffId: "STF-08", date: "2026-07-23", shift: "morning" },
  { id: "RA-1066", staffId: "STF-11", date: "2026-07-23", shift: "morning" },
  { id: "RA-1067", staffId: "STF-12", date: "2026-07-23", shift: "morning" },
  { id: "RA-1068", staffId: "STF-14", date: "2026-07-23", shift: "evening" },
];

let seq = 2000;
const nextId = () => `RA-${++seq}`;

// ---- reads ------------------------------------------------------------------
// All assignments on a given day.
export const assignmentsOnDay = (date) => assignments.filter((a) => a.date === date);

// Everyone assigned to a specific department + shift + day.
export const assignedTo = (date, department, shift) =>
  assignments.filter(
    (a) => a.date === date && a.shift === shift && getStaff(a.staffId)?.department === department,
  );

// The shifts a staff member is already booked on for a given day (usually 0 or 1;
// two means a double-booking conflict).
export const shiftsForStaffOnDay = (staffId, date) =>
  assignments.filter((a) => a.staffId === staffId && a.date === date).map((a) => a.shift);

// ---- validation -------------------------------------------------------------
// Checks whether a staff member can be put on `shift` for `date`. Returns a
// structured result so the dialog can show an inline error and block the save.
// Rules: no double-booking the same day, no assigning someone who is on approved
// leave, and no duplicate of an existing assignment.
export const validateAssignment = ({ staffId, date, shift }) => {
  const existing = shiftsForStaffOnDay(staffId, date);
  if (existing.includes(shift)) {
    return { valid: false, error: "This staff member is already on this shift for the day." };
  }
  if (existing.length > 0) {
    return {
      valid: false,
      error: "Shift conflict: already assigned to another shift on this day.",
    };
  }
  if (isOnLeave(staffId, date)) {
    return { valid: false, error: "This staff member is marked on leave for this day." };
  }
  return { valid: true, error: null };
};

// ---- writes -----------------------------------------------------------------
// Adds an assignment after validation. Returns { ok, record?, error? }.
export const assignShift = ({ staffId, date, shift }) => {
  const check = validateAssignment({ staffId, date, shift });
  if (!check.valid) return { ok: false, error: check.error };
  const record = { id: nextId(), staffId, date, shift };
  assignments.push(record);
  return { ok: true, record };
};

// Removes an assignment by id.
export const unassignShift = (id) => {
  const idx = assignments.findIndex((a) => a.id === id);
  if (idx === -1) return false;
  assignments.splice(idx, 1);
  return true;
};

// ---- conflicts & coverage ---------------------------------------------------
// Staff double-booked (assigned to more than one shift) on a given day.
export const conflictsOnDay = (date) => {
  const byStaff = {};
  for (const a of assignmentsOnDay(date)) {
    (byStaff[a.staffId] ??= []).push(a);
  }
  return Object.entries(byStaff)
    .filter(([, rows]) => rows.length > 1)
    .map(([staffId, rows]) => ({ staffId, shifts: rows.map((r) => r.shift) }));
};

// Coverage for one department + shift + day: who is assigned, how many are
// required, and whether the slot is understaffed.
export const slotCoverage = (date, department, shift) => {
  const assigned = assignedTo(date, department, shift);
  const required = requiredFor(department, shift);
  return {
    date,
    department,
    shift,
    assigned,
    count: assigned.length,
    required,
    understaffed: assigned.length < required,
    short: Math.max(required - assigned.length, 0),
  };
};

// Every understaffed slot on a given day, across all departments and shifts.
export const understaffedSlots = (date) => {
  const out = [];
  for (const department of Object.values(DEPARTMENT)) {
    for (const shift of SHIFT_ORDER) {
      const slot = slotCoverage(date, department, shift);
      if (slot.required > 0 && slot.understaffed) out.push(slot);
    }
  }
  return out;
};

// Day-level roster summary used by the stat tiles at the top of the roster page.
export const getRosterStats = (date) => {
  let requiredTotal = 0;
  let assignedTotal = 0;
  for (const department of Object.values(DEPARTMENT)) {
    for (const shift of SHIFT_ORDER) {
      const slot = slotCoverage(date, department, shift);
      requiredTotal += slot.required;
      assignedTotal += Math.min(slot.count, slot.required);
    }
  }
  return {
    assigned: assignmentsOnDay(date).length,
    required: requiredTotal,
    filled: assignedTotal,
    understaffed: understaffedSlots(date).length,
    conflicts: conflictsOnDay(date).length,
  };
};

// Staff in a department with no assignment yet on a given day - the pool the
// assign dialog offers first.
export const unassignedStaff = (date, department) => {
  const busy = new Set(assignmentsOnDay(date).map((a) => a.staffId));
  return staffByDepartment(department).filter((s) => !busy.has(s.id));
};

