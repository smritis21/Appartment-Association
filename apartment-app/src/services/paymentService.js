/**
 * paymentService.js - BE-11.
 *
 * Talks to the Payments & Billing API and translates between the backend's
 * snake_case contract and the camelCase shape the payment pages already use,
 * so PaymentDashboardPage, PayBillPage and PaymentHistoryPage did not need
 * rewriting.
 *
 * Endpoints used:
 *   GET  /bills                          - list all bills
 *   GET  /bills/{bill_id}                - single bill detail
 *   POST /payments                       - process a payment
 *   GET  /payments/resident/{id}         - payment history for a resident
 *   GET  /payments/{payment_id}          - single payment / receipt
 */

import apiClient from "./apiClient";

// ── Shape translators ─────────────────────────────────────────────────────────

/** Backend BillSummary / BillOut -> UI bill shape */
export function toUiBill(dto) {
  return {
    id:           dto.bill_id,
    // Human-readable invoice number (Bug 18). Bills created before this field
    // existed have none, so fall back to the raw UUID for those.
    billNo:       dto.bill_no ?? dto.bill_id,
    residentId:   dto.resident_id,
    billingMonth: dto.billing_month,
    maintenance:  Number(dto.maintenance  ?? 0),
    water:        Number(dto.water        ?? 0),
    parking:      Number(dto.parking      ?? 0),
    miscellaneous:Number(dto.miscellaneous ?? 0),
    discount:     Number(dto.discount     ?? 0),
    gst:          Number(dto.gst          ?? 0),
    total:        Number(dto.total_amount),
    dueDate:      dto.due_date,
    status:       dto.status,
    payments:     (dto.payments ?? []).map(toUiPayment),
  };
}

/** Backend PaymentOut / PaymentReceipt -> UI payment shape */
export function toUiPayment(dto) {
  return {
    id:            dto.payment_id,
    billId:        dto.bill_id,
    residentId:    dto.resident_id,
    amount:        Number(dto.amount_paid),
    method:        dto.payment_method,
    status:        dto.status,
    transactionId: dto.transaction_ref ?? dto.receipt_no,
    receiptNo:     dto.receipt_no,
    paidAt:        dto.paid_on,
    gatewayMessage:dto.gateway_message ?? null,
    billingMonth:  dto.billing_month ?? null,
  };
}

// ── Bills ─────────────────────────────────────────────────────────────────────

export async function fetchBills({ residentId, status, skip = 0, limit = 50 } = {}, options = {}) {
  const params = new URLSearchParams();
  if (residentId) params.set("resident_id", residentId);
  if (status)     params.set("status", status);
  params.set("skip", skip);
  params.set("limit", limit);
  const data = await apiClient.get(`/bills?${params}`, options);
  return (data ?? []).map(toUiBill);
}

export async function fetchBill(billId, options = {}) {
  const data = await apiClient.get(`/bills/${encodeURIComponent(billId)}`, options);
  return toUiBill(data);
}

// ── Payments ──────────────────────────────────────────────────────────────────

/**
 * Process a payment against a bill.
 * @param {string} billId
 * @param {number} amountPaid
 * @param {string} paymentMethod  - "upi" | "online_transfer" | "cheque" | "cash"
 * @param {{ mockReference?: string, simulateFailure?: boolean }} [gateway]
 */
export async function processPayment(billId, amountPaid, paymentMethod, gateway = {}, options = {}) {
  const data = await apiClient.post("/payments", {
    bill_id:        billId,
    amount_paid:    amountPaid,
    payment_method: paymentMethod,
    gateway: {
      mock_reference:   gateway.mockReference ?? null,
      simulate_failure: gateway.simulateFailure ?? false,
      simulate_timeout: gateway.simulateTimeout ?? false,
    },
  }, options);
  return toUiPayment(data);
}

// ── Billing (BE-28) ───────────────────────────────────────────────────────────

export async function fetchBillStatement(billId, { asOf } = {}, options = {}) {
  const params = new URLSearchParams();
  if (asOf) params.set("as_of", asOf);
  const data = await apiClient.get(
    `/bills/${encodeURIComponent(billId)}/statement?${params}`,
    options
  );
  return data;
}

export async function fetchLateFee(billId, { asOf } = {}, options = {}) {
  const params = new URLSearchParams();
  if (asOf) params.set("as_of", asOf);
  const data = await apiClient.get(
    `/bills/${encodeURIComponent(billId)}/late-fee?${params}`,
    options
  );
  return data;
}

export async function fetchReceipt(paymentId, options = {}) {
  const data = await apiClient.get(
    `/payments/${encodeURIComponent(paymentId)}/receipt`,
    options
  );
  return data;
}

export async function fetchResidentBills(residentId, params = {}, options = {}) {
  const qs = new URLSearchParams();
  if (params.status)       qs.set("status", params.status);
  if (params.billingMonth) qs.set("billing_month", params.billingMonth);
  if (params.unpaidOnly)   qs.set("unpaid_only", "true");
  qs.set("skip",  params.skip  ?? 0);
  qs.set("limit", params.limit ?? 50);
  const data = await apiClient.get(
    `/residents/${encodeURIComponent(residentId)}/bills?${qs}`,
    options
  );
  return data;
}

export async function fetchPaymentsByResident(residentId, { skip = 0, limit = 50 } = {}, options = {}) {
  const data = await apiClient.get(
    `/payments/resident/${encodeURIComponent(residentId)}?skip=${skip}&limit=${limit}`,
    options
  );
  return (data ?? []).map(toUiPayment);
}

export async function fetchPayment(paymentId, options = {}) {
  const data = await apiClient.get(`/payments/${encodeURIComponent(paymentId)}`, options);
  return toUiPayment(data);
}

