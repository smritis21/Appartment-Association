import { ROLES } from "../../../constants/roles";

export const APPLICATION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const WINGS = ["A", "B", "C", "D", "E", "F", "G", "H"];

export const mockApplications = [
  // 15 Pending
  {
    id: "APP-2026-001", name: "Karan Malhotra", firstName: "Karan", lastName: "Malhotra",
    email: "karan.m@email.com", phone: "9812345601", flat: "101", wing: "A",
    role: ROLES.OWNER, occupation: "Software Engineer",
    submittedAt: "2026-05-01", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "sale_deed", "photo"],
    remarks: "",
  },
  {
    id: "APP-2026-002", name: "Divya Krishnan", firstName: "Divya", lastName: "Krishnan",
    email: "divya.k@email.com", phone: "9812345602", flat: "204", wing: "B",
    role: ROLES.TENANT, occupation: "Doctor", ownerName: "Suresh Patel",
    leaseStart: "2026-06-01", leaseEnd: "2027-05-31",
    submittedAt: "2026-05-02", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "rental_agreement", "photo"],
    remarks: "",
  },
  {
    id: "APP-2026-003", name: "Amit Joshi", firstName: "Amit", lastName: "Joshi",
    email: "amit.j@email.com", phone: "9812345603", flat: "305", wing: "C",
    role: ROLES.OWNER, occupation: "Business Owner",
    submittedAt: "2026-05-03", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "sale_deed", "pan", "photo"],
    remarks: "",
  },
  {
    id: "APP-2026-004", name: "Sneha Reddy", firstName: "Sneha", lastName: "Reddy",
    email: "sneha.r@email.com", phone: "9812345604", flat: "412", wing: "D",
    role: ROLES.TENANT, occupation: "Teacher", ownerName: "Ramesh Iyer",
    leaseStart: "2026-05-15", leaseEnd: "2027-05-14",
    submittedAt: "2026-05-04", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "rental_agreement"],
    remarks: "",
  },
  {
    id: "APP-2026-005", name: "Rohit Verma", firstName: "Rohit", lastName: "Verma",
    email: "rohit.v@email.com", phone: "9812345605", flat: "502", wing: "E",
    role: ROLES.OWNER, occupation: "Chartered Accountant",
    submittedAt: "2026-05-05", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "sale_deed"],
    remarks: "",
  },
  {
    id: "APP-2026-006", name: "Pooja Nambiar", firstName: "Pooja", lastName: "Nambiar",
    email: "pooja.n@email.com", phone: "9812345606", flat: "601", wing: "F",
    role: ROLES.TENANT, occupation: "Architect", ownerName: "Vikram Desai",
    leaseStart: "2026-06-01", leaseEnd: "2027-05-31",
    submittedAt: "2026-05-06", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "rental_agreement", "pan"],
    remarks: "",
  },
  {
    id: "APP-2026-007", name: "Nikhil Sharma", firstName: "Nikhil", lastName: "Sharma",
    email: "nikhil.s@email.com", phone: "9812345607", flat: "703", wing: "G",
    role: ROLES.OWNER, occupation: "Banker",
    submittedAt: "2026-05-07", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "sale_deed", "photo"],
    remarks: "",
  },
  {
    id: "APP-2026-008", name: "Ananya Pillai", firstName: "Ananya", lastName: "Pillai",
    email: "ananya.p@email.com", phone: "9812345608", flat: "801", wing: "H",
    role: ROLES.TENANT, occupation: "Nurse", ownerName: "Sunita Nair",
    leaseStart: "2026-05-20", leaseEnd: "2027-05-19",
    submittedAt: "2026-05-08", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "rental_agreement"],
    remarks: "",
  },
  {
    id: "APP-2026-009", name: "Sanjay Gupta", firstName: "Sanjay", lastName: "Gupta",
    email: "sanjay.g@email.com", phone: "9812345609", flat: "102", wing: "A",
    role: ROLES.OWNER, occupation: "Entrepreneur",
    submittedAt: "2026-05-09", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "sale_deed", "pan"],
    remarks: "",
  },
  {
    id: "APP-2026-010", name: "Meera Iyer", firstName: "Meera", lastName: "Iyer",
    email: "meera.i@email.com", phone: "9812345610", flat: "205", wing: "B",
    role: ROLES.TENANT, occupation: "Journalist", ownerName: "Arjun Mehta",
    leaseStart: "2026-06-15", leaseEnd: "2027-06-14",
    submittedAt: "2026-05-10", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "rental_agreement", "photo"],
    remarks: "",
  },
  {
    id: "APP-2026-011", name: "Vivek Tiwari", firstName: "Vivek", lastName: "Tiwari",
    email: "vivek.t@email.com", phone: "9812345611", flat: "306", wing: "C",
    role: ROLES.OWNER, occupation: "Professor",
    submittedAt: "2026-05-11", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "sale_deed"],
    remarks: "",
  },
  {
    id: "APP-2026-012", name: "Lakshmi Menon", firstName: "Lakshmi", lastName: "Menon",
    email: "lakshmi.m@email.com", phone: "9812345612", flat: "413", wing: "D",
    role: ROLES.TENANT, occupation: "Pharmacist", ownerName: "Priya Sharma",
    leaseStart: "2026-07-01", leaseEnd: "2027-06-30",
    submittedAt: "2026-05-12", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "rental_agreement"],
    remarks: "",
  },
  {
    id: "APP-2026-013", name: "Deepak Nair", firstName: "Deepak", lastName: "Nair",
    email: "deepak.n@email.com", phone: "9812345613", flat: "503", wing: "E",
    role: ROLES.OWNER, occupation: "Lawyer",
    submittedAt: "2026-05-13", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "sale_deed", "pan", "photo"],
    remarks: "",
  },
  {
    id: "APP-2026-014", name: "Preethi Subramaniam", firstName: "Preethi", lastName: "Subramaniam",
    email: "preethi.s@email.com", phone: "9812345614", flat: "602", wing: "F",
    role: ROLES.TENANT, occupation: "Designer", ownerName: "Ramesh Iyer",
    leaseStart: "2026-06-01", leaseEnd: "2027-05-31",
    submittedAt: "2026-05-14", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "rental_agreement", "photo"],
    remarks: "",
  },
  {
    id: "APP-2026-015", name: "Harish Bhat", firstName: "Harish", lastName: "Bhat",
    email: "harish.b@email.com", phone: "9812345615", flat: "704", wing: "G",
    role: ROLES.OWNER, occupation: "Consultant",
    submittedAt: "2026-05-15", status: APPLICATION_STATUS.PENDING,
    documents: ["aadhaar", "sale_deed"],
    remarks: "",
  },
  // 5 Approved
  {
    id: "APP-2026-016", name: "Arjun Mehta", firstName: "Arjun", lastName: "Mehta",
    email: "owner@jkr.com", phone: "9876543210", flat: "101", wing: "A",
    role: ROLES.OWNER, occupation: "Software Engineer",
    submittedAt: "2026-04-01", status: APPLICATION_STATUS.APPROVED,
    documents: ["aadhaar", "sale_deed", "pan", "photo"],
    remarks: "All documents verified.",
  },
  {
    id: "APP-2026-017", name: "Priya Sharma", firstName: "Priya", lastName: "Sharma",
    email: "tenant@jkr.com", phone: "9876543211", flat: "204", wing: "B",
    role: ROLES.TENANT, occupation: "Doctor", ownerName: "Arjun Mehta",
    leaseStart: "2026-04-01", leaseEnd: "2027-03-31",
    submittedAt: "2026-04-02", status: APPLICATION_STATUS.APPROVED,
    documents: ["aadhaar", "rental_agreement", "photo"],
    remarks: "Verified by Secretary.",
  },
  {
    id: "APP-2026-018", name: "Ramesh Iyer", firstName: "Ramesh", lastName: "Iyer",
    email: "president@jkr.com", phone: "9876543212", flat: "301", wing: "C",
    role: ROLES.OWNER, occupation: "Retired IAS",
    submittedAt: "2026-03-15", status: APPLICATION_STATUS.APPROVED,
    documents: ["aadhaar", "sale_deed", "pan"],
    remarks: "Long-term resident.",
  },
  {
    id: "APP-2026-019", name: "Sunita Nair", firstName: "Sunita", lastName: "Nair",
    email: "secretary@jkr.com", phone: "9876543213", flat: "402", wing: "D",
    role: ROLES.OWNER, occupation: "HR Manager",
    submittedAt: "2026-03-20", status: APPLICATION_STATUS.APPROVED,
    documents: ["aadhaar", "sale_deed", "photo"],
    remarks: "Documents complete.",
  },
  {
    id: "APP-2026-020", name: "Kavitha Rajan", firstName: "Kavitha", lastName: "Rajan",
    email: "kavitha.r@email.com", phone: "9812345620", flat: "505", wing: "E",
    role: ROLES.TENANT, occupation: "Nurse", ownerName: "Vikram Desai",
    leaseStart: "2026-04-01", leaseEnd: "2027-03-31",
    submittedAt: "2026-04-10", status: APPLICATION_STATUS.APPROVED,
    documents: ["aadhaar", "rental_agreement"],
    remarks: "Approved after document review.",
  },
  // 3 Rejected
  {
    id: "APP-2026-021", name: "Suresh Babu", firstName: "Suresh", lastName: "Babu",
    email: "suresh.b@email.com", phone: "9812345621", flat: "105", wing: "A",
    role: ROLES.OWNER, occupation: "Trader",
    submittedAt: "2026-04-15", status: APPLICATION_STATUS.REJECTED,
    documents: ["aadhaar"],
    remarks: "Incomplete documents. Sale deed missing.",
  },
  {
    id: "APP-2026-022", name: "Geetha Pillai", firstName: "Geetha", lastName: "Pillai",
    email: "geetha.p@email.com", phone: "9812345622", flat: "210", wing: "B",
    role: ROLES.TENANT, occupation: "Student", ownerName: "Unknown",
    leaseStart: "2026-04-01", leaseEnd: "2026-09-30",
    submittedAt: "2026-04-18", status: APPLICATION_STATUS.REJECTED,
    documents: ["aadhaar"],
    remarks: "Rental agreement not valid. Owner details mismatch.",
  },
  {
    id: "APP-2026-023", name: "Mohan Das", firstName: "Mohan", lastName: "Das",
    email: "mohan.d@email.com", phone: "9812345623", flat: "315", wing: "C",
    role: ROLES.OWNER, occupation: "Contractor",
    submittedAt: "2026-04-20", status: APPLICATION_STATUS.REJECTED,
    documents: ["aadhaar", "sale_deed"],
    remarks: "Flat ownership disputed. Refer to legal.",
  },
];

export const DOCUMENT_TYPES = [
  { key: "aadhaar", label: "Aadhaar Card", required: true, accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "pan", label: "PAN Card", required: false, accept: ".pdf,.jpg,.jpeg,.png" },
  { key: "sale_deed", label: "Sale Deed", required: false, accept: ".pdf" },
  { key: "rental_agreement", label: "Rental Agreement", required: false, accept: ".pdf" },
  { key: "photo", label: "Passport Size Photo", required: true, accept: ".jpg,.jpeg,.png" },
];

export function getApplicationById(id) {
  return mockApplications.find((a) => a.id === id) ?? null;
}

export function getStatusCounts() {
  return {
    pending: mockApplications.filter((a) => a.status === APPLICATION_STATUS.PENDING).length,
    approved: mockApplications.filter((a) => a.status === APPLICATION_STATUS.APPROVED).length,
    rejected: mockApplications.filter((a) => a.status === APPLICATION_STATUS.REJECTED).length,
    total: mockApplications.length,
  };
}
