// Complaint & Feedback module mock data - FE-01, FE-02, FE-06, FE-07,
// FE-10, FE-13, FE-14, FE-16, FE-20. Prototype runs on static data only.

export const COMPLAINT_STATUS = {
  SUBMITTED: "submitted",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  RESOLVED: "resolved",
  CLOSED: "closed",
};

export const STATUS_LABELS = {
  [COMPLAINT_STATUS.SUBMITTED]: "Submitted",
  [COMPLAINT_STATUS.ASSIGNED]: "Assigned",
  [COMPLAINT_STATUS.IN_PROGRESS]: "In Progress",
  [COMPLAINT_STATUS.RESOLVED]: "Resolved",
  [COMPLAINT_STATUS.CLOSED]: "Closed",
};

// Stage order used by the tracking stepper (FE-02) and to validate
// forward-only transitions on the staff progress screen (FE-16).
export const STATUS_ORDER = [
  COMPLAINT_STATUS.SUBMITTED,
  COMPLAINT_STATUS.ASSIGNED,
  COMPLAINT_STATUS.IN_PROGRESS,
  COMPLAINT_STATUS.RESOLVED,
  COMPLAINT_STATUS.CLOSED,
];

// FE-13 - fixed category list; exactly one category per complaint.
// Offline fallback only: the submission screen fetches the canonical list from
// GET /complaints/categories, so this exists for when the API is unreachable
// and must mirror backend/app/schemas/complaint.py's COMPLAINT_CATEGORIES.
export const COMPLAINT_CATEGORIES = [
  "Plumbing",
  "Electrical",
  "Security",
  "Water Supply",
  "Lift Maintenance",
  // The catch-all, last: for a problem that fits none of the above.
  "Other",
];

// Maintenance staff available for assignment (FE-06) and workload views.
export const mockStaff = [
  { id: "STF-001", name: "Raju Kumar",    specialization: "Plumbing" },
  { id: "STF-002", name: "Mohan Das",     specialization: "Electrical" },
  { id: "STF-003", name: "Selvam R",      specialization: "Lift Maintenance" },
  { id: "STF-004", name: "Ganesh Babu",   specialization: "Water Supply" },
  { id: "STF-005", name: "Kumar Velu",    specialization: "General" },
];

