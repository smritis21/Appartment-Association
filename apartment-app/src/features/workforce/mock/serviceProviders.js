import PlumbingOutlinedIcon from "@mui/icons-material/PlumbingOutlined";
import ElectricalServicesOutlinedIcon from "@mui/icons-material/ElectricalServicesOutlined";
import CarpenterOutlinedIcon from "@mui/icons-material/CarpenterOutlined";
import FormatPaintOutlinedIcon from "@mui/icons-material/FormatPaintOutlined";
import PestControlOutlinedIcon from "@mui/icons-material/PestControlOutlined";
import AcUnitOutlinedIcon from "@mui/icons-material/AcUnitOutlined";

// Trades a resident can raise a service request against.
export const TRADES = [
  { id: "plumber", label: "Plumber", icon: PlumbingOutlinedIcon },
  { id: "electrician", label: "Electrician", icon: ElectricalServicesOutlinedIcon },
  { id: "carpenter", label: "Carpenter", icon: CarpenterOutlinedIcon },
  { id: "painter", label: "Painter", icon: FormatPaintOutlinedIcon },
  { id: "pest", label: "Pest Control", icon: PestControlOutlinedIcon },
  { id: "ac", label: "AC Technician", icon: AcUnitOutlinedIcon },
];

export const getTrade = (id) => TRADES.find((t) => t.id === id) ?? null;
export const tradeLabel = (id) => getTrade(id)?.label ?? id;

export const PROVIDER_AVAILABILITY = {
  AVAILABLE: "available",
  BUSY: "busy",
};

export const PROVIDER_AVAILABILITY_META = {
  [PROVIDER_AVAILABILITY.AVAILABLE]: { label: "Available today", color: "success" },
  [PROVIDER_AVAILABILITY.BUSY]: { label: "Next-day only", color: "warning" },
};

// Empanelled service providers. `agency` groups independent techs under a vendor.
export const SERVICE_PROVIDERS = [
  {
    id: "SP-01",
    name: "Suresh Plumbing Works",
    trade: "plumber",
    agency: "Suresh & Sons",
    availability: PROVIDER_AVAILABILITY.AVAILABLE,
    rating: 4.5,
    jobsDone: 132,
    phone: "9800022031",
    verified: true,
  },
  {
    id: "SP-02",
    name: "Volt Electricals",
    trade: "electrician",
    agency: "Volt Services Pvt Ltd",
    availability: PROVIDER_AVAILABILITY.AVAILABLE,
    rating: 4.7,
    jobsDone: 210,
    phone: "9800022032",
    verified: true,
  },
  {
    id: "SP-03",
    name: "Anil Carpentry",
    trade: "carpenter",
    agency: "Independent",
    availability: PROVIDER_AVAILABILITY.BUSY,
    rating: 4.2,
    jobsDone: 74,
    phone: "9800022033",
    verified: true,
  },
  {
    id: "SP-04",
    name: "FreshCoat Painters",
    trade: "painter",
    agency: "FreshCoat",
    availability: PROVIDER_AVAILABILITY.BUSY,
    rating: 4.4,
    jobsDone: 58,
    phone: "9800022034",
    verified: false,
  },
  {
    id: "SP-05",
    name: "SafeHome Pest Control",
    trade: "pest",
    agency: "SafeHome",
    availability: PROVIDER_AVAILABILITY.AVAILABLE,
    rating: 4.6,
    jobsDone: 96,
    phone: "9800022035",
    verified: true,
  },
  {
    id: "SP-06",
    name: "CoolAir Technicians",
    trade: "ac",
    agency: "CoolAir Services",
    availability: PROVIDER_AVAILABILITY.AVAILABLE,
    rating: 4.3,
    jobsDone: 141,
    phone: "9800022036",
    verified: true,
  },
];

export const getProviderById = (id) => SERVICE_PROVIDERS.find((p) => p.id === id) ?? null;
export const getProvidersForTrade = (tradeId) =>
  SERVICE_PROVIDERS.filter((p) => p.trade === tradeId);

