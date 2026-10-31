import FitnessCenterOutlinedIcon from "@mui/icons-material/FitnessCenterOutlined";
import PoolOutlinedIcon from "@mui/icons-material/PoolOutlined";
import SportsTennisOutlinedIcon from "@mui/icons-material/SportsTennisOutlined";

// Community facilities a resident can reserve. `capacity` is how many parallel
// bookings a single slot accepts (a court is 1-at-a-time, the gym seats a few).
export const FACILITIES = [
  {
    id: "gym",
    name: "Gymnasium",
    icon: FitnessCenterOutlinedIcon,
    location: "Clubhouse · Ground Floor",
    capacity: 4,
    description: "Cardio + strength equipment. Slot-based to keep the floor uncrowded.",
  },
  {
    id: "pool",
    name: "Swimming Pool",
    icon: PoolOutlinedIcon,
    location: "Clubhouse · Rear Deck",
    capacity: 6,
    description: "Semi-Olympic pool. Lifeguard on duty during booked slots only.",
  },
  {
    id: "court",
    name: "Sports Court",
    icon: SportsTennisOutlinedIcon,
    location: "Block C · Open Area",
    capacity: 1,
    description: "Multi-purpose badminton / tennis court. One party per slot.",
  },
];

export const getFacilityById = (id) => FACILITIES.find((f) => f.id === id) ?? null;

// Fixed hourly bands the facilities operate on. `start`/`end` are 24h decimals
// used only to decide whether a slot has already elapsed today.
export const TIME_SLOTS = [
  { time: "06:00 - 07:00", start: 6, end: 7 },
  { time: "07:00 - 08:00", start: 7, end: 8 },
  { time: "08:00 - 09:00", start: 8, end: 9 },
  { time: "17:00 - 18:00", start: 17, end: 18 },
  { time: "18:00 - 19:00", start: 18, end: 19 },
  { time: "19:00 - 20:00", start: 19, end: 20 },
];

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Slots the Secretary has blocked for maintenance / events, keyed by
// `${facilityId}|${date}`. These render as "Blocked" and cannot be booked.
// Dates are derived from the live rolling window (not literal dates) so the
// seeded "blocked for maintenance" demo slots stay on real, upcoming days.
const inDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return toISO(d);
};

export const BLOCKED_SLOTS = {
  [`pool|${inDays(2)}`]: ["06:00 - 07:00", "07:00 - 08:00"],
  [`gym|${inDays(3)}`]: ["17:00 - 18:00"],
  [`court|${inDays(1)}`]: ["19:00 - 20:00"],
};

// Next 7 calendar days starting today. The resident can only book inside this
// rolling window.
export const getBookableDates = (from = new Date()) => {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      value: toISO(d),
      label: d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        month: "short",
      }),
      isToday: i === 0,
    };
  });
};

export const SLOT_STATE = {
  AVAILABLE: "available",
  BOOKED: "booked",
  BLOCKED: "blocked",
  PAST: "past",
};

// Decides the state of a single slot for a facility on a date, given the list
// of active bookings. `now` is injected so the logic stays testable.
export function getSlotState({ facility, date, slot, bookings, now = new Date() }) {
  const isBlocked = (BLOCKED_SLOTS[`${facility.id}|${date}`] ?? []).includes(slot.time);
  if (isBlocked) return SLOT_STATE.BLOCKED;

  const todayISO = toISO(now);
  const nowHours = now.getHours() + now.getMinutes() / 60;
  if (date < todayISO || (date === todayISO && slot.end <= nowHours)) {
    return SLOT_STATE.PAST;
  }

  const taken = bookings.filter(
    (b) =>
      b.facilityId === facility.id &&
      b.date === date &&
      b.time === slot.time &&
      b.status === "confirmed",
  ).length;
  if (taken >= facility.capacity) return SLOT_STATE.BOOKED;

  return SLOT_STATE.AVAILABLE;
}

// Full slot grid for a facility + date, each entry carrying its state and how
// many spots remain (useful for the shared-capacity gym / pool).
export function getSlotGrid({ facility, date, bookings, now = new Date() }) {
  return TIME_SLOTS.map((slot) => {
    const state = getSlotState({ facility, date, slot, bookings, now });
    const taken = bookings.filter(
      (b) =>
        b.facilityId === facility.id &&
        b.date === date &&
        b.time === slot.time &&
        b.status === "confirmed",
    ).length;
    return {
      ...slot,
      state,
      spotsLeft: Math.max(facility.capacity - taken, 0),
      capacity: facility.capacity,
    };
  });
}
