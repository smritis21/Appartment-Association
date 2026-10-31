export const DONATION_STATUS = {
  RECEIPTED: "receipted", // amount received, receipt issued
  PENDING: "pending", // awaiting confirmation
};

// What a resident can donate towards. Used to populate the purpose dropdown.
// `value` must be one of the backend's DonationPurpose literals
// (schemas/temple.py) - `label` is the nice display text shown in the UI.
export const DONATION_PURPOSES = [
  { value: "annadanam", label: "Annadhanam (Free Meals)" },
  { value: "renovation", label: "Temple Maintenance" },
  { value: "festival", label: "Festival Fund" },
  { value: "other", label: "Deity Alankaram" },
  { value: "general", label: "General Donation" },
];

// Looks up the display label for a backend purpose literal (e.g. "annadanam"
// -> "Annadhanam (Free Meals)"). Falls back to the raw value if unrecognised.
export const purposeLabel = (value) =>
  DONATION_PURPOSES.find((p) => p.value === value)?.label ?? value;

// Suggested quick-pick amounts (INR) shown as chips on the donation form.
export const QUICK_AMOUNTS = [101, 251, 501, 1001, 2501];

export const mockDonations = [
  {
    id: "DON-2026-042",
    amount: 1001,
    purpose: "annadanam",
    devotee: "Ramesh Iyer",
    flat: "B-1204",
    status: DONATION_STATUS.RECEIPTED,
    receiptNo: "RCPT-2026-042",
    createdAt: "2026-07-05T11:20:00.000Z",
  },
];

let seq = 42;
export const nextDonationId = () =>
  `DON-2026-${String(++seq).padStart(3, "0")}`;
export const receiptNoFor = (donationId) => donationId.replace("DON", "RCPT");
