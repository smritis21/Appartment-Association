// FE-36 - cross-module analytics mock data. Complaint figures come live
// from ComplaintContext; the other domains are static prototype series.

export const MONTHLY_PAYMENTS = [
  { label: "Jan", value: 512000 },
  { label: "Feb", value: 498000 },
  { label: "Mar", value: 534000 },
  { label: "Apr", value: 521000 },
  { label: "May", value: 545000 },
  { label: "Jun", value: 538000 },
  { label: "Jul", value: 291000 }, // month in progress
];

export const MONTHLY_VISITORS = [
  { label: "Jan", value: 342 },
  { label: "Feb", value: 315 },
  { label: "Mar", value: 388 },
  { label: "Apr", value: 361 },
  { label: "May", value: 402 },
  { label: "Jun", value: 379 },
  { label: "Jul", value: 168 },
];

export const FACILITY_USAGE = [
  { label: "Gym", value: 186 },
  { label: "Pool", value: 142 },
  { label: "Court", value: 97 },
  { label: "Hall", value: 24 },
  { label: "Park", value: 210 },
];

export const MAINTENANCE_SUMMARY = {
  scheduled: 14,
  completed: 11,
  overdue: 1,
  staffOnDuty: 5,
};

export const RANGE_OPTIONS = [
  { value: 3, label: "Last 3 Months" },
  { value: 6, label: "Last 6 Months" },
  { value: 7, label: "Year to Date" },
];

// Slice a monthly series to the last `n` months.
export function sliceRange(series, n) {
  return series.slice(-n);
}

