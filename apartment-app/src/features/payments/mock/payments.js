import { BILL_STATUS, getAllBills, getBillTotal } from "../../billing/mock/bills";

export const PAYMENT_STATUS = {
  PAID: "paid",
  PENDING: "pending",
  FAILED: "failed",
  REFUNDED: "refunded",
};

export const PAYMENT_METHODS = {
  UPI: "UPI",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  NET_BANKING: "Net Banking",
  WALLET: "Wallet",
  CASH: "Cash",
};

// Static payment records linked to billing mock data
export const mockPayments = [
  { id: "PMNT-001", billId: "BILL-2026-001", residentId: "RES-001", amount: 4796, method: PAYMENT_METHODS.UPI,         status: PAYMENT_STATUS.PAID,     transactionId: "TXN8823441", paidAt: "2026-04-10T10:23:00" },
  { id: "PMNT-002", billId: "BILL-2026-002", residentId: "RES-002", amount: 4207, method: PAYMENT_METHODS.CREDIT_CARD, status: PAYMENT_STATUS.PAID,     transactionId: "TXN9912233", paidAt: "2026-04-12T14:05:00" },
  { id: "PMNT-003", billId: "BILL-2026-003", residentId: "RES-003", amount: 4932, method: PAYMENT_METHODS.NET_BANKING, status: PAYMENT_STATUS.PAID,     transactionId: "TXN0044120", paidAt: "2026-04-14T09:45:00" },
  { id: "PMNT-004", billId: "BILL-2026-006", residentId: "RES-006", amount: 5772, method: PAYMENT_METHODS.DEBIT_CARD,  status: PAYMENT_STATUS.PAID,     transactionId: "TXN8823998", paidAt: "2026-04-08T11:30:00" },
  { id: "PMNT-005", billId: "BILL-2026-008", residentId: "RES-008", amount: 4811, method: PAYMENT_METHODS.UPI,         status: PAYMENT_STATUS.PAID,     transactionId: "TXN9912500", paidAt: "2026-04-13T16:20:00" },
  { id: "PMNT-006", billId: "BILL-2026-010", residentId: "RES-010", amount: 5167, method: PAYMENT_METHODS.WALLET,      status: PAYMENT_STATUS.PAID,     transactionId: "TXN8824100", paidAt: "2026-04-11T08:55:00" },
  { id: "PMNT-007", billId: "BILL-2026-011", residentId: "RES-001", amount: 4821, method: PAYMENT_METHODS.UPI,         status: PAYMENT_STATUS.PAID,     transactionId: "TXN9913001", paidAt: "2026-05-09T12:10:00" },
  { id: "PMNT-008", billId: "BILL-2026-013", residentId: "RES-003", amount: 4729, method: PAYMENT_METHODS.NET_BANKING, status: PAYMENT_STATUS.PAID,     transactionId: "TXN8824500", paidAt: "2026-05-14T10:00:00" },
  { id: "PMNT-009", billId: "BILL-2026-016", residentId: "RES-006", amount: 5237, method: PAYMENT_METHODS.CASH,        status: PAYMENT_STATUS.PAID,     transactionId: "TXN0045000", paidAt: "2026-05-07T15:30:00" },
  { id: "PMNT-010", billId: "BILL-2026-017", residentId: "RES-011", amount: 2000, method: PAYMENT_METHODS.UPI,         status: PAYMENT_STATUS.PAID,     transactionId: "TXN9913200", paidAt: "2026-05-10T09:00:00" },
  { id: "PMNT-011", billId: "BILL-2026-018", residentId: "RES-012", amount: 4796, method: PAYMENT_METHODS.CREDIT_CARD, status: PAYMENT_STATUS.PAID,     transactionId: "TXN8824800", paidAt: "2026-05-12T13:45:00" },
  { id: "PMNT-012", billId: "BILL-2026-020", residentId: "RES-016", amount: 4844, method: PAYMENT_METHODS.DEBIT_CARD,  status: PAYMENT_STATUS.PAID,     transactionId: "TXN9913400", paidAt: "2026-05-10T17:20:00" },
  { id: "PMNT-013", billId: "BILL-2026-004", residentId: "RES-004", amount: 4779, method: PAYMENT_METHODS.UPI,         status: PAYMENT_STATUS.FAILED,   transactionId: "TXN9914001", paidAt: "2026-04-14T18:00:00" },
  { id: "PMNT-014", billId: "BILL-2026-005", residentId: "RES-005", amount: 4142, method: PAYMENT_METHODS.NET_BANKING, status: PAYMENT_STATUS.FAILED,   transactionId: "TXN8825001", paidAt: "2026-04-14T19:30:00" },
  { id: "PMNT-015", billId: "BILL-2026-007", residentId: "RES-007", amount: 4165, method: PAYMENT_METHODS.WALLET,      status: PAYMENT_STATUS.REFUNDED, transactionId: "TXN9914200", paidAt: "2026-04-10T11:00:00" },
  { id: "PMNT-016", billId: "BILL-2026-009", residentId: "RES-009", amount: 4129, method: PAYMENT_METHODS.CREDIT_CARD, status: PAYMENT_STATUS.PENDING,  transactionId: "TXN8825200", paidAt: "2026-05-14T20:00:00" },
  { id: "PMNT-017", billId: "BILL-2026-012", residentId: "RES-002", amount: 4218, method: PAYMENT_METHODS.UPI,         status: PAYMENT_STATUS.PENDING,  transactionId: "TXN9914500", paidAt: "2026-05-14T21:00:00" },
  { id: "PMNT-018", billId: "BILL-2026-014", residentId: "RES-004", amount: 4791, method: PAYMENT_METHODS.DEBIT_CARD,  status: PAYMENT_STATUS.PENDING,  transactionId: "TXN8825500", paidAt: "2026-05-14T22:00:00" },
  { id: "PMNT-019", billId: "BILL-2026-015", residentId: "RES-005", amount: 4153, method: PAYMENT_METHODS.WALLET,      status: PAYMENT_STATUS.PENDING,  transactionId: "TXN9914800", paidAt: "2026-05-14T22:30:00" },
  { id: "PMNT-020", billId: "BILL-2026-019", residentId: "RES-014", amount: 4985, method: PAYMENT_METHODS.NET_BANKING, status: PAYMENT_STATUS.PENDING,  transactionId: "TXN8825800", paidAt: "2026-05-14T23:00:00" },
];