// Each complaint keeps a full timeline for the stepper and audit trail.
// userId links to the logged-in mock user (auth mock) for "my complaints".
export const mockComplaints = [
  {
    id: "CMP-2026-001",
    userId: "u001",
    residentName: "Arjun Mehta",
    flat: "A-101",
    category: "Plumbing",
    description: "Kitchen sink pipe is leaking continuously and water is pooling under the cabinet.",
    location: "A Block - Flat 101 - Kitchen",
    image: null,
    status: COMPLAINT_STATUS.CLOSED,
    assignedTo: "STF-001",
    createdAt: "2026-06-02T09:15:00",
    timeline: [
      { status: COMPLAINT_STATUS.SUBMITTED,   at: "2026-06-02T09:15:00", by: "Arjun Mehta",  notes: "Complaint submitted" },
      { status: COMPLAINT_STATUS.ASSIGNED,    at: "2026-06-02T11:30:00", by: "Vikram Desai", notes: "Assigned to Raju Kumar" },
      { status: COMPLAINT_STATUS.IN_PROGRESS, at: "2026-06-03T10:00:00", by: "Raju Kumar",   notes: "Replacement pipe procured, work started" },
      { status: COMPLAINT_STATUS.RESOLVED,    at: "2026-06-03T16:45:00", by: "Raju Kumar",   notes: "Pipe replaced and joints sealed" },
      { status: COMPLAINT_STATUS.CLOSED,      at: "2026-06-05T09:00:00", by: "Vikram Desai", notes: "Resident confirmed fix, complaint closed" },
    ],
    feedback: { rating: 5, comment: "Quick and clean work. Thank you!", submittedAt: "2026-06-05T10:12:00" },
  },
  {
    id: "CMP-2026-002",
    userId: "u002",
    residentName: "Priya Sharma",
    flat: "B-204",
    category: "Electrical",
    description: "Corridor light outside the flat keeps flickering and goes off at night.",
    location: "B Block - 2nd Floor Corridor",
    image: null,
    status: COMPLAINT_STATUS.RESOLVED,
    assignedTo: "STF-002",
    createdAt: "2026-06-20T18:40:00",
    timeline: [
      { status: COMPLAINT_STATUS.SUBMITTED,   at: "2026-06-20T18:40:00", by: "Priya Sharma", notes: "Complaint submitted" },
      { status: COMPLAINT_STATUS.ASSIGNED,    at: "2026-06-21T09:05:00", by: "Vikram Desai", notes: "Assigned to Mohan Das" },
      { status: COMPLAINT_STATUS.IN_PROGRESS, at: "2026-06-21T14:20:00", by: "Mohan Das",    notes: "Faulty choke identified" },
      { status: COMPLAINT_STATUS.RESOLVED,    at: "2026-06-22T11:30:00", by: "Mohan Das",    notes: "Fixture replaced with LED unit" },
    ],
    feedback: null,
  },
  {
    id: "CMP-2026-003",
    userId: "u001",
    residentName: "Arjun Mehta",
    flat: "A-101",
    category: "Lift Maintenance",
    description: "Lift in A block is making a grinding noise between floors 2 and 3.",
    location: "A Block - Lift 1",
    image: null,
    status: COMPLAINT_STATUS.IN_PROGRESS,
    assignedTo: "STF-003",
    createdAt: "2026-07-05T08:20:00",
    timeline: [
      { status: COMPLAINT_STATUS.SUBMITTED,   at: "2026-07-05T08:20:00", by: "Arjun Mehta",  notes: "Complaint submitted" },
      { status: COMPLAINT_STATUS.ASSIGNED,    at: "2026-07-05T10:00:00", by: "Vikram Desai", notes: "Assigned to Selvam R" },
      { status: COMPLAINT_STATUS.IN_PROGRESS, at: "2026-07-06T09:30:00", by: "Selvam R",     notes: "AMC vendor called for inspection" },
    ],
    feedback: null,
  },
  {
    id: "CMP-2026-004",
    userId: "u002",
    residentName: "Priya Sharma",
    flat: "B-204",
    category: "Water Supply",
    description: "Low water pressure in bathroom taps during morning hours.",
    location: "B Block - Flat 204 - Bathroom",
    image: null,
    status: COMPLAINT_STATUS.ASSIGNED,
    assignedTo: "STF-004",
    createdAt: "2026-07-08T07:55:00",
    timeline: [
      { status: COMPLAINT_STATUS.SUBMITTED, at: "2026-07-08T07:55:00", by: "Priya Sharma", notes: "Complaint submitted" },
      { status: COMPLAINT_STATUS.ASSIGNED,  at: "2026-07-08T12:15:00", by: "Vikram Desai", notes: "Assigned to Ganesh Babu" },
    ],
    feedback: null,
  },
  {
    id: "CMP-2026-005",
    userId: "u001",
    residentName: "Arjun Mehta",
    flat: "A-101",
    category: "Security",
    description: "Main gate camera near visitor parking appears to be switched off.",
    location: "Main Gate - Visitor Parking",
    image: null,
    status: COMPLAINT_STATUS.SUBMITTED,
    assignedTo: null,
    createdAt: "2026-07-11T19:10:00",
    timeline: [
      { status: COMPLAINT_STATUS.SUBMITTED, at: "2026-07-11T19:10:00", by: "Arjun Mehta", notes: "Complaint submitted" },
    ],
    feedback: null,
  },
  {
    id: "CMP-2026-006",
    userId: "u002",
    residentName: "Priya Sharma",
    flat: "B-204",
    category: "Plumbing",
    description: "Bathroom drain is blocked and water backs up while showering.",
    location: "B Block - Flat 204 - Bathroom",
    image: null,
    status: COMPLAINT_STATUS.CLOSED,
    assignedTo: "STF-001",
    createdAt: "2026-05-14T08:05:00",
    timeline: [
      { status: COMPLAINT_STATUS.SUBMITTED,   at: "2026-05-14T08:05:00", by: "Priya Sharma", notes: "Complaint submitted" },
      { status: COMPLAINT_STATUS.ASSIGNED,    at: "2026-05-14T10:40:00", by: "Vikram Desai", notes: "Assigned to Raju Kumar" },
      { status: COMPLAINT_STATUS.IN_PROGRESS, at: "2026-05-15T09:00:00", by: "Raju Kumar",   notes: "Drain rodding in progress" },
      { status: COMPLAINT_STATUS.RESOLVED,    at: "2026-05-15T13:25:00", by: "Raju Kumar",   notes: "Blockage cleared, flow tested" },
      { status: COMPLAINT_STATUS.CLOSED,      at: "2026-05-17T09:30:00", by: "Sunita Nair",  notes: "Closed after resident confirmation" },
    ],
    feedback: { rating: 4, comment: "Fixed properly, took one extra day.", submittedAt: "2026-05-17T11:00:00" },
  },
  {
    id: "CMP-2026-007",
    userId: "u003",
    residentName: "Ramesh Iyer",
    flat: "C-301",
    category: "Electrical",
    description: "Frequent power tripping in C block common area during evenings.",
    location: "C Block - Common Area",
    image: null,
    status: COMPLAINT_STATUS.IN_PROGRESS,
    assignedTo: "STF-002",
    createdAt: "2026-07-01T20:30:00",
    timeline: [
      { status: COMPLAINT_STATUS.SUBMITTED,   at: "2026-07-01T20:30:00", by: "Ramesh Iyer",  notes: "Complaint submitted" },
      { status: COMPLAINT_STATUS.ASSIGNED,    at: "2026-07-02T09:10:00", by: "Vikram Desai", notes: "Assigned to Mohan Das" },
      { status: COMPLAINT_STATUS.IN_PROGRESS, at: "2026-07-03T15:00:00", by: "Mohan Das",    notes: "Load testing MCB panel" },
    ],
    feedback: null,
  },
  {
    id: "CMP-2026-008",
    userId: "u004",
    residentName: "Sunita Nair",
    flat: "D-402",
    category: "Water Supply",
    description: "Overhead tank overflow pipe is discharging water continuously.",
    location: "D Block - Terrace",
    image: null,
    status: COMPLAINT_STATUS.SUBMITTED,
    assignedTo: null,
    createdAt: "2026-07-12T06:45:00",
    timeline: [
      { status: COMPLAINT_STATUS.SUBMITTED, at: "2026-07-12T06:45:00", by: "Sunita Nair", notes: "Complaint submitted" },
    ],
    feedback: null,
  },
  {
    id: "CMP-2026-009",
    userId: "u001",
    residentName: "Arjun Mehta",
    flat: "A-101",
    category: "Water Supply",
    description: "Borewell water smells unusual; possible tank contamination.",
    location: "A Block - Sump",
    image: null,
    status: COMPLAINT_STATUS.RESOLVED,
    assignedTo: "STF-004",
    createdAt: "2026-06-25T07:30:00",
    timeline: [
      { status: COMPLAINT_STATUS.SUBMITTED,   at: "2026-06-25T07:30:00", by: "Arjun Mehta",  notes: "Complaint submitted" },
      { status: COMPLAINT_STATUS.ASSIGNED,    at: "2026-06-25T09:45:00", by: "Sunita Nair",  notes: "Assigned to Ganesh Babu" },
      { status: COMPLAINT_STATUS.IN_PROGRESS, at: "2026-06-26T08:00:00", by: "Ganesh Babu",  notes: "Tank drained for cleaning" },
      { status: COMPLAINT_STATUS.RESOLVED,    at: "2026-06-27T17:20:00", by: "Ganesh Babu",  notes: "Tank cleaned and chlorinated" },
    ],
    feedback: null,
  },
  {
    id: "CMP-2026-010",
    userId: "u003",
    residentName: "Ramesh Iyer",
    flat: "C-301",
    category: "Lift Maintenance",
    description: "Lift display panel in C block shows wrong floor numbers.",
    location: "C Block - Lift 2",
    image: null,
    status: COMPLAINT_STATUS.CLOSED,
    assignedTo: "STF-003",
    createdAt: "2026-04-18T11:00:00",
    timeline: [
      { status: COMPLAINT_STATUS.SUBMITTED,   at: "2026-04-18T11:00:00", by: "Ramesh Iyer",  notes: "Complaint submitted" },
      { status: COMPLAINT_STATUS.ASSIGNED,    at: "2026-04-18T14:30:00", by: "Vikram Desai", notes: "Assigned to Selvam R" },
      { status: COMPLAINT_STATUS.IN_PROGRESS, at: "2026-04-20T10:15:00", by: "Selvam R",     notes: "Controller board sent for repair" },
      { status: COMPLAINT_STATUS.RESOLVED,    at: "2026-04-24T16:00:00", by: "Selvam R",     notes: "Board reinstalled and calibrated" },
      { status: COMPLAINT_STATUS.CLOSED,      at: "2026-04-26T09:20:00", by: "Vikram Desai", notes: "Verified with residents, closed" },
    ],
    feedback: { rating: 3, comment: "Resolved but took nearly a week.", submittedAt: "2026-04-26T18:40:00" },
  },
  {
    id: "CMP-2026-011",
    userId: "u002",
    residentName: "Priya Sharma",
    flat: "B-204",
    category: "Security",
    description: "Unknown two-wheelers are being parked inside B block stilt area.",
    location: "B Block - Stilt Parking",
    image: null,
    status: COMPLAINT_STATUS.ASSIGNED,
    assignedTo: "STF-005",
    createdAt: "2026-07-10T21:05:00",
    timeline: [
      { status: COMPLAINT_STATUS.SUBMITTED, at: "2026-07-10T21:05:00", by: "Priya Sharma", notes: "Complaint submitted" },
      { status: COMPLAINT_STATUS.ASSIGNED,  at: "2026-07-11T08:50:00", by: "Sunita Nair",  notes: "Assigned to Kumar Velu" },
    ],
    feedback: null,
  },
  {
    id: "CMP-2026-012",
    userId: "u004",
    residentName: "Sunita Nair",
    flat: "D-402",
    category: "Plumbing",
    description: "Rainwater harvesting filter chamber near D block is clogged.",
    location: "D Block - RWH Pit",
    image: null,
    status: COMPLAINT_STATUS.RESOLVED,
    assignedTo: "STF-001",
    createdAt: "2026-07-03T09:40:00",
    timeline: [
      { status: COMPLAINT_STATUS.SUBMITTED,   at: "2026-07-03T09:40:00", by: "Sunita Nair",  notes: "Complaint submitted" },
      { status: COMPLAINT_STATUS.ASSIGNED,    at: "2026-07-03T11:20:00", by: "Vikram Desai", notes: "Assigned to Raju Kumar" },
      { status: COMPLAINT_STATUS.IN_PROGRESS, at: "2026-07-04T08:30:00", by: "Raju Kumar",   notes: "Filter media being replaced" },
      { status: COMPLAINT_STATUS.RESOLVED,    at: "2026-07-04T15:10:00", by: "Raju Kumar",   notes: "Chamber cleaned, filter replaced" },
    ],
    feedback: null,
  },
  {
    id: "CMP-2026-013",
    userId: "u004",
    residentName: "Sunita Nair",
    flat: "D-402",
    category: "Plumbing",
    description: "Kitchen tap handle is loose and spins freely without shutting off the water.",
    location: "D Block - Flat 402 - Kitchen",
    image: null,
    status: COMPLAINT_STATUS.ASSIGNED,
    assignedTo: "STF-001",
    createdAt: "2026-07-12T10:20:00",
    timeline: [
      { status: COMPLAINT_STATUS.SUBMITTED, at: "2026-07-12T10:20:00", by: "Sunita Nair",  notes: "Complaint submitted" },
      { status: COMPLAINT_STATUS.ASSIGNED,  at: "2026-07-12T13:05:00", by: "Vikram Desai", notes: "Assigned to Raju Kumar" },
    ],
    feedback: null,
  },
];

