import { useCallback, useState } from "react";
import { broadcastEmergencyAlert } from "../services/alertService";
import { isOffline } from "../services/apiClient";
import { useAuth } from "./useAuth";

/**
 * useEmergencyBroadcast - FE-19 / BE-19.
 *
 * Sends an emergency alert through POST /alerts/emergency and hands back the
 * per-recipient delivery result so the confirmation screen can report what
 * actually happened rather than an optimistic "sent!".
 *
 * Offline fallback: if the backend is unreachable the hook synthesises a
 * result and flags `offline`, so the prototype still demonstrates the flow
 * without the API running - the same contract VisitorContext and
 * useComplaintStats follow. A backend that *does* answer with an error (400
 * unknown block, 422 validation) is a real answer and is returned through
 * `error`; we never pretend an alert went out when the server refused it.
 *
 * This one deliberately does not fetch on mount - broadcasting is an
 * explicit, destructive action, so it only ever runs when `send` is called.
 */
export function useEmergencyBroadcast() {
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [sending, setSending] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);

  const send = useCallback(
    async ({ title, message, target = "all" }) => {
      setSending(true);
      setError(null);
      try {
        const alert = await broadcastEmergencyAlert({
          title,
          message,
          target,
          raisedBy: user?.residentId ?? user?.resident_id ?? undefined,
        });
        setResult(alert);
        setOffline(false);
        return alert;
      } catch (err) {
        if (isOffline(err)) {
          // No backend: report the broadcast as unconfirmed rather than
          // claiming delivery counts we have no basis for.
          const fallback = {
            id: null,
            title,
            message,
            severity: "emergency",
            targetBlock: null,
            recipientCount: 0,
            sentCount: 0,
            failedCount: 0,
            createdAt: new Date().toISOString(),
            deliveries: [],
          };
          setResult(fallback);
          setOffline(true);
          return fallback;
        }
        setResult(null);
        setError(err.detail ?? err.message);
        return null;
      } finally {
        setSending(false);
      }
    },
    [user]
  );

  /** Clear the last result so the compose form can be shown again. */
  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setOffline(false);
  }, []);

  return { send, reset, result, sending, offline, error };
}

export default useEmergencyBroadcast;