// Runtime payments added during session
const _runtimePayments = [];

export function addRuntimePayment(payment) {
  _runtimePayments.unshift(payment);
}

export function getAllPayments() {
  return [..._runtimePayments, ...mockPayments];
}

export function getPaymentById(id) {
  return [..._runtimePayments, ...mockPayments].find((p) => p.id === id) ?? null;
}

export function getPaymentByBillId(billId) {
  return [..._runtimePayments, ...mockPayments].find((p) => p.billId === billId && p.status === PAYMENT_STATUS.PAID) ?? null;
}

export function generatePaymentId() {
  return `PMNT-${String(Date.now()).slice(-6)}`;
}

export function generateTransactionId() {
  return `TXN${Math.floor(Math.random() * 9000000 + 1000000)}`;
}

// Derive dashboard stats from live bills + payments
export function getPaymentStats() {
  const bills = getAllBills();
  const payments = getAllPayments();
  const now = new Date();
  const thisMonth = `${now.toLocaleString("en-IN", { month: "long" })} ${now.getFullYear()}`;

  const outstanding = bills
    .filter((b) => b.status === BILL_STATUS.PENDING || b.status === BILL_STATUS.OVERDUE)
    .reduce((sum, b) => sum + getBillTotal(b), 0);

  const paidThisMonth = payments
    .filter((p) => p.status === PAYMENT_STATUS.PAID && p.paidAt?.startsWith("2026-05"))
    .reduce((sum, p) => sum + p.amount, 0);

  const pendingBills = bills.filter(
    (b) => b.status === BILL_STATUS.PENDING || b.status === BILL_STATUS.OVERDUE
  ).length;

  const completedPayments = payments.filter((p) => p.status === PAYMENT_STATUS.PAID).length;

  const lastPayment = [...payments]
    .filter((p) => p.status === PAYMENT_STATUS.PAID)
    .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))[0] ?? null;

  return { outstanding, paidThisMonth, pendingBills, completedPayments, lastPayment };
}
