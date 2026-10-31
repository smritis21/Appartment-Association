import { DEPARTMENT, SHIFT_ORDER, getStaff, requiredFor } from "./staff";

// Actual presence per staff member per day. Where the roster is the *plan*,
// attendance is what really happened: each person is Present, Absent or on Leave
// for the day.
export const ATTENDANCE = {
  PRESENT: "present",
  ABSENT: "absent",
  LEAVE: "leave",
};

export const ATTENDANCE_META = {
  [ATTENDANCE.PRESENT]: { label: "Present", color: "success" },
  [ATTENDANCE.ABSENT]: { label: "Absent", color: "error" },
  [ATTENDANCE.LEAVE]: { label: "Leave", color: "warning" },
};

// One row per staff per day. Singleton, shared across screens for the session.
export const attendance = [
  // Wed 2026-07-22 (today) - partially marked
  { id: "AT-3001", staffId: "STF-01", date: "2026-07-22", status: ATTENDANCE.PRESENT, note: "" },
  { id: "AT-3002", staffId: "STF-02", date: "2026-07-22", status: ATTENDANCE.PRESENT, note: "" },
  { id: "AT-3003", staffId: "STF-03", date: "2026-07-22", status: ATTENDANCE.PRESENT, note: "" },
  { id: "AT-3004", staffId: "STF-04", date: "2026-07-22", status: ATTENDANCE.LEAVE, note: "Approved casual leave" },
  { id: "AT-3005", staffId: "STF-06", date: "2026-07-22", status: ATTENDANCE.PRESENT, note: "" },
  { id: "AT-3006", staffId: "STF-07", date: "2026-07-22", status: ATTENDANCE.ABSENT, note: "No intimation" },
  { id: "AT-3007", staffId: "STF-10", date: "2026-07-22", status: ATTENDANCE.PRESENT, note: "" },
  { id: "AT-3008", staffId: "STF-11", date: "2026-07-22", status: ATTENDANCE.PRESENT, note: "" },

  // Tue 2026-07-21 - fully marked
  { id: "AT-3020", staffId: "STF-01", date: "2026-07-21", status: ATTENDANCE.PRESENT, note: "" },
  { id: "AT-3021", staffId: "STF-02", date: "2026-07-21", status: ATTENDANCE.PRESENT, note: "" },
  { id: "AT-3022", staffId: "STF-03", date: "2026-07-21", status: ATTENDANCE.PRESENT, note: "" },
  { id: "AT-3023", staffId: "STF-04", date: "2026-07-21", status: ATTENDANCE.PRESENT, note: "" },
  { id: "AT-3024", staffId: "STF-05", date: "2026-07-21", status: ATTENDANCE.PRESENT, note: "" },
  { id: "AT-3025", staffId: "STF-06", date: "2026-07-21", status: ATTENDANCE.PRESENT, note: "" },
  { id: "AT-3026", staffId: "STF-08", date: "2026-07-21", status: ATTENDANCE.ABSENT, note: "Sick" },
  { id: "AT-3027", staffId: "STF-09", date: "2026-07-21", status: ATTENDANCE.PRESENT, note: "" },
  { id: "AT-3028", staffId: "STF-10", date: "2026-07-21", status: ATTENDANCE.PRESENT, note: "" },
  { id: "AT-3029", staffId: "STF-11", date: "2026-07-21", status: ATTENDANCE.LEAVE, note: "Festival leave" },
  { id: "AT-3030", staffId: "STF-13", date: "2026-07-21", status: ATTENDANCE.PRESENT, note: "" },
];

let seq = 4000;
const nextId = () => `AT-${++seq}`;

// The attendance row for a staff member on a day, or null if not yet marked.
export const getAttendance = (staffId, date) =>
  attendance.find((r) => r.staffId === staffId && r.date === date) ?? null;

// The marked status for a staff member on a day, or null if unmarked.
export const attendanceStatus = (staffId, date) => getAttendance(staffId, date)?.status ?? null;

// Whether a staff member is on approved leave that day. The roster uses this to
// block assigning someone who won't be in.
export const isOnLeave = (staffId, date) => attendanceStatus(staffId, date) === ATTENDANCE.LEAVE;

// Marks (or re-marks) a staff member's attendance for a day. Upserts so marking
// again just updates the existing row. Returns { ok, record?, error? }.
export const markAttendance = ({ staffId, date, status, note = "" }) => {
  if (!getStaff(staffId)) return { ok: false, error: "Unknown staff member." };
  if (!Object.values(ATTENDANCE).includes(status)) {
    return { ok: false, error: "Pick present, absent or leave." };
  }
  const existing = getAttendance(staffId, date);
  if (existing) {
    existing.status = status;
    existing.note = note;
    return { ok: true, record: existing };
  }
  const record = { id: nextId(), staffId, date, status, note };
  attendance.push(record);
  return { ok: true, record };
};

// ---- daily coverage ---------------------------------------------------------
// Society-wide attendance tallies for a day, used by the summary tiles.
export const getDaySummary = (date, roster) => {
  const totalStaff = roster.length;
  const rows = attendance.filter((r) => r.date === date);
  const present = rows.filter((r) => r.status === ATTENDANCE.PRESENT).length;
  const absent = rows.filter((r) => r.status === ATTENDANCE.ABSENT).length;
  const leave = rows.filter((r) => r.status === ATTENDANCE.LEAVE).length;
  const marked = rows.length;
  return {
    totalStaff,
    marked,
    unmarked: totalStaff - marked,
    present,
    absent,
    leave,
    presentRate: totalStaff ? Math.round((present / totalStaff) * 100) : 0,
  };
};

// Per-department, per-shift coverage for a day: how many *rostered* people
// actually showed up (present) against the required headcount. This is the
// operational view - a slot can be staffed on paper but short once leave and
// absence are counted, so it's flagged separately from the roster's plan.
export const getCoverageByShift = (date, assignedTo) => {
  const out = [];
  for (const department of Object.values(DEPARTMENT)) {
    for (const shift of SHIFT_ORDER) {
      const required = requiredFor(department, shift);
      if (required === 0) continue;
      const rostered = assignedTo(date, department, shift);
      const presentCount = rostered.filter(
        (a) => attendanceStatus(a.staffId, date) === ATTENDANCE.PRESENT,
      ).length;
      out.push({
        department,
        shift,
        required,
        rostered: rostered.length,
        present: presentCount,
        short: Math.max(required - presentCount, 0),
        covered: presentCount >= required,
      });
    }
  }
  return out;
};

