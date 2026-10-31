export const PASS_TYPE = {
  GUEST: "guest",
  DELIVERY: "delivery",
};

// Where a pass sits in its validity window, derived from the current time.
export const PASS_STATE = {
  UPCOMING: "upcoming",
  ACTIVE: "active",
  EXPIRED: "expired",
};

// Movement of the visitor through the gate.
export const ENTRY_STATE = {
  AWAITING: "awaiting",
  ON_PREMISE: "on_premise",
  EXITED: "exited",
  DENIED: "denied",
};

export const ENTRY_CHIP = {
  [ENTRY_STATE.AWAITING]: { label: "Awaiting", color: "default" },
  [ENTRY_STATE.ON_PREMISE]: { label: "On Premises", color: "success" },
  [ENTRY_STATE.EXITED]: { label: "Exited", color: "info" },
  [ENTRY_STATE.DENIED]: { label: "Denied", color: "error" },
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const from = (offset) => new Date(Date.now() + offset).toISOString();

// Seeded relative to "now" so the demo always has a mix of active, upcoming
// and expired passes regardless of when it is opened.
export const mockPasses = [
  {
    id: "GP-2026-2481",
    code: "JKR-4821",
    type: PASS_TYPE.GUEST,
    visitorName: "Nikhil Rao",
    purpose: "Guest Visit",
    phone: "9820011223",
    flat: "A-101",
    host: "Arjun Mehta",
    validFrom: from(-1 * HOUR),
    validTo: from(3 * HOUR),
    entry: ENTRY_STATE.ON_PREMISE,
    entryAt: from(-40 * 60 * 1000),
    exitAt: null,
    gate: "Main Gate",
  },
  {
    id: "GP-2026-2482",
    code: "JKR-7734",
    type: PASS_TYPE.DELIVERY,
    visitorName: "Flipkart - Sunil K.",
    purpose: "Delivery",
    phone: "9820011224",
    flat: "A-101",
    host: "Arjun Mehta",
    validFrom: from(-2 * HOUR),
    validTo: from(2 * HOUR),
    entry: ENTRY_STATE.AWAITING,
    entryAt: null,
    exitAt: null,
    gate: "Main Gate",
  },
  {
    id: "GP-2026-2483",
    code: "JKR-9052",
    type: PASS_TYPE.GUEST,
    visitorName: "Anita & Raj Sharma",
    purpose: "Relative",
    phone: "9820011225",
    flat: "A-101",
    host: "Arjun Mehta",
    validFrom: from(2 * DAY),
    validTo: from(2 * DAY + 6 * HOUR),
    entry: ENTRY_STATE.AWAITING,
    entryAt: null,
    exitAt: null,
    gate: "Main Gate",
  },
  {
    id: "GP-2026-2484",
    code: "JKR-3390",
    type: PASS_TYPE.GUEST,
    visitorName: "Karthik Nair",
    purpose: "Guest Visit",
    phone: "9820011226",
    flat: "A-101",
    host: "Arjun Mehta",
    validFrom: from(-2 * DAY),
    validTo: from(-2 * DAY + 5 * HOUR),
    entry: ENTRY_STATE.EXITED,
    entryAt: from(-2 * DAY + 30 * 60 * 1000),
    exitAt: from(-2 * DAY + 3 * HOUR),
    gate: "Main Gate",
  },
  {
    id: "GP-2026-2470",
    code: "JKR-1188",
    type: PASS_TYPE.GUEST,
    visitorName: "Deepa Menon",
    purpose: "Guest Visit",
    phone: "9820011230",
    flat: "B-204",
    host: "Priya Sharma",
    validFrom: from(-30 * 60 * 1000),
    validTo: from(4 * HOUR),
    entry: ENTRY_STATE.ON_PREMISE,
    entryAt: from(-20 * 60 * 1000),
    exitAt: null,
    gate: "East Gate",
  },
  {
    id: "GP-2026-2465",
    code: "JKR-6621",
    type: PASS_TYPE.DELIVERY,
    visitorName: "BigBasket - Ravi",
    purpose: "Delivery",
    phone: "9820011231",
    flat: "C-301",
    host: "Ramesh Iyer",
    validFrom: from(-3 * DAY),
    validTo: from(-3 * DAY + 4 * HOUR),
    entry: ENTRY_STATE.EXITED,
    entryAt: from(-3 * DAY + 20 * 60 * 1000),
    exitAt: from(-3 * DAY + 50 * 60 * 1000),
    gate: "Service Gate",
  },
];

export function computePassState(pass) {
  const now = Date.now();
  if (now < new Date(pass.validFrom).getTime()) return PASS_STATE.UPCOMING;
  if (now > new Date(pass.validTo).getTime()) return PASS_STATE.EXPIRED;
  return PASS_STATE.ACTIVE;
}

export function findPassByCode(passes, code) {
  const q = code.trim().toUpperCase();
  return passes.find((p) => p.code.toUpperCase() === q) ?? null;
}

export function getOnPremiseVisitors(passes) {
  return passes.filter((p) => p.entry === ENTRY_STATE.ON_PREMISE);
}

// Next sequential code, keeps issued passes looking realistic.
export function nextPassCode(passes) {
  const nums = passes
    .map((p) => parseInt(p.code.replace(/\D/g, ""), 10))
    .filter((n) => !Number.isNaN(n));
  const seed = (Math.max(1000, ...nums) + Math.floor(Math.random() * 90) + 11) % 10000;
  return `JKR-${String(seed).padStart(4, "0")}`;
}

