// Seva (pooja) types offered at the community temple. Residents book a monthly
// slot for one of these. Prices are the suggested dakshina in INR.
export const SEVA_TYPES = [
  {
    id: "abhishekam",
    name: "Abhishekam",
    price: 501,
    duration: "45 min",
    description:
      "Sacred bathing of the deity with milk, honey and sandal, performed by the temple priest.",
  },
  {
    id: "sandhana-kaapu",
    name: "Sandhana Kaapu",
    price: 251,
    duration: "30 min",
    description:
      "Application of sandal paste to the deity, offered on your family's behalf.",
  },
  {
    id: "archana",
    name: "Archana",
    price: 101,
    duration: "15 min",
    description:
      "Recitation of the deity's names with your gothra and nakshatra, followed by prasadam.",
  },
];

export const getSevaById = (id) => SEVA_TYPES.find((s) => s.id === id) ?? null;

const slugify = (name) =>
  name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Adds a new seva (pooja) to the shared list. Because modules are singletons,
// the resident booking page picks this up within the same session. Managed by
// the Secretary from the Manage Temple screen.
export const addSeva = ({ name, price, duration, description }) => {
  let id = slugify(name);
  while (SEVA_TYPES.some((s) => s.id === id)) id = `${id}-${SEVA_TYPES.length}`;
  const seva = {
    id,
    name: name.trim(),
    price: Number(price),
    duration: duration.trim() || "30 min",
    description: description.trim(),
  };
  SEVA_TYPES.push(seva);
  return seva;
};

// Fixed pooja time bands for the temple day. Each booking date exposes these
// slots; a slot may already be taken by another resident (see BOOKED_SLOTS).
export const TIME_SLOTS = [
  "06:30 AM",
  "07:30 AM",
  "08:30 AM",
  "05:00 PM",
  "06:00 PM",
  "07:00 PM",
];

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// The temple only accepts monthly bookings on a rolling 5-day window starting
// today, so the dates stay bookable (the backend rejects any booking_date in
// the past - see booking_date_must_be_future in schemas/temple.py).
export const getBookableDates = (from = new Date()) => {
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return {
      value: toISO(d),
      label: `${pad(d.getDate())} ${d.toLocaleDateString("en-IN", { month: "short" })} ${d.getFullYear()} · ${d.toLocaleDateString("en-IN", { weekday: "short" })}`,
    };
  });
};

// Slots already reserved, keyed by `${sevaId}|${date}`. Drives the disabled
// state in the slot picker so two residents cannot book the same slot. Keys
// are derived from the live rolling window (not literal dates) so the seeded
// "already booked" demo slots stay on real, bookable days.
const BOOKABLE_DATES = getBookableDates();
const BOOKED_SLOTS = {
  [`abhishekam|${BOOKABLE_DATES[0].value}`]: ["06:30 AM", "07:30 AM"],
  [`archana|${BOOKABLE_DATES[0].value}`]: ["06:00 PM"],
  [`sandhana-kaapu|${BOOKABLE_DATES[1].value}`]: ["05:00 PM", "06:00 PM"],
};

// Returns each time slot with an `available` flag for the chosen seva + date.
export const getAvailableSlots = (sevaId, date) => {
  const taken = BOOKED_SLOTS[`${sevaId}|${date}`] ?? [];
  return TIME_SLOTS.map((time) => ({ time, available: !taken.includes(time) }));
};
