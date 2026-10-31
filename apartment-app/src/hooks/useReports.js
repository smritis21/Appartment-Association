import { useCallback, useEffect, useState } from "react";
import {
  fetchSummary,
  fetchPaymentsReport,
  fetchResidentsReport,
  fetchVisitorsReport,
  fetchMaintenanceReport,
} from "../services/reportsService";
import { isOffline } from "../services/apiClient";
import apiClient from "../services/apiClient";
import { fetchComplaintStats } from "../services/complaintService";
import { fetchAttention } from "../services/reportsService";
import {
  MONTHLY_PAYMENTS,
  MONTHLY_VISITORS,
  FACILITY_USAGE,
  MAINTENANCE_SUMMARY,
  sliceRange,
} from "../features/reports/mock/analytics";

/**
 * useReports - INT-36: Integrate Reports and Analytics
 *
 * Fetches consolidated metrics from /reports/* endpoints.
 * Offline fallback uses mock analytics data.
 */
export function useReports(rangeMonths = 6) {
  const [summary, setSummary] = useState(null);
  const [payments, setPayments] = useState(null);
  const [residents, setResidents] = useState(null);
  const [visitors, setVisitors] = useState(null);
  const [maintenance, setMaintenance] = useState(null);
  // Complaint figures do not come from /reports/summary - that endpoint
  // reports residents, payments and visitors only. They have their own
  // endpoint, which is why the complaint tiles read zero until it is called.
  const [complaints, setComplaints] = useState(null);
  const [facilityUsage, setFacilityUsage] = useState([]);
  const [attention, setAttention] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Compute date_from based on rangeMonths
    const now = new Date();
    const fromDate = new Date(now.getFullYear(), now.getMonth() - rangeMonths, 1);
    const dateFrom = fromDate.toISOString().split("T")[0];
    const dateTo = now.toISOString().split("T")[0];
    const horizon = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
    const maintenanceHorizon = horizon.toISOString().split("T")[0];

    try {
      const [sumRes, payRes, resRes, visRes, maintRes, statsRes] = await Promise.all([
        fetchSummary(dateFrom, dateTo),
        fetchPaymentsReport(dateFrom, dateTo),
        fetchResidentsReport(dateFrom, dateTo),
        fetchVisitorsReport(dateFrom, dateTo),
        // Maintenance is forward-looking: a window ending today counts none
        // of the work that is actually coming up, which read as "0/0" while
        // jobs sat on the schedule. The horizon is extended for this one.
        fetchMaintenanceReport(dateFrom, maintenanceHorizon),
        fetchComplaintStats(rangeMonths),
      ]);

      try {
        setAttention(await fetchAttention(rangeMonths, 3));
      } catch {
        setAttention([]);
      }

      // The reports endpoints total a window; the analytics layer is what
      // carries a month-by-month series, so the charts read from there.
      const series = async (metric) => {
        try {
          const insight = await apiClient.get(
            `/analytics/insights?metric=${metric}&months=${rangeMonths}`
          );
          return (insight?.series ?? []).map((point) => ({
            label: point.label,
            value: point.value ?? 0,
          }));
        } catch {
          return [];
        }
      };
      const [paySeries, visitSeries] = await Promise.all([
        series("payments_collected"),
        series("visitors_total"),
      ]);

      setSummary(sumRes);
      setPayments({ ...payRes, byMonth: paySeries });
      setResidents(resRes);
      setVisitors({ ...visRes, byMonth: visitSeries });
      setMaintenance(maintRes);
      setComplaints(statsRes);

      // Real usage per facility, counted from bookings. There is no
      // society-wide bookings report, so each facility is asked for its own -
      // a handful of small requests rather than a chart of invented numbers.
      try {
        const facilities = await apiClient.get("/facilities");
        const usage = await Promise.all(
          (facilities ?? []).map(async (f) => {
            const bookings = await apiClient.get(`/facilities/${f.facility_id}/bookings`);
            return { label: f.name, value: (bookings ?? []).length };
          })
        );
        setFacilityUsage(usage);
      } catch {
        setFacilityUsage([]);
      }
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setSummary({
          totalResidents: 142,
          activeComplaints: 3,
          resolvedComplaints: 28,
          paymentsCollected: 3439000,
          overduePayments: 42000,
          visitorEntries: 2355,
          maintenanceScheduled: 14,
          maintenanceCompleted: 11,
        });
        setPayments({
          byMonth: sliceRange(MONTHLY_PAYMENTS, rangeMonths),
          totalCollected: 3439000,
        });
        setResidents({ total: 142, active: 138, occupancyPct: 92 });
        setVisitors({
          byMonth: sliceRange(MONTHLY_VISITORS, rangeMonths),
          totalEntries: 2355,
        });
        setMaintenance(MAINTENANCE_SUMMARY);
        setOffline(true);
      } else {
        setError(err.detail ?? err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [rangeMonths]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    summary,
    payments,
    residents,
    visitors,
    maintenance,
    complaints,
    attention,
    facilityUsage,
    loading,
    offline,
    error,
    reload: load,
  };
}

export default useReports;

