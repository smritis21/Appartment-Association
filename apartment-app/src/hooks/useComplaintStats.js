import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_TREND_MONTHS,
  buildStatsFromComplaints,
  fetchComplaintStats,
} from "../services/complaintService";
import { isOffline } from "../services/apiClient";
import { useComplaints } from "../context/ComplaintContext";

/**
 * useComplaintStats - FE-07 / BE-07.
 *
 * Loads dashboard counts and trend data from GET /complaints/stats.
 *
 * Offline fallback: if the backend can't be reached (NetworkError) the hook
 * computes the identical payload from the mock complaints already in
 * ComplaintContext and flags `offline`, so `npm run dev` stays usable without
 * the API running - the same contract VisitorContext follows. A backend that
 * *does* answer with an error (422 on a bad window, 500) is a real answer and
 * is surfaced through `error` rather than being papered over with mock data.
 *
 * @param {number} months trend window in months (1–24)
 * @returns {{ stats, loading, offline, error, reload }}
 */
export function useComplaintStats(months = DEFAULT_TREND_MONTHS) {
  const { complaints } = useComplaints();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await fetchComplaintStats(months));
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setStats(buildStatsFromComplaints(complaints, months));
        setOffline(true);
      } else {
        setStats(null);
        setError(err.detail ?? err.message);
      }
    } finally {
      setLoading(false);
    }
    // `complaints` is intentionally read at call time rather than tracked as a
    // dependency: it only feeds the offline fallback, and adding it would
    // refetch from the API on every local complaint edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  useEffect(() => {
    load();
  }, [load]);

  // While offline, keep the numbers live against local edits - assigning a
  // complaint or updating its progress should still move the dashboard.
  useEffect(() => {
    if (offline) setStats(buildStatsFromComplaints(complaints, months));
  }, [offline, complaints, months]);

  return { stats, loading, offline, error, reload: load };
}

export default useComplaintStats;

