// Static knowledge the assistant answers from. Kept self-contained so the
// feature runs for anyone who clones the repo - no API key, no backend.
// The resident directory is read from the existing auth mock.
import { mockUsers } from "../../auth/mock/users";

// Society service desks and staff - these numbers are public to all residents.
export const CONTACTS = [
  { key: "security", label: "Security Gate", name: "Suresh Patil", phone: "9820011001", role: "Security Guard" },
  { key: "manager", label: "Apartment Manager", name: "Vikram Desai", phone: "9820011002", role: "Manager" },
  { key: "secretary", label: "Association Secretary", name: "Sunita Nair", phone: "9820011003", role: "Secretary" },
  { key: "plumber", label: "Plumber (on-call)", name: "Sanjay Works", phone: "9820011010", role: "Service" },
  { key: "electrician", label: "Electrician (on-call)", name: "Ravi Electricals", phone: "9820011011", role: "Service" },
  { key: "housekeeping", label: "Housekeeping Desk", name: "Facility Team", phone: "9820011012", role: "Service" },
];

export const FACILITIES = [
  { key: "gym", label: "Gym", hours: "5:00 AM – 10:00 PM", note: "Book a 1-hour slot under Community → Facility Booking." },
  { key: "pool", label: "Swimming Pool", hours: "6:00 AM – 9:00 AM, 4:00 PM – 8:00 PM", note: "Children under 12 must be accompanied by an adult." },
  { key: "court", label: "Sports Court", hours: "6:00 AM – 10:00 PM", note: "Slots are 1 hour; cancel from ‘My Bookings’ if plans change." },
  { key: "clubhouse", label: "Clubhouse", hours: "9:00 AM – 9:00 PM", note: "Party-hall bookings need Secretary approval." },
];

export const RULES = [
  { key: "quiet", topic: "Quiet hours", text: "Quiet hours are 10:00 PM to 7:00 AM. Please keep noise to a minimum during this time." },
  { key: "pets", topic: "Pets", text: "Pets are allowed but must be leashed in common areas, and owners must clean up after them." },
  { key: "parking", topic: "Parking", text: "Each flat gets one allotted parking slot. Visitor parking is near the main gate on a first-come basis." },
  { key: "move", topic: "Move-in / move-out", text: "Move-in/out must be scheduled with the Secretary at least 24 hours in advance and is allowed between 8:00 AM and 6:00 PM." },
];

export const FAQS = [
  { key: "pay", q: "How do I pay maintenance?", text: "Go to Payments → Pay Bill, choose your outstanding bill, and pay via card or UPI. A receipt is generated instantly." },
  { key: "complaint", q: "How do I raise a complaint?", text: "Open the Complaints section, choose a category, add a description and photo, and submit - you’ll get a tracking ID." },
  { key: "visitor", q: "How do I let a visitor in?", text: "Go to Visitor Passes → Issue Pass to create a guest pass with a QR code. The guard verifies it at the Gate Desk." },
  { key: "book", q: "How do I book a facility?", text: "Community → Facility Booking, pick the facility and an open slot, and confirm. Booked slots show under ‘My Bookings’." },
];

// A small analytics snapshot the assistant can quote. In a real build these
// would be derived live from each module; here they are representative values.
export const SNAPSHOT = {
  duesByFlat: {
    "A-101": { amount: 4200, dueDate: "2026-07-31" },
    "B-204": { amount: 0, dueDate: null },
    "C-301": { amount: 8600, dueDate: "2026-07-31" },
  },
};

export function directory() {
  return mockUsers.map(({ name, flat, phone, role }) => ({ name, flat, phone, role }));
}

