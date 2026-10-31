import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  fetchVisitorRequests,
  submitVisitorDecision,
} from "../services/visitorService";
import { isOffline } from "../services/apiClient";
import { useAuthContext } from "./AuthContext";
import {
  mockVisitorRequests,
  VISITOR_STATUS,
  GATE_DESKS,
} from "../features/visitors/mock/visitors";

/**
 * VisitorContext - FE-05 / BE-05.
 *
 * Loads visitor requests from the backend and records approve / reject /
 * left_at_gate decisions through POST /visitors/{id}/decision.
 *
 * Offline fallback: if the backend can't be reached (NetworkError) the
 * provider drops into `offline` mode and serves the existing mock data,
 * applying decisions locally. That keeps `npm run dev` usable without the
 * API running, which is how the rest of the app currently works. A backend
 * that *does* answer with an error (409 duplicate, 400 expired) is a real
 * answer and is surfaced to the user - we never silently fall back on those.
 */

const VisitorContext = createContext(null);

// Normalise the mock records to the same shape the service layer returns.
function normaliseMock(record) {
  return {
    decision: record.status === VISITOR_STATUS.PENDING ? null : record.status,
    decidedBy: null,
    notes: null,
    collectedBy: null,
    pickupLocation: null,
    ...record,
  };
}

export function VisitorProvider({ children }) {
  const { user } = useAuthContext();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const residentId = user?.residentId ?? user?.resident_id ?? null;

  const load = useCallback(async (residentId) => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchVisitorRequests(residentId);
      setRequests(data);
      setOffline(false);
    } catch (error) {
      if (isOffline(error)) {
        // Backend not running - fall back to mock data.
        setRequests(mockVisitorRequests.map(normaliseMock));
        setOffline(true);
      } else {
        setRequests([]);
        setLoadError(error.detail ?? error.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!residentId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    load(residentId);
  }, [load, residentId]);

  /** Apply a decision to the local list without a round trip (offline mode). */
  const applyLocally = useCallback((visitorId, decision) => {
    let updated = null;
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id !== visitorId) return r;
        const desk = GATE_DESKS[r.gate] ?? {};
        updated = {
          ...r,
          status: decision,
          decision,
          decidedAt: new Date().toISOString(),
          ...(decision === VISITOR_STATUS.LEFT_AT_GATE
            ? {
                collectedBy: desk.guard ?? "Gate Security",
                pickupLocation: desk.desk ?? r.gate,
              }
            : {}),
        };
        return updated;
      })
    );
    return updated;
  }, []);

  /**
   * Record a decision.
   *
   * Resolves to { ok: true, request } on success, or
   * { ok: false, error, status } when the backend rejected it - the caller
   * shows `error` in a snackbar. A duplicate (409) also refreshes the list so
   * the UI stops showing a request that someone else already decided.
   */
  const decide = useCallback(
    async (visitorId, decision, { decidedBy, notes } = {}) => {
      if (offline) {
        const local = applyLocally(visitorId, decision);
        return { ok: true, request: local, offline: true };
      }

      try {
        const updated = await submitVisitorDecision(visitorId, decision, {
          decidedBy,
          notes,
        });
        setRequests((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        return { ok: true, request: updated };
      } catch (error) {
        if (isOffline(error)) {
          const local = applyLocally(visitorId, decision);
          setOffline(true);
          return { ok: true, request: local, offline: true };
        }
        if (error.status === 409 || error.status === 404) {
          // Someone else already decided it (or it's gone) - resync.
          load();
        }
        return {
          ok: false,
          status: error.status,
          error: error.detail ?? error.message,
        };
      }
    },
    [offline, applyLocally, load]
  );

  const getRequestById = useCallback(
    (id) => requests.find((r) => r.id === id) ?? null,
    [requests]
  );

  return (
    <VisitorContext.Provider
      value={{ requests, loading, offline, loadError, load, decide, getRequestById }}
    >
      {children}
    </VisitorContext.Provider>
  );
}

export function useVisitors() {
  const ctx = useContext(VisitorContext);
  if (!ctx) throw new Error("useVisitors must be used within VisitorProvider");
  return ctx;
}

export default VisitorContext;

