export const mockReceipts = [
  { id: "PAY-001", billId: "BILL-2026-001", residentId: "RES-001", amount: 4796, paidDate: "2026-04-10", mode: "Online Transfer",   ref: "UTR8823441" },
  { id: "PAY-002", billId: "BILL-2026-002", residentId: "RES-002", amount: 4207, paidDate: "2026-04-12", mode: "UPI",               ref: "UPI9912233" },
  { id: "PAY-003", billId: "BILL-2026-003", residentId: "RES-003", amount: 4932, paidDate: "2026-04-14", mode: "Cheque",            ref: "CHQ004412" },
  { id: "PAY-004", billId: "BILL-2026-006", residentId: "RES-006", amount: 5772, paidDate: "2026-04-08", mode: "Online Transfer",   ref: "UTR8823998" },
  { id: "PAY-005", billId: "BILL-2026-008", residentId: "RES-008", amount: 4811, paidDate: "2026-04-13", mode: "UPI",               ref: "UPI9912500" },
  { id: "PAY-006", billId: "BILL-2026-010", residentId: "RES-010", amount: 5167, paidDate: "2026-04-11", mode: "Online Transfer",   ref: "UTR8824100" },
  { id: "PAY-007", billId: "BILL-2026-011", residentId: "RES-001", amount: 4821, paidDate: "2026-05-09", mode: "UPI",               ref: "UPI9913001" },
  { id: "PAY-008", billId: "BILL-2026-013", residentId: "RES-003", amount: 4729, paidDate: "2026-05-14", mode: "Online Transfer",   ref: "UTR8824500" },
  { id: "PAY-009", billId: "BILL-2026-016", residentId: "RES-006", amount: 5237, paidDate: "2026-05-07", mode: "Cheque",            ref: "CHQ004500" },
  { id: "PAY-010", billId: "BILL-2026-017", residentId: "RES-011", amount: 2000, paidDate: "2026-05-10", mode: "UPI",               ref: "UPI9913200" },
  { id: "PAY-011", billId: "BILL-2026-018", residentId: "RES-012", amount: 4796, paidDate: "2026-05-12", mode: "Online Transfer",   ref: "UTR8824800" },
  { id: "PAY-012", billId: "BILL-2026-020", residentId: "RES-016", amount: 4844, paidDate: "2026-05-10", mode: "UPI",               ref: "UPI9913400" },
];

export function getReceiptByBillId(billId) {
  return mockReceipts.find((r) => r.billId === billId) ?? null;
}
