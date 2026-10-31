import { useCallback, useState } from "react";
import { submitFeedback } from "../services/feedbackService";
import { isOffline } from "../services/apiClient";
import { useAuth } from "./useAuth";
import { useComplaints } from "../context/ComplaintContext";

/**
 * useComplaintFeedback - FE-20 / BE-20.
 *
 * Submits a rating through POST /complaints/{id}/feedback.
 *
 * Offline fallback: if the backend is unreachable the rating is applied to the
 * local ComplaintContext instead and `offline` is flagged, so the prototype
 * still demonstrates the flow without the API running. That is safe here in a
 * way it was not for the emergency broadcast (FE-19) - recording a rating
 * locally misleads nobody, whereas claiming a fire alarm went out would.
 *
 * A backend that answers with an error is never papered over: 400 (not
 * resolved), 409 (already rated) and 410 (window closed) all surface through
 * `error` so the user is told which rule they hit.
 *
 * Does not fetch on mount - submitting is an explicit user action.
 */
export function useComplaintFeedback() {
  const { user } = useAuth();
  const { addFeedback } = useComplaints();
  const [submitting, setSubmitting] = useState(false);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);

  const submit = useCallback(
    async (complaintId, { rating, comment }) => {
      setSubmitting(true);
      setError(null);
      try {
        const saved = await submitFeedback(complaintId, {
          rating,
          comment,
          submittedBy: user?.residentId ?? user?.resident_id ?? undefined,
        });
        // Keep the local list in step so the rated complaint drops out of the
        // "still to rate" list without a refetch.
        addFeedback(complaintId, rating, comment?.trim() ?? "");
        setOffline(false);
        return saved;
      } catch (err) {
        if (isOffline(err)) {
          addFeedback(complaintId, rating, comment?.trim() ?? "");
          setOffline(true);
          return {
            id: null,
            complaintId,
            rating,
            comment: comment?.trim() || null,
            submittedBy: null,
            submittedAt: new Date().toISOString(),
          };
        }
        setError(err.detail ?? err.message);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [addFeedback, user]
  );

  const clearError = useCallback(() => setError(null), []);

  return { submit, submitting, offline, error, clearError };
}

export default useComplaintFeedback;

