export const BOOKING_STATUS = {
  CONFIRMED: "confirmed",
  PENDING: "pending",
  CANCELLED: "cancelled",
};

// Seva bookings already raised by the current resident's flat.
export const mockBookings = [
  {
    id: "SEV-2026-014",
    sevaId: "archana",
    sevaName: "Archana",
    date: "2026-07-01",
    time: "07:30 AM",
    amount: 101,
    devotee: "Ramesh Iyer",
    flat: "B-1204",
    status: BOOKING_STATUS.CONFIRMED,
    createdAt: "2026-06-28T09:15:00.000Z",
  },
  {
    id: "SEV-2026-021",
    sevaId: "abhishekam",
    sevaName: "Abhishekam",
    date: "2026-08-02",
    time: "06:30 AM",
    amount: 501,
    devotee: "Ramesh Iyer",
    flat: "B-1204",
    status: BOOKING_STATUS.PENDING,
    createdAt: "2026-07-10T18:40:00.000Z",
  },
];

let seq = 30;
// Generates the next human-readable booking reference.
export const nextBookingId = () =>
  `SEV-2026-${String(++seq).padStart(3, "0")}`;