// Job lifecycle:
//   open (unassigned) → assigned → in_progress → completed  (or → cancelled)
// Management assigns an open job to a provider; the resident tracks it and sees
// their service history.
export const JOB_STATUS = {
  OPEN: "open",
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

export const JOB_STATUS_META = {
  [JOB_STATUS.OPEN]: { label: "Open", color: "info" },
  [JOB_STATUS.ASSIGNED]: { label: "Assigned", color: "secondary" },
  [JOB_STATUS.IN_PROGRESS]: { label: "In progress", color: "warning" },
  [JOB_STATUS.COMPLETED]: { label: "Completed", color: "success" },
  [JOB_STATUS.CANCELLED]: { label: "Cancelled", color: "default" },
};

// The states a job passes through in order, used to progress it forward.
export const JOB_FLOW = [JOB_STATUS.OPEN, JOB_STATUS.ASSIGNED, JOB_STATUS.IN_PROGRESS, JOB_STATUS.COMPLETED];

// Singleton register of service jobs across the society.
export const serviceJobs = [
  {
    id: "SR-2026-041",
    trade: "plumber",
    description: "Kitchen sink leaking at the trap, water pooling under cabinet.",
    priority: "high",
    raisedBy: "Priya Sharma",
    flat: "B-204",
    role: "tenant",
    providerId: "SP-01",
    status: JOB_STATUS.IN_PROGRESS,
    createdAt: "2026-07-20T09:00:00.000Z",
    history: [
      { at: "2026-07-20T09:00:00.000Z", text: "Job raised by resident" },
      { at: "2026-07-20T10:30:00.000Z", text: "Assigned to Suresh Plumbing Works" },
      { at: "2026-07-21T08:15:00.000Z", text: "Work started on site" },
    ],
  },
  {
    id: "SR-2026-042",
    trade: "electrician",
    description: "Living-room MCB trips whenever the geyser is switched on.",
    priority: "medium",
    raisedBy: "Arjun Mehta",
    flat: "A-101",
    role: "owner",
    providerId: null,
    status: JOB_STATUS.OPEN,
    createdAt: "2026-07-21T18:40:00.000Z",
    history: [{ at: "2026-07-21T18:40:00.000Z", text: "Job raised by resident" }],
  },
  {
    id: "SR-2026-040",
    trade: "carpenter",
    description: "Bedroom wardrobe hinge broken, door won't close.",
    priority: "low",
    raisedBy: "Arjun Mehta",
    flat: "A-101",
    role: "owner",
    providerId: "SP-03",
    status: JOB_STATUS.COMPLETED,
    createdAt: "2026-07-14T12:00:00.000Z",
    history: [
      { at: "2026-07-14T12:00:00.000Z", text: "Job raised by resident" },
      { at: "2026-07-14T14:20:00.000Z", text: "Assigned to Anil Carpentry" },
      { at: "2026-07-15T09:00:00.000Z", text: "Work started on site" },
      { at: "2026-07-15T11:30:00.000Z", text: "Job completed" },
    ],
  },
];

export const PRIORITIES = [
  { id: "low", label: "Low" },
  { id: "medium", label: "Medium" },
  { id: "high", label: "High" },
];

let seq = 42;
export const nextJobId = () => `SR-2026-${String(++seq).padStart(3, "0")}`;

const stamp = (job, text) => job.history.push({ at: new Date().toISOString(), text });

// Raises a new open (unassigned) job and returns the record.
export const addJob = (job) => {
  const record = {
    id: nextJobId(),
    providerId: null,
    status: JOB_STATUS.OPEN,
    createdAt: new Date().toISOString(),
    history: [{ at: new Date().toISOString(), text: "Job raised by resident" }],
    ...job,
  };
  serviceJobs.push(record);
  return record;
};

// Management assigns an open job to a provider.
export const assignJob = (jobId, providerId) => {
  const job = serviceJobs.find((j) => j.id === jobId);
  const provider = getProviderById(providerId);
  if (job && provider && job.status === JOB_STATUS.OPEN) {
    job.providerId = providerId;
    job.status = JOB_STATUS.ASSIGNED;
    stamp(job, `Assigned to ${provider.name}`);
  }
  return job;
};

// Advances a job one step along JOB_FLOW (assigned → in_progress → completed).
export const advanceJob = (jobId) => {
  const job = serviceJobs.find((j) => j.id === jobId);
  if (!job) return job;
  const idx = JOB_FLOW.indexOf(job.status);
  if (idx >= 0 && idx < JOB_FLOW.length - 1) {
    job.status = JOB_FLOW[idx + 1];
    const text =
      job.status === JOB_STATUS.IN_PROGRESS ? "Work started on site" : "Job completed";
    stamp(job, text);
  }
  return job;
};

export const cancelJob = (jobId) => {
  const job = serviceJobs.find((j) => j.id === jobId);
  if (job && job.status !== JOB_STATUS.COMPLETED) {
    job.status = JOB_STATUS.CANCELLED;
    stamp(job, "Job cancelled");
  }
  return job;
};

export const getJobsForUser = (user) =>
  serviceJobs
    .filter((j) => (user?.flat ? j.flat === user.flat : j.raisedBy === user?.name))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

// Completed jobs only - the resident's / society's service history.
export const getServiceHistory = () =>
  serviceJobs
    .filter((j) => j.status === JOB_STATUS.COMPLETED)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

export const withProvider = (job) => ({ ...job, provider: getProviderById(job.providerId) });

