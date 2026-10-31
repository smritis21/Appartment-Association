// Society staff the Manager rosters and marks attendance for. This is distinct
// from resident house-help (see features/workforce): these are people the
// society itself employs - maintenance, security and housekeeping crews.

export const DEPARTMENT = {
  MAINTENANCE: "maintenance",
  SECURITY: "security",
  HOUSEKEEPING: "housekeeping",
};

export const DEPARTMENT_META = {
  [DEPARTMENT.MAINTENANCE]: { label: "Maintenance", color: "warning" },
  [DEPARTMENT.SECURITY]: { label: "Security", color: "info" },
  [DEPARTMENT.HOUSEKEEPING]: { label: "Housekeeping", color: "success" },
};

// The three daily shifts. `start`/`end` are informational (shown as chips);
// `rank` orders the columns in the roster grid.
export const SHIFT = {
  MORNING: "morning",
  EVENING: "evening",
  NIGHT: "night",
};

export const SHIFT_META = {
  [SHIFT.MORNING]: { label: "Morning", time: "06:00–14:00", rank: 0, color: "warning" },
  [SHIFT.EVENING]: { label: "Evening", time: "14:00–22:00", rank: 1, color: "info" },
  [SHIFT.NIGHT]: { label: "Night", time: "22:00–06:00", rank: 2, color: "primary" },
};

export const SHIFT_ORDER = [SHIFT.MORNING, SHIFT.EVENING, SHIFT.NIGHT];

// Minimum headcount each department needs on each shift. A slot with fewer
// people assigned than its requirement is flagged as understaffed. `0` means the
// department does not run that shift (e.g. housekeeping has no night crew).
export const SHIFT_REQUIREMENTS = {
  [DEPARTMENT.SECURITY]: {
    [SHIFT.MORNING]: 2,
    [SHIFT.EVENING]: 2,
    [SHIFT.NIGHT]: 2,
  },
  [DEPARTMENT.MAINTENANCE]: {
    [SHIFT.MORNING]: 2,
    [SHIFT.EVENING]: 1,
    [SHIFT.NIGHT]: 1,
  },
  [DEPARTMENT.HOUSEKEEPING]: {
    [SHIFT.MORNING]: 3,
    [SHIFT.EVENING]: 2,
    [SHIFT.NIGHT]: 0,
  },
};

// Required headcount for a department/shift, defaulting to 0 when a department
// doesn't run that shift.
export const requiredFor = (department, shift) =>
  SHIFT_REQUIREMENTS[department]?.[shift] ?? 0;

// Society staff roll. Kept small but realistic - enough to create genuine
// understaffing when someone is on leave.
export const staff = [
  { id: "STF-01", name: "Ramesh Yadav", department: DEPARTMENT.SECURITY, phone: "98200 11001" },
  { id: "STF-02", name: "Vijay Singh", department: DEPARTMENT.SECURITY, phone: "98200 11002" },
  { id: "STF-03", name: "Karan Mehta", department: DEPARTMENT.SECURITY, phone: "98200 11003" },
  { id: "STF-04", name: "Mohan Das", department: DEPARTMENT.SECURITY, phone: "98200 11004" },
  { id: "STF-05", name: "Suresh Iyer", department: DEPARTMENT.SECURITY, phone: "98200 11005" },
  { id: "STF-06", name: "Ravi Kumar", department: DEPARTMENT.MAINTENANCE, phone: "98200 11006" },
  { id: "STF-07", name: "Anil Yadav", department: DEPARTMENT.MAINTENANCE, phone: "98200 11007" },
  { id: "STF-08", name: "Prakash Rao", department: DEPARTMENT.MAINTENANCE, phone: "98200 11008" },
  { id: "STF-09", name: "Deepak Nair", department: DEPARTMENT.MAINTENANCE, phone: "98200 11009" },
  { id: "STF-10", name: "Lakshmi Devi", department: DEPARTMENT.HOUSEKEEPING, phone: "98200 11010" },
  { id: "STF-11", name: "Sunita Bai", department: DEPARTMENT.HOUSEKEEPING, phone: "98200 11011" },
  { id: "STF-12", name: "Geeta Sharma", department: DEPARTMENT.HOUSEKEEPING, phone: "98200 11012" },
  { id: "STF-13", name: "Radha Kumari", department: DEPARTMENT.HOUSEKEEPING, phone: "98200 11013" },
  { id: "STF-14", name: "Kamala Devi", department: DEPARTMENT.HOUSEKEEPING, phone: "98200 11014" },
];

export const getStaff = (id) => staff.find((s) => s.id === id) ?? null;
export const staffName = (id) => getStaff(id)?.name ?? "-";
export const staffByDepartment = (department) =>
  staff.filter((s) => s.department === department);

