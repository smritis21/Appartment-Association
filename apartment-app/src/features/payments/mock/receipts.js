import { getAllPayments } from "./payments";

export const mockPaymentReceipts = [
  { id: "RCPT-001", paymentId: "PMNT-001", billId: "BILL-2026-001", residentId: "RES-001", amount: 4796, gst: 396,  method: "UPI",         upiId: "arjun@upi",       transactionId: "TXN8823441", issuedAt: "2026-04-10T10:23:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-002", paymentId: "PMNT-002", billId: "BILL-2026-002", residentId: "RES-002", amount: 4207, gst: 357,  method: "Credit Card",  cardLast4: "4521",        transactionId: "TXN9912233", issuedAt: "2026-04-12T14:05:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-003", paymentId: "PMNT-003", billId: "BILL-2026-003", residentId: "RES-003", amount: 4932, gst: 412,  method: "Net Banking",  bank: "HDFC Bank",        transactionId: "TXN0044120", issuedAt: "2026-04-14T09:45:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-004", paymentId: "PMNT-004", billId: "BILL-2026-006", residentId: "RES-006", amount: 5772, gst: 522,  method: "Debit Card",   cardLast4: "7832",        transactionId: "TXN8823998", issuedAt: "2026-04-08T11:30:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-005", paymentId: "PMNT-005", billId: "BILL-2026-008", residentId: "RES-008", amount: 4811, gst: 401,  method: "UPI",         upiId: "suresh@upi",      transactionId: "TXN9912500", issuedAt: "2026-04-13T16:20:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-006", paymentId: "PMNT-006", billId: "BILL-2026-010", residentId: "RES-010", amount: 5167, gst: 427,  method: "Wallet",      wallet: "Paytm",          transactionId: "TXN8824100", issuedAt: "2026-04-11T08:55:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-007", paymentId: "PMNT-007", billId: "BILL-2026-011", residentId: "RES-001", amount: 4821, gst: 401,  method: "UPI",         upiId: "arjun@upi",       transactionId: "TXN9913001", issuedAt: "2026-05-09T12:10:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-008", paymentId: "PMNT-008", billId: "BILL-2026-013", residentId: "RES-003", amount: 4729, gst: 399,  method: "Net Banking",  bank: "SBI",              transactionId: "TXN8824500", issuedAt: "2026-05-14T10:00:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-009", paymentId: "PMNT-009", billId: "BILL-2026-016", residentId: "RES-006", amount: 5237, gst: 477,  method: "Cash",        note: "Paid at office",   transactionId: "TXN0045000", issuedAt: "2026-05-07T15:30:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-010", paymentId: "PMNT-010", billId: "BILL-2026-017", residentId: "RES-011", amount: 2000, gst: 346,  method: "UPI",         upiId: "deepa@upi",       transactionId: "TXN9913200", issuedAt: "2026-05-10T09:00:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-011", paymentId: "PMNT-011", billId: "BILL-2026-018", residentId: "RES-012", amount: 4796, gst: 396,  method: "Credit Card",  cardLast4: "9012",        transactionId: "TXN8824800", issuedAt: "2026-05-12T13:45:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-012", paymentId: "PMNT-012", billId: "BILL-2026-020", residentId: "RES-016", amount: 4844, gst: 404,  method: "Debit Card",   cardLast4: "3344",        transactionId: "TXN9913400", issuedAt: "2026-05-10T17:20:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-013", paymentId: "PMNT-013", billId: "BILL-2026-004", residentId: "RES-004", amount: 4779, gst: 399,  method: "UPI",         upiId: "sunita@upi",      transactionId: "TXN9914001", issuedAt: "2026-04-14T18:00:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-014", paymentId: "PMNT-014", billId: "BILL-2026-005", residentId: "RES-005", amount: 4142, gst: 342,  method: "Net Banking",  bank: "ICICI Bank",       transactionId: "TXN8825001", issuedAt: "2026-04-14T19:30:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-015", paymentId: "PMNT-015", billId: "BILL-2026-007", residentId: "RES-007", amount: 4165, gst: 345,  method: "Wallet",      wallet: "PhonePe",        transactionId: "TXN9914200", issuedAt: "2026-04-10T11:00:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-016", paymentId: "PMNT-016", billId: "BILL-2026-009", residentId: "RES-009", amount: 4129, gst: 339,  method: "Credit Card",  cardLast4: "6677",        transactionId: "TXN8825200", issuedAt: "2026-05-14T20:00:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-017", paymentId: "PMNT-017", billId: "BILL-2026-012", residentId: "RES-002", amount: 4218, gst: 358,  method: "UPI",         upiId: "priya@upi",       transactionId: "TXN9914500", issuedAt: "2026-05-14T21:00:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-018", paymentId: "PMNT-018", billId: "BILL-2026-014", residentId: "RES-004", amount: 4791, gst: 401,  method: "Debit Card",   cardLast4: "5566",        transactionId: "TXN8825500", issuedAt: "2026-05-14T22:00:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-019", paymentId: "PMNT-019", billId: "BILL-2026-015", residentId: "RES-005", amount: 4153, gst: 343,  method: "Wallet",      wallet: "Google Pay",     transactionId: "TXN9914800", issuedAt: "2026-05-14T22:30:00", association: "Jains Kences Retreat Owners Association" },
  { id: "RCPT-020", paymentId: "PMNT-020", billId: "BILL-2026-019", residentId: "RES-014", amount: 4985, gst: 415,  method: "Net Banking",  bank: "Axis Bank",        transactionId: "TXN8825800", issuedAt: "2026-05-14T23:00:00", association: "Jains Kences Retreat Owners Association" },
];

const _runtimeReceipts = [];

export function addRuntimeReceipt(receipt) {
  _runtimeReceipts.unshift(receipt);
}

export function getAllReceipts() {
  return [..._runtimeReceipts, ...mockPaymentReceipts];
}

export function getReceiptByPaymentId(paymentId) {
  return [..._runtimeReceipts, ...mockPaymentReceipts].find((r) => r.paymentId === paymentId) ?? null;
}

export function getReceiptByBillId(billId) {
  return [..._runtimeReceipts, ...mockPaymentReceipts].find((r) => r.billId === billId) ?? null;
}

export function generateReceiptId() {
  return `RCPT-${String(Date.now()).slice(-6)}`;
}
