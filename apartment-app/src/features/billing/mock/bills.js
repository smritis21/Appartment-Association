export const BILL_STATUS = {
  PAID:            "paid",
  PENDING:         "pending",
  OVERDUE:         "overdue",
  PARTIALLY_PAID:  "partially_paid",
};

export const BILLING_MONTHS = [
  "January 2026", "February 2026", "March 2026", "April 2026",
  "May 2026",     "June 2026",     "July 2026",
];

// Each bill references a residentId - joined with ResidentContext at runtime.
// Amounts in INR.
export const mockBills = [
  {
    id: "BILL-2026-001", residentId: "RES-001", billingMonth: "April 2026",
    maintenance: 3500, water: 400, parking: 500, miscellaneous: 0, discount: 0, gst: 396,
    dueDate: "2026-04-15", paidDate: "2026-04-10", status: BILL_STATUS.PAID,
    paymentRef: "PAY-001",
  },
  {
    id: "BILL-2026-002", residentId: "RES-002", billingMonth: "April 2026",
    maintenance: 3500, water: 350, parking: 0, miscellaneous: 0, discount: 0, gst: 357,
    dueDate: "2026-04-15", paidDate: "2026-04-12", status: BILL_STATUS.PAID,
    paymentRef: "PAY-002",
  },
  {
    id: "BILL-2026-003", residentId: "RES-003", billingMonth: "April 2026",
    maintenance: 3500, water: 420, parking: 500, miscellaneous: 200, discount: 100, gst: 412,
    dueDate: "2026-04-15", paidDate: "2026-04-14", status: BILL_STATUS.PAID,
    paymentRef: "PAY-003",
  },
  {
    id: "BILL-2026-004", residentId: "RES-004", billingMonth: "April 2026",
    maintenance: 3500, water: 380, parking: 500, miscellaneous: 0, discount: 0, gst: 399,
    dueDate: "2026-04-15", paidDate: null, status: BILL_STATUS.PENDING,
    paymentRef: null,
  },
  {
    id: "BILL-2026-005", residentId: "RES-005", billingMonth: "April 2026",
    maintenance: 3500, water: 300, parking: 0, miscellaneous: 0, discount: 0, gst: 342,
    dueDate: "2026-04-15", paidDate: null, status: BILL_STATUS.OVERDUE,
    paymentRef: null,
  },
  {
    id: "BILL-2026-006", residentId: "RES-006", billingMonth: "April 2026",
    maintenance: 3500, water: 450, parking: 1000, miscellaneous: 500, discount: 200, gst: 522,
    dueDate: "2026-04-15", paidDate: "2026-04-08", status: BILL_STATUS.PAID,
    paymentRef: "PAY-004",
  },
  {
    id: "BILL-2026-007", residentId: "RES-007", billingMonth: "April 2026",
    maintenance: 3500, water: 320, parking: 0, miscellaneous: 0, discount: 0, gst: 345,
    dueDate: "2026-04-15", paidDate: null, status: BILL_STATUS.OVERDUE,
    paymentRef: null,
  },
  {
    id: "BILL-2026-008", residentId: "RES-008", billingMonth: "April 2026",
    maintenance: 3500, water: 410, parking: 500, miscellaneous: 0, discount: 0, gst: 401,
    dueDate: "2026-04-15", paidDate: "2026-04-13", status: BILL_STATUS.PAID,
    paymentRef: "PAY-005",
  },
  {
    id: "BILL-2026-009", residentId: "RES-009", billingMonth: "April 2026",
    maintenance: 3500, water: 290, parking: 0, miscellaneous: 0, discount: 0, gst: 339,
    dueDate: "2026-04-15", paidDate: null, status: BILL_STATUS.PENDING,
    paymentRef: null,
  },
  {
    id: "BILL-2026-010", residentId: "RES-010", billingMonth: "April 2026",
    maintenance: 3500, water: 440, parking: 500, miscellaneous: 300, discount: 0, gst: 427,
    dueDate: "2026-04-15", paidDate: "2026-04-11", status: BILL_STATUS.PAID,
    paymentRef: "PAY-006",
  },
  {
    id: "BILL-2026-011", residentId: "RES-001", billingMonth: "May 2026",
    maintenance: 3500, water: 420, parking: 500, miscellaneous: 0, discount: 0, gst: 401,
    dueDate: "2026-05-15", paidDate: "2026-05-09", status: BILL_STATUS.PAID,
    paymentRef: "PAY-007",
  },
  {
    id: "BILL-2026-012", residentId: "RES-002", billingMonth: "May 2026",
    maintenance: 3500, water: 360, parking: 0, miscellaneous: 0, discount: 0, gst: 358,
    dueDate: "2026-05-15", paidDate: null, status: BILL_STATUS.PENDING,
    paymentRef: null,
  },
  {
    id: "BILL-2026-013", residentId: "RES-003", billingMonth: "May 2026",
    maintenance: 3500, water: 430, parking: 500, miscellaneous: 0, discount: 100, gst: 399,
    dueDate: "2026-05-15", paidDate: "2026-05-14", status: BILL_STATUS.PAID,
    paymentRef: "PAY-008",
  },
  {
    id: "BILL-2026-014", residentId: "RES-004", billingMonth: "May 2026",
    maintenance: 3500, water: 390, parking: 500, miscellaneous: 0, discount: 0, gst: 401,
    dueDate: "2026-05-15", paidDate: null, status: BILL_STATUS.OVERDUE,
    paymentRef: null,
  },
  {
    id: "BILL-2026-015", residentId: "RES-005", billingMonth: "May 2026",
    maintenance: 3500, water: 310, parking: 0, miscellaneous: 0, discount: 0, gst: 343,
    dueDate: "2026-05-15", paidDate: null, status: BILL_STATUS.PENDING,
    paymentRef: null,
  },
  {
    id: "BILL-2026-016", residentId: "RES-006", billingMonth: "May 2026",
    maintenance: 3500, water: 460, parking: 1000, miscellaneous: 0, discount: 200, gst: 477,
    dueDate: "2026-05-15", paidDate: "2026-05-07", status: BILL_STATUS.PAID,
    paymentRef: "PAY-009",
  },
  {
    id: "BILL-2026-017", residentId: "RES-011", billingMonth: "May 2026",
    maintenance: 3500, water: 330, parking: 0, miscellaneous: 0, discount: 0, gst: 346,
    dueDate: "2026-05-15", paidDate: null, status: BILL_STATUS.PARTIALLY_PAID,
    paymentRef: "PAY-010",
  },
  {
    id: "BILL-2026-018", residentId: "RES-012", billingMonth: "May 2026",
    maintenance: 3500, water: 400, parking: 500, miscellaneous: 0, discount: 0, gst: 396,
    dueDate: "2026-05-15", paidDate: "2026-05-12", status: BILL_STATUS.PAID,
    paymentRef: "PAY-011",
  },
  {
    id: "BILL-2026-019", residentId: "RES-014", billingMonth: "May 2026",
    maintenance: 3500, water: 370, parking: 500, miscellaneous: 200, discount: 0, gst: 415,
    dueDate: "2026-05-15", paidDate: null, status: BILL_STATUS.PENDING,
    paymentRef: null,
  },
  {
    id: "BILL-2026-020", residentId: "RES-016", billingMonth: "May 2026",
    maintenance: 3500, water: 440, parking: 500, miscellaneous: 0, discount: 0, gst: 404,
    dueDate: "2026-05-15", paidDate: "2026-05-10", status: BILL_STATUS.PAID,
    paymentRef: "PAY-012",
  },
];

export function getBillTotal(bill) {
  return bill.maintenance + bill.water + bill.parking + bill.miscellaneous - bill.discount + bill.gst;
}

// Runtime-generated bills (not in the static array)
const _runtimeBills = [];

export function addRuntimeBill(bill) {
  _runtimeBills.unshift(bill);
}

export function getAllBills() {
  return [..._runtimeBills, ...mockBills];
}

export function getBillById(id) {
  return [..._runtimeBills, ...mockBills].find((b) => b.id === id) ?? null;
}

