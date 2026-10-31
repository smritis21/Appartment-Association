import { getHelpById } from "./houseHelp";

// Star ratings (1–5) + optional comment left by a resident after a completed
// booking. The seeded `rating`/`ratingCount` on each worker represent their
// historical aggregate; a new rating is blended into that running average so the
// directory updates immediately (singleton, resets on refresh).
export const helpRatings = [
  {
    id: "RT-9001",
    helpId: "HH-01",
    bookingId: "HB-2026-021",
    stars: 5,
    comment: "Very thorough and punctual. Highly recommended.",
    by: "Arjun Mehta",
    flat: "A-101",
    createdAt: "2026-07-20T11:30:00.000Z",
  },
  {
    id: "RT-9002",
    helpId: "HH-05",
    bookingId: "HB-2026-023",
    stars: 5,
    comment: "Wonderful with the kids, very patient.",
    by: "Arjun Mehta",
    flat: "A-101",
    createdAt: "2026-07-19T16:15:00.000Z",
  },
];

let seq = 9002;
const nextId = () => `RT-${++seq}`;

// Booking ids that already carry a rating - used to hide the "Rate" action.
export const getRatedBookingIds = () => helpRatings.map((r) => r.bookingId);

// Detailed comment feed for one worker, newest first.
export const getRatingsForHelp = (helpId) =>
  helpRatings
    .filter((r) => r.helpId === helpId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

// Adds a rating and blends the new star value into the worker's running average
// (baseline = seeded rating × seeded count). Returns the record.
export const addRating = ({ helpId, bookingId, stars, comment, by, flat }) => {
  const record = {
    id: nextId(),
    helpId,
    bookingId,
    stars,
    comment: comment?.trim() ?? "",
    by,
    flat,
    createdAt: new Date().toISOString(),
  };
  helpRatings.push(record);

  const help = getHelpById(helpId);
  if (help) {
    const newCount = help.ratingCount + 1;
    const newAvg = (help.rating * help.ratingCount + stars) / newCount;
    help.rating = Math.round(newAvg * 10) / 10;
    help.ratingCount = newCount;
  }
  return record;
};

// Society-wide rating feed for the management register, newest first.
export const getAllRatings = () =>
  [...helpRatings]
    .map((r) => ({ ...r, help: getHelpById(r.helpId) }))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

