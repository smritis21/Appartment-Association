import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  clearAll as clearAllApi,
  fetchNotifications,
  markAllRead as markAllReadApi,
  markRead as markReadApi,
} from "../services/notificationService";
import { isOffline } from "../services/apiClient";
import { useAuthContext } from "./AuthContext";
import {
  getNotifications as getMockNotifications,
  markNotificationRead as markMockRead,
  markAllNotificationsRead as markAllMockRead,
  clearAllNotifications as clearAllMock,
} from "../features/communication/mock/communicationData";

/**
 * One source of truth for a resident's notifications.
 *
 * The navbar bell and the notification centre are separate components showing
 * the same data. While each kept its own copy, clearing the list on the centre
 * left the bell still advertising unread items until it was next opened. They
 * now share this state, so an action in either place is reflected in both.
 *
 * Notifications belong to a resident record rather than a login, and not every
 * account has one (staff, for instance). Without a `residentId` there is
 * nothing to fetch, which is a normal empty state and not an error.
 */
const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuthContext();
  const residentId = user?.residentId;

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!residentId) {
      setNotifications([]);
      setOffline(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { notifications: rows } = await fetchNotifications(residentId, { limit: 100 });
      setNotifications(rows);
      setOffline(false);
      setError("");
    } catch (err) {
      if (isOffline(err)) {
        // Keep the screens demonstrable when the server is down, and say so.
        setNotifications(getMockNotifications());
        setOffline(true);
        setError("");
      } else {
        setNotifications([]);
        setOffline(false);
        setError(err?.message || "Could not load notifications.");
      }
    } finally {
      setLoading(false);
    }
  }, [residentId]);

  useEffect(() => { refresh(); }, [refresh]);

  const markRead = useCallback(async (id) => {
    if (offline) {
      markMockRead(id);
      setNotifications(getMockNotifications());
      return;
    }
    // Reflect the tap immediately, then confirm against the server; the
    // re-read afterwards corrects the row if the call did not take.
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try {
      await markReadApi(residentId, id);
    } finally {
      refresh();
    }
  }, [offline, residentId, refresh]);

  const markAllRead = useCallback(async () => {
    if (offline) {
      markAllMockRead();
      setNotifications(getMockNotifications());
      return;
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await markAllReadApi(residentId);
    } finally {
      refresh();
    }
  }, [offline, residentId, refresh]);

  const clearAll = useCallback(async () => {
    if (offline) {
      clearAllMock();
      setNotifications(getMockNotifications());
      return { deleted: 0 };
    }
    // Clearing throws the list away, so it is only shown as gone once the
    // server confirms it happened.
    try {
      const result = await clearAllApi(residentId);
      return result ?? { deleted: 0 };
    } finally {
      refresh();
    }
  }, [offline, residentId, refresh]);

  const value = useMemo(() => ({
    notifications,
    unreadCount: notifications.filter((n) => !n.read).length,
    loading,
    offline,
    error,
    hasResident: Boolean(residentId),
    refresh,
    markRead,
    markAllRead,
    clearAll,
    dismissError: () => setError(""),
  }), [notifications, loading, offline, error, residentId, refresh, markRead, markAllRead, clearAll]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used inside NotificationProvider");
  return ctx;
}

export default NotificationContext;
