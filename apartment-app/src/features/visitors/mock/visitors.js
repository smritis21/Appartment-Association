export const VISITOR_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  LEFT_AT_GATE: "left_at_gate",
};

// Guard on duty and drop-off point for each gate, used when a delivery is
// left at the gate for later collection.
export const GATE_DESKS = {
  "Main Gate": { guard: "Suresh Patil", desk: "Security Desk · Main Gate" },
  "East Gate": { guard: "Ravi Teja", desk: "Security Cabin · East Gate" },
  "Service Gate": { guard: "Mahesh Rao", desk: "Parcel Shelf · Service Gate" },
};

export const VISITOR_PURPOSES = [
  "Guest Visit",
  "Delivery",
  "Cab / Taxi",
  "Home Service",
  "Relative",
];

// Requests raised at the gate for a resident's flat, awaiting their decision.
export const mockVisitorRequests = [
  {
    id: "VIS-2026-001",
    name: "Rahul Khanna",
    purpose: "Guest Visit",
    phone: "9811122233",
    flat: "A-101",
    gate: "Main Gate",
    vehicle: null,
    requestedAt: "2026-07-12T10:25:00",
    status: VISITOR_STATUS.PENDING,
  },
  {
    id: "VIS-2026-002",
    name: "Zomato - Imran S.",
    purpose: "Delivery",
    phone: "9811122244",
    flat: "A-101",
    gate: "Main Gate",
    vehicle: "Bike · DL 3S AB 1290",
    requestedAt: "2026-07-12T10:40:00",
    status: VISITOR_STATUS.PENDING,
  },
  {
    id: "VIS-2026-003",
    name: "Meena Kulkarni",
    purpose: "Relative",
    phone: "9811122255",
    flat: "A-101",
    gate: "Main Gate",
    vehicle: "Car · MH 12 KJ 4471",
    requestedAt: "2026-07-12T09:55:00",
    status: VISITOR_STATUS.PENDING,
  },
  {
    id: "VIS-2026-004",
    name: "Ola - Devendra P.",
    purpose: "Cab / Taxi",
    phone: "9811122266",
    flat: "A-101",
    gate: "East Gate",
    vehicle: "Car · DL 1C TY 8820",
    requestedAt: "2026-07-12T08:30:00",
    status: VISITOR_STATUS.PENDING,
  },
  {
    id: "VIS-2026-005",
    name: "Sanjay Plumbing Works",
    purpose: "Home Service",
    phone: "9811122277",
    flat: "A-101",
    gate: "Service Gate",
    vehicle: null,
    requestedAt: "2026-07-11T16:10:00",
    status: VISITOR_STATUS.APPROVED,
    decidedAt: "2026-07-11T16:12:00",
  },
  {
    id: "VIS-2026-006",
    name: "Unknown - No ID",
    purpose: "Guest Visit",
    phone: "9811122288",
    flat: "A-101",
    gate: "Main Gate",
    vehicle: null,
    requestedAt: "2026-07-11T21:45:00",
    status: VISITOR_STATUS.REJECTED,
    decidedAt: "2026-07-11T21:47:00",
  },
  {
    id: "VIS-2026-007",
    name: "Amazon - Prakash R.",
    purpose: "Delivery",
    phone: "9811122299",
    flat: "A-101",
    gate: "Main Gate",
    vehicle: "Van · DL 5S PQ 3344",
    requestedAt: "2026-07-11T14:05:00",
    status: VISITOR_STATUS.LEFT_AT_GATE,
    decidedAt: "2026-07-11T14:09:00",
    collectedBy: "Suresh Patil",
    pickupLocation: "Security Desk · Main Gate",
  },
];

export function getStatusCounts(requests) {
  return requests.reduce(
    (acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    },
    {
      [VISITOR_STATUS.PENDING]: 0,
      [VISITOR_STATUS.APPROVED]: 0,
      [VISITOR_STATUS.REJECTED]: 0,
      [VISITOR_STATUS.LEFT_AT_GATE]: 0,
    }
  );
}

