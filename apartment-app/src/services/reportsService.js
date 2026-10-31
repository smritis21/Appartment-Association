/**
 * reportsService.js - INT-36: Integrate Reports and Analytics
 *
 * Talks to:
 *   GET /reports/summary      - cross-module headline metrics
 *   GET /reports/payments     - billing/collections aggregates
 *   GET /reports/residents    - occupancy aggregates
 *   GET /reports/visitors     - gate traffic aggregates
 *   GET /reports/maintenance  - scheduled maintenance aggregates
 */

import apiClient from "./apiClient";

/**
 * Build a date-range query string for the reports endpoints.
 * Both params are optional; the backend defaults to the last 30 days.
 */
function rangeQuery(dateFrom, dateTo) {
  const p = new URLSearchParams();
  if (dateFrom) p.set("date_from", dateFrom);
  if (dateTo)   p.set("date_to",   dateTo);
  return p.toString() ? `?${p}` : "";
}

// ── Summary (headline metrics) ───────────────────────────────────────────────

export async function fetchSummary(dateFrom, dateTo, options = {}) {
  const s = await apiClient.get(`/reports/summary${rangeQuery(dateFrom, dateTo)}`, options);
  // Field names follow the API exactly - a mismatch here silently reads as
  // 0 (via the `?? 0` fallbacks below) instead of throwing, so the
  // dashboard would look empty even with the endpoint returning real data.
  return {
    totalResidents:       s.active_residents            ?? 0,
    paymentsCollected:    Number(s.payments_collected_amount ?? 0),
    paymentsCount:        s.payments_collected_count    ?? 0,
    outstandingAmount:    Number(s.outstanding_bills_amount ?? 0),
    outstandingCount:     s.outstanding_bills_count     ?? 0,
    visitorEntries:       s.visitors_count              ?? 0,
    templeBookings:       s.temple_bookings_count       ?? 0,
    communitySignups:     s.community_signups_count     ?? 0,
    dateFrom:             s.date_from                   ?? dateFrom,
    dateTo:               s.date_to                     ?? dateTo,
  };
}

// ── Payments ─────────────────────────────────────────────────────────────────

export async function fetchPaymentsReport(dateFrom, dateTo, options = {}) {
  const r = await apiClient.get(`/reports/payments${rangeQuery(dateFrom, dateTo)}`, options);
  // Money arrives as decimal strings, which render as "0" once they meet
  // arithmetic. Everything is coerced once, here.
  const byStatus = Object.fromEntries(
    (r.by_status ?? []).map((row) => [row.label, row.count])
  );
  return {
    totalInvoiced:  Number(r.total_billed       ?? 0),
    totalCollected: Number(r.total_collected    ?? 0),
    totalOverdue:   Number(r.total_outstanding  ?? 0),
    averageBill:    Number(r.average_bill_amount ?? 0),
    invoiceCount:   r.bill_count      ?? 0,
    paidCount:      byStatus.paid     ?? 0,
    overdueCount:   byStatus.overdue  ?? 0,
    pendingCount:   byStatus.pending  ?? 0,
    byStatus:       r.by_status       ?? [],
    // The payments report totals the window rather than breaking it down by
    // month, so there is no series to chart from this endpoint.
    byMonth:        [],
  };
}

// ── Residents ────────────────────────────────────────────────────────────────

export async function fetchResidentsReport(dateFrom, dateTo, options = {}) {
  const r = await apiClient.get(`/reports/residents${rangeQuery(dateFrom, dateTo)}`, options);
  // Status counts arrive as a labelled list rather than named fields.
  const byStatus = Object.fromEntries(
    (r.by_status ?? []).map((row) => [row.label, row.count])
  );
  return {
    total:        r.total_residents ?? 0,
    active:       byStatus.active   ?? 0,
    pending:      byStatus.pending  ?? 0,
    inactive:     byStatus.inactive ?? 0,
    newMoveIns:   r.new_move_ins    ?? 0,
    occupancyPct: Math.round((r.occupancy_rate ?? 0) * 100),
    byBlock:      r.by_block        ?? [],
  };
}

