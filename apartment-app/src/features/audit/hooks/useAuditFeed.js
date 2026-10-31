import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAuditLogs } from "../../../services/auditService";
import { isOffline } from "../../../services/apiClient";

// Shared by AuditLogsPage, ActivityLogsPage and LoginLogsPage: polls audit
// logs every AUTO_REFRESH_MS and exposes an on-demand refresh, so a payment,
// bill, or login recorded after the page loaded shows up without a manual
// browser refresh.
const AUTO_REFRESH_MS = 20000;

/**
 * Fetch audit logs on mount, then keep them current by polling every
 * AUTO_REFRESH_MS and by exposing a `refresh()` a caller can wire to a
 * manual "Refresh" button. The interval is cleared on unmount.
 *
 * @param {object} filters - passed straight through to fetchAuditLogs()
 *   (module, action, actorId, targetId, dateFrom, dateTo, page, pageSize).
 * @param {(items: object[]) => object[]} [select] - optional client-side
 *   transform applied to the fetched items before they're stored (e.g.
 *   LoginLogsPage narrows to action === "user_login").
 */
export function useAuditFeed(filters = {}, select) {
  const [logs, setLogs] = useState(null);
  const [offline, setOffline] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Keep the latest filters/select in refs so the effect below can set up
  // its interval once (on mount) without re-subscribing every time the
  // caller passes a new filters object or select function by reference.
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const selectRef = useRef(select);
  selectRef.current = select;

  const load = useCallback(({ silent = false } = {}) => {
    if (!silent) setRefreshing(true);
    return fetchAuditLogs(filtersRef.current)
      .then((res) => {
        const items = selectRef.current ? selectRef.current(res.items) : res.items;
        setLogs(items);
        setOffline(false);
        setAuthError(false);
      })
      .catch((err) => {
        if (isOffline(err)) setOffline(true);
        else if (err.status === 401 || err.status === 403) setAuthError(true);
      })
      .finally(() => {
        if (!silent) setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(() => load({ silent: true }), AUTO_REFRESH_MS);
    return () => clearInterval(interval);
    // Intentionally runs once per mount - load() always reads the latest
    // filters/select via the refs above, so it doesn't need to be listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load]);

  return { logs, offline, authError, refreshing, refresh: () => load() };
}
