// Snapshot numbers for the landing dashboard. Representative values - each
// module owns its real data; this keeps the overview self-contained.
export const OVERVIEW = {
  duesByFlat: {
    "A-101": { amount: 4200, dueDate: "2026-07-31" },
    "B-204": { amount: 0, dueDate: null },
    "C-301": { amount: 8600, dueDate: "2026-07-31" },
  },
  openComplaints: 2,
  upcomingBookings: 1,
};

export const RECENT_ANNOUNCEMENTS = [
  { id: "ann-21", title: "Water supply maintenance on Saturday", date: "2026-07-22", category: "Maintenance" },
  { id: "ann-20", title: "Varalakshmi pooja - volunteers needed", date: "2026-07-21", category: "Temple" },
  { id: "ann-19", title: "AGM minutes uploaded to Documents", date: "2026-07-19", category: "General" },
];

export const UPCOMING_EVENTS = [
  { id: "evt-08", title: "Weekend badminton tournament", date: "2026-07-26", venue: "Sports Court" },
  { id: "evt-09", title: "Senior citizens' health camp", date: "2026-07-28", venue: "Clubhouse" },
];