export function getStaffById(id) {
  return mockStaff.find((s) => s.id === id) ?? null;
}

// Monthly volume used for trend charts (FE-07, FE-14, FE-36).
export function getMonthlyTrend(complaints) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  return months.map((label, idx) => ({
    label,
    value: complaints.filter((c) => new Date(c.createdAt).getMonth() === idx).length,
  }));
}

// Average resolution time in days for resolved/closed complaints (FE-14).
// Progress updates are forward-only, not strictly sequential - a complaint
// can be closed without ever passing through Resolved (e.g. duplicate or
// invalid complaints) - so fall back to the Closed entry when there's no
// Resolved one, rather than silently excluding it from the numerator while
// still counting it in the denominator.
export function getAvgResolutionDays(complaints) {
  const resolved = complaints.filter((c) =>
    [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED].includes(c.status)
  );
  if (resolved.length === 0) return 0;
  const totalDays = resolved.reduce((sum, c) => {
    const entry =
      c.timeline.find((t) => t.status === COMPLAINT_STATUS.RESOLVED) ??
      c.timeline.find((t) => t.status === COMPLAINT_STATUS.CLOSED);
    if (!entry) return sum;
    return sum + (new Date(entry.at) - new Date(c.createdAt)) / (1000 * 60 * 60 * 24);
  }, 0);
  return totalDays / resolved.length;
}

