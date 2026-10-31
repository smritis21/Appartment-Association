export const BOOKING_STATUS = {
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
};

export const BOOKING_STATUS_LABELS = {
  [BOOKING_STATUS.CONFIRMED]: "Confirmed",
  [BOOKING_STATUS.CANCELLED]: "Cancelled",
};

// Facility bookings across the whole society. The resident booking screen shows
// only the current user's rows; the Secretary admin view shows every row so
// management can see who booked what, which slot and when.
// Module is a singleton, so mutations here are visible to both screens within a
// session (matches the pattern used by the temple feature).
export const facilityBookings = [
  {
    id: "FAC-2026-014",
    facilityId: "gym",
    facilityName: "Gymnasium",
    date: "2026-07-13",
    time: "18:00 - 19:00",
    bookedBy: "Arjun Mehta",
    flat: "A-101",
    role: "owner",
    status: BOOKING_STATUS.CONFIRMED,
    createdAt: "2026-07-11T09:15:00.000Z",
  },
  {
    id: "FAC-2026-015",
    facilityId: "pool",
    facilityName: "Swimming Pool",
    date: "2026-07-14",
    time: "07:00 - 08:00",
    bookedBy: "Priya Sharma",
    flat: "B-204",
    role: "tenant",
    status: BOOKING_STATUS.CONFIRMED,
    createdAt: "2026-07-12T18:40:00.000Z",
  },
  {
    id: "FAC-2026-016",
    facilityId: "court",
    facilityName: "Sports Court",
    date: "2026-07-16",
    time: "18:00 - 19:00",
    bookedBy: "Ramesh Iyer",
    flat: "C-301",
    role: "president",
    status: BOOKING_STATUS.CONFIRMED,
    createdAt: "2026-07-12T20:05:00.000Z",
  },
  {
    id: "FAC-2026-017",
    facilityId: "gym",
    facilityName: "Gymnasium",
    date: "2026-07-10",
    time: "06:00 - 07:00",
    bookedBy: "Arjun Mehta",
    flat: "A-101",
    role: "owner",
    status: BOOKING_STATUS.CONFIRMED,
    createdAt: "2026-07-08T07:30:00.000Z",
  },
];

let seq = 17;
// Next human-readable booking reference, e.g. FAC-2026-018.
export const nextBookingId = () => `FAC-2026-${String(++seq).padStart(3, "0")}`;

// Adds a confirmed booking and returns the created record.
export const addBooking = (booking) => {
  const record = {
    id: nextBookingId(),
    status: BOOKING_STATUS.CONFIRMED,
    createdAt: new Date().toISOString(),
    ...booking,
  };
  facilityBookings.push(record);
  return record;
};

// Cancels a booking in place so the slot frees up for others.
export const cancelBooking = (id) => {
  const b = facilityBookings.find((x) => x.id === id);
  if (b) b.status = BOOKING_STATUS.CANCELLED;
  return b;
};

// Bookings that belong to a given resident (matched by flat, falling back to
// name), newest first.
export const getBookingsForUser = (user) =>
  facilityBookings
    .filter((b) => (user?.flat ? b.flat === user.flat : b.bookedBy === user?.name))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
