import { getHelpById } from "./houseHelp";

// Lifecycle of a house-help booking:
//   requested → confirmed → completed   (or → cancelled at any point before)
// A booking is only ratable once it reaches `completed`.
export const BOOKING_STATUS = {
  REQUESTED: "requested",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const BOOKING_STATUS_META = {
  [BOOKING_STATUS.REQUESTED]: { label: "Requested", color: "info" },
  [BOOKING_STATUS.CONFIRMED]: { label: "Confirmed", color: "success" },
  [BOOKING_STATUS.COMPLETED]: { label: "Completed", color: "default" },
  [BOOKING_STATUS.CANCELLED]: { label: "Cancelled", color: "default" },
};

// Fixed daily shifts house help is booked against.
export const SHIFTS = [
  { id: "morning", label: "Morning (7 AM – 11 AM)" },
  { id: "afternoon", label: "Afternoon (12 PM – 4 PM)" },
  { id: "evening", label: "Evening (5 PM – 9 PM)" },
];

export const shiftLabel = (id) => SHIFTS.find((s) => s.id === id)?.label ?? id;

// Singleton register of every house-help booking in the society. The resident
// screen filters to the current user; the management register shows all rows.
export const houseHelpBookings = [
  {
    id: "HB-2026-021",
    helpId: "HH-01",
    helpName: "Lakshmi Devi",
    category: "maid",
    date: "2026-07-20",
    shift: "morning",
    bookedBy: "Arjun Mehta",
    flat: "A-101",
    role: "owner",
    notes: "Daily sweeping + utensils",
    status: BOOKING_STATUS.COMPLETED,
    createdAt: "2026-07-18T06:20:00.000Z",
  },
  {
    id: "HB-2026-022",
    helpId: "HH-02",
    helpName: "Ganesh Pawar",
    category: "cook",
    date: "2026-07-23",
    shift: "evening",
    bookedBy: "Priya Sharma",
    flat: "B-204",
    role: "tenant",
    notes: "Dinner for 4, vegetarian",
    status: BOOKING_STATUS.CONFIRMED,
    createdAt: "2026-07-21T15:10:00.000Z",
  },
  {
    id: "HB-2026-023",
    helpId: "HH-05",
    helpName: "Meena Kumari",
    category: "nanny",
    date: "2026-07-19",
    shift: "afternoon",
    bookedBy: "Arjun Mehta",
    flat: "A-101",
    role: "owner",
    notes: "",
    status: BOOKING_STATUS.COMPLETED,
    createdAt: "2026-07-17T11:00:00.000Z",
  },
];

let seq = 23;
export const nextBookingId = () => `HB-2026-${String(++seq).padStart(3, "0")}`;

// Creates a new booking in the "requested" state and returns the record.
export const addBooking = (booking) => {
  const record = {
    id: nextBookingId(),
    status: BOOKING_STATUS.REQUESTED,
    createdAt: new Date().toISOString(),
    ...booking,
  };
  houseHelpBookings.push(record);
  return record;
};

const setStatus = (id, status) => {
  const b = houseHelpBookings.find((x) => x.id === id);
  if (b) b.status = status;
  return b;
};

export const confirmBooking = (id) => setStatus(id, BOOKING_STATUS.CONFIRMED);
export const completeBooking = (id) => setStatus(id, BOOKING_STATUS.COMPLETED);
export const cancelBooking = (id) => setStatus(id, BOOKING_STATUS.CANCELLED);

// A worker is double-booked if they already hold a live (non-cancelled) booking
// for the same date + shift.
export const hasClash = ({ helpId, date, shift }) =>
  houseHelpBookings.some(
    (b) =>
      b.helpId === helpId &&
      b.date === date &&
      b.shift === shift &&
      b.status !== BOOKING_STATUS.CANCELLED,
  );

// The current user cannot raise the same worker + date + shift twice.
export const hasOwnClash = ({ user, helpId, date, shift }) =>
  houseHelpBookings.some(
    (b) =>
      b.flat === user?.flat &&
      b.helpId === helpId &&
      b.date === date &&
      b.shift === shift &&
      b.status !== BOOKING_STATUS.CANCELLED,
  );

export const getBookingsForUser = (user) =>
  houseHelpBookings
    .filter((b) => (user?.flat ? b.flat === user.flat : b.bookedBy === user?.name))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

// Completed bookings for a user that have not yet been rated (see ratings.js for
// `ratedBookingIds`).
export const getRatableBookings = (user, ratedBookingIds) =>
  getBookingsForUser(user).filter(
    (b) => b.status === BOOKING_STATUS.COMPLETED && !ratedBookingIds.includes(b.id),
  );

// Enriches a booking row with the live worker profile (rate, verified badge).
export const withHelp = (booking) => ({ ...booking, help: getHelpById(booking.helpId) });
