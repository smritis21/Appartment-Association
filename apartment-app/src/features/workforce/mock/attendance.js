// Entry-log / attendance records for house help at the gate. A row is created on
// check-in (entry) and closed on check-out (exit). `hours` is derived on exit.
export const ATTENDANCE_STATUS = {
  IN: "in", // checked in, still on premises
  OUT: "out", // checked out, shift closed
};

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());

// "HH:MM" from a Date.
const clock = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Difference between two "HH:MM" strings, in hours (1 decimal).
export const diffHours = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return null;
  const [ih, im] = checkIn.split(":").map(Number);
  const [oh, om] = checkOut.split(":").map(Number);
  const mins = oh * 60 + om - (ih * 60 + im);
  return mins > 0 ? Math.round((mins / 60) * 10) / 10 : 0;
};

// Singleton attendance log across the society.
export const attendanceLogs = [
  {
    id: "AT-5001",
    helpId: "HH-01",
    helpName: "Lakshmi Devi",
    category: "maid",
    flat: "A-101",
    date: "2026-07-20",
    checkIn: "07:05",
    checkOut: "10:40",
    hours: 3.6,
    status: ATTENDANCE_STATUS.OUT,
    loggedBy: "Security Gate",
  },
  {
    id: "AT-5002",
    helpId: "HH-05",
    helpName: "Meena Kumari",
    category: "nanny",
    flat: "A-101",
    date: "2026-07-19",
    checkIn: "12:10",
    checkOut: "16:00",
    hours: 3.8,
    status: ATTENDANCE_STATUS.OUT,
    loggedBy: "Security Gate",
  },
  {
    id: "AT-5003",
    helpId: "HH-02",
    helpName: "Ganesh Pawar",
    category: "cook",
    flat: "B-204",
    date: todayISO(),
    checkIn: "17:20",
    checkOut: null,
    hours: null,
    status: ATTENDANCE_STATUS.IN,
    loggedBy: "Security Gate",
  },
];

let seq = 5003;
const nextId = () => `AT-${++seq}`;

// Records a check-in (entry) for a worker at a flat. Returns the open record.
export const checkIn = ({ helpId, helpName, category, flat, loggedBy }) => {
  const now = new Date();
  const record = {
    id: nextId(),
    helpId,
    helpName,
    category,
    flat,
    date: toISO(now),
    checkIn: clock(now),
    checkOut: null,
    hours: null,
    status: ATTENDANCE_STATUS.IN,
    loggedBy: loggedBy ?? "Resident",
  };
  attendanceLogs.push(record);
  return record;
};

// Closes an open record with a check-out (exit) and computes hours worked.
export const checkOut = (id) => {
  const rec = attendanceLogs.find((r) => r.id === id);
  if (rec && rec.status === ATTENDANCE_STATUS.IN) {
    rec.checkOut = clock(new Date());
    rec.hours = diffHours(rec.checkIn, rec.checkOut);
    rec.status = ATTENDANCE_STATUS.OUT;
  }
  return rec;
};

// Is this worker currently checked in at this flat? Prevents a double entry.
export const isCheckedIn = ({ helpId, flat }) =>
  attendanceLogs.some(
    (r) => r.helpId === helpId && r.flat === flat && r.status === ATTENDANCE_STATUS.IN,
  );

export const getAttendanceForUser = (user) =>
  attendanceLogs
    .filter((r) => (user?.flat ? r.flat === user.flat : true))
    .sort((a, b) => (a.date === b.date ? b.checkIn.localeCompare(a.checkIn) : b.date.localeCompare(a.date)));
