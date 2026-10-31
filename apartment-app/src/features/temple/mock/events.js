// Temple events published by the Secretary (temple administration owner).
// Residents view these and can sign up to volunteer.

// Offline/mock fallback data must stay perpetually "upcoming" so it never
// reads as a stale, already-past event - this pins the first seeded event to
// ~2.5 weeks from whenever the app runs, at 6:00 PM local time.
const upcomingMockDate = (daysFromNow) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
};

export const mockEvents = [
  {
    id: "EVT-2026-07",
    title: "Aadi Krittika Special Abhishekam",
    date: upcomingMockDate(18),
    location: "Community Temple, Tower Block",
    description:
      "Grand evening abhishekam followed by deepa aradhana and prasadam distribution for all residents.",
    volunteersNeeded: 8,
    volunteersJoined: 5,
    signedUp: false,
    publishedBy: "Secretary",
  },
  {
    id: "EVT-2026-08",
    title: "Varalakshmi Vratham",
    date: "2026-08-08T07:00:00.000Z",
    location: "Community Temple, Tower Block",
    description:
      "Morning vratham and collective pooja. Volunteers needed for kolam, seating and prasadam counter.",
    volunteersNeeded: 12,
    volunteersJoined: 12,
    signedUp: false,
    publishedBy: "Secretary",
  },
  {
    id: "EVT-2026-09",
    title: "Krishna Janmashtami Celebrations",
    date: "2026-09-04T17:30:00.000Z",
    location: "Central Lawn & Temple",
    description:
      "Bhajans, dahi-handi for children and midnight aarti. Sign up to help with decorations and crowd management.",
    volunteersNeeded: 15,
    volunteersJoined: 3,
    signedUp: true,
    publishedBy: "Secretary",
  },
];

// Slots are full when joined >= needed.
export const isEventFull = (e) => e.volunteersJoined >= e.volunteersNeeded;

// Publishes a new temple event to the shared list. Managed by the Secretary.
export const addEvent = ({ title, date, location, description, volunteersNeeded }) => {
  const event = {
    id: `EVT-NEW-${Date.now()}`,
    title: title.trim(),
    date: new Date(date).toISOString(),
    location: location.trim(),
    description: description?.trim() || "Newly published temple event.",
    volunteersNeeded: Number(volunteersNeeded) || 10,
    volunteersJoined: 0,
    signedUp: false,
    publishedBy: "Secretary",
  };
  mockEvents.push(event);
  return event;
};