// ── Visitors ─────────────────────────────────────────────────────────────────

export async function fetchVisitorsReport(dateFrom, dateTo, options = {}) {
  const r = await apiClient.get(`/reports/visitors${rangeQuery(dateFrom, dateTo)}`, options);
  const byStatus = Object.fromEntries(
    (r.by_status ?? []).map((row) => [row.label, row.count])
  );
  return {
    totalEntries:  r.total_visitors   ?? 0,
    approved:      byStatus.approved  ?? 0,
    rejected:      byStatus.rejected  ?? 0,
    averagePerDay: r.average_per_day  ?? 0,
    byPurpose:     r.by_purpose       ?? [],
    // The API reports totals for the window, not a month-by-month series.
    byMonth:       [],
  };
}

// ── Maintenance ──────────────────────────────────────────────────────────────

export async function fetchMaintenanceReport(dateFrom, dateTo, options = {}) {
  const r = await apiClient.get(`/reports/maintenance${rangeQuery(dateFrom, dateTo)}`, options);
  return {
    scheduled: r.total_scheduled ?? 0,
    upcoming:  r.upcoming_count  ?? 0,
    // "Completed" here means work already past its scheduled date; the
    // maintenance report counts by date rather than by an outcome flag.
    completed: r.past_count      ?? 0,
  };
}


// ── AI/ML insights (BE-41) ───────────────────────────────────────────────────
//
// These are the parts of analytics that are not simple aggregation: a trend
// fitted across the series, a forecast projected from it, and points flagged
// as unusual. The maths is done server-side in aiml.py; a model, when one is
// configured, only rewords the summary sentence - it never produces a figure.

/** The metrics that can be analysed. */
export async function fetchMetrics(options = {}) {
  const rows = await apiClient.get("/analytics/metrics", options);
  return (rows ?? []).map((m) => ({
    metric: m.metric,
    label: m.label,
    unit: m.unit,
    module: m.module,
  }));
}

/** Trend, forecast, anomalies and a written summary for one metric. */
export async function fetchInsight(metric, months = 6, options = {}) {
  const d = await apiClient.get(
    `/analytics/insights?metric=${encodeURIComponent(metric)}&months=${months}`,
    options
  );
  return {
    metric: d.metric,
    label: d.label,
    unit: d.unit,
    series: (d.series ?? []).map((p) => ({ label: p.label, value: p.value ?? 0 })),
    trend: {
      direction: d.trend?.direction ?? "flat",
      changePct: d.trend?.change_pct ?? 0,
      slope: d.trend?.slope ?? 0,
    },
    forecast: (d.forecast ?? []).map((p) => ({ label: p.label, value: p.value ?? 0 })),
    anomalies: (d.anomalies ?? []).map((a) => ({
      label: a.label,
      value: a.value,
      kind: a.kind,
      zScore: a.z_score,
    })),
    summary: d.summary ?? "",
    // "llm" when a model reworded it, "template" when it is the deterministic
    // sentence. Worth showing: it tells you whether a model was involved.
    summarySource: d.summary_source ?? "template",
  };
}


/**
 * The few metrics that stand out - an unusual month, or a large swing.
 *
 * The ranking is done server-side across every metric, so this is one request
 * rather than one per metric, and a metric behaving normally is simply absent
 * rather than listed as "no change".
 */
export async function fetchAttention(months = 6, limit = 3, options = {}) {
  const rows = await apiClient.get(`/analytics/attention?months=${months}&limit=${limit}`, options);
  return (rows ?? []).map((r) => ({
    metric: r.metric,
    label: r.label,
    unit: r.unit,
    reason: r.reason,
    direction: r.direction,
    changePct: r.change_pct ?? 0,
    latest: r.latest ?? 0,
    forecast: r.next_period_forecast,
    headline: r.headline ?? null,
    headlineSource: r.headline_source ?? null,
  }));
}

