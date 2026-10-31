import { useCallback, useEffect, useState } from "react";
import {
  fetchSchedules,
  createSchedule as apiCreateSchedule,
} from "../services/maintenanceService";
import { isOffline } from "../services/apiClient";
import { getEventsSorted, addScheduledEvent as mockAdd } from "../features/maintenance/mock/scheduledEvents";

/**
 * useMaintenanceSchedule - INT-17
 *
 * Loads the maintenance schedule list from GET /maintenance/schedule.
 * Mutations (create) call the live API; on success the list is reloaded.
 * Offline fallback: serves the mock list and routes mutations through the
 * in-memory singleton so the UI stays functional without the backend.
 */
export function useMaintenanceSchedule() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSchedules();
      // Sort by date+time ascending (same as mock)
      setEvents(data.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setEvents(getEventsSorted());
        setOffline(true);
      } else {
        setError(err.detail ?? err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createSchedule = useCallback(async (data) => {
    if (offline) {
      // In-memory mutation for offline mode
      const created = mockAdd(data);
      setEvents(getEventsSorted());
      return { ok: true, event: created };
    }
    try {
      await apiCreateSchedule(data);
      await load(); // reload list from API
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.detail ?? err.message };
    }
  }, [offline, load]);

  return { events, loading, offline, error, reload: load, createSchedule };
}

export default useMaintenanceSchedule;

