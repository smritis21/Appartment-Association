import { useCallback, useEffect, useState } from "react";
import {
  fetchWorkOrders,
  fetchWorkOrderStats,
  createWorkOrder as apiCreate,
  assignWorkOrder as apiAssign,
  updateWorkOrderStatus as apiUpdateStatus,
} from "../services/maintenanceService";
import { isOffline } from "../services/apiClient";
import {
  workOrders as mockOrders,
  getBoardStats,
  addWorkOrder as mockAdd,
  assignWorkOrder as mockAssign,
  advanceWorkOrder as mockAdvance,
  setWorkOrderStatus as mockSetStatus,
} from "../features/maintenance/mock/workOrders";

/**
 * useWorkOrders - INT-24
 *
 * Loads the work-order board and stats from the live API.
 * All mutations (create, assign, advance, complete) call the API in online mode
 * and fall back to the in-memory mock singleton in offline mode.
 */
export function useWorkOrders(filters = {}) {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ total: 0, open: 0, overdue: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, s] = await Promise.all([fetchWorkOrders(filters), fetchWorkOrderStats()]);
      setOrders(data);
      setStats(s);
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setOrders([...mockOrders]);
        setStats(getBoardStats());
        setOffline(true);
      } else {
        setError(err.detail ?? err.message);
      }
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  const createWorkOrder = useCallback(async (data) => {
    if (offline) {
      const created = mockAdd(data);
      setOrders([...mockOrders]);
      setStats(getBoardStats());
      return { ok: true, order: created };
    }
    try {
      await apiCreate(data);
      await load();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.detail ?? err.message };
    }
  }, [offline, load]);

  const assignWorkOrder = useCallback(async (workOrderId, staffId) => {
    if (offline) {
      mockAssign(workOrderId, staffId);
      setOrders([...mockOrders]);
      return { ok: true };
    }
    try {
      await apiAssign(workOrderId, staffId);
      await load();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.detail ?? err.message };
    }
  }, [offline, load]);

  const advanceWorkOrder = useCallback(async (workOrderId) => {
    if (offline) {
      mockAdvance(workOrderId);
      setOrders([...mockOrders]);
      setStats(getBoardStats());
      return { ok: true };
    }
    // Determine next status by looking at current order
    const order = orders.find((o) => o.id === workOrderId);
    const nextStatus = {
      open: "assigned",
      assigned: "in_progress",
    }[order?.status];
    if (!nextStatus) return { ok: false, error: "Cannot advance from this status" };
    try {
      await apiUpdateStatus(workOrderId, nextStatus, null);
      await load();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.detail ?? err.message };
    }
  }, [offline, load, orders]);

  const completeWorkOrder = useCallback(async (workOrderId, outcome) => {
    if (offline) {
      mockSetStatus(workOrderId, "completed", outcome);
      setOrders([...mockOrders]);
      setStats(getBoardStats());
      return { ok: true };
    }
    try {
      await apiUpdateStatus(workOrderId, "completed", outcome);
      await load();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.detail ?? err.message };
    }
  }, [offline, load]);

  return {
    orders, stats, loading, offline, error,
    reload: load, createWorkOrder, assignWorkOrder, advanceWorkOrder, completeWorkOrder,
  };
}

export default useWorkOrders;

