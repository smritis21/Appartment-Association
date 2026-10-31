import { useCallback, useEffect, useState } from "react";
import { fetchWorkload } from "../services/maintenanceService";
import { isOffline } from "../services/apiClient";
import { getStaffWorkload, getWorkloadSummary } from "../features/maintenance/mock/workload";

/**
 * useWorkload - INT-15
 *
 * Fetches staff workload from GET /staff/workload.
 * Offline fallback: computes the same shape from the mock work-order data so
 * the dashboard stays usable without the backend running.
 */
export function useWorkload() {
  const [rows, setRows] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWorkload();
      setRows(data);
      // Compute summary totals from the live rows
      const active    = data.reduce((s, r) => s + r.active, 0);
      const completed = data.reduce((s, r) => s + r.completed, 0);
      const overdue   = data.reduce((s, r) => s + r.overdue, 0);
      setSummary({ staffCount: data.length, active, completed, overdue });
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        // Fall back to local mock computation
        const mockRows    = getStaffWorkload();
        const mockSummary = getWorkloadSummary();
        setRows(mockRows);
        setSummary(mockSummary);
        setOffline(true);
      } else {
        setRows(null);
        setSummary(null);
        setError(err.detail ?? err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { rows, summary, loading, offline, error, reload: load };
}

export default useWorkload;

