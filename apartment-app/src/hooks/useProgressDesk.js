import { useCallback, useEffect, useState } from "react";
import { fetchComplaintReport } from "../services/complaintReportService";
import { updateComplaintProgress } from "../services/complaintService";
import { isOffline } from "../services/apiClient";
import { useComplaints } from "../context/ComplaintContext";
import { COMPLAINT_STATUS, getStaffById } from "../features/complaints/mock/complaints";

/**
 * useProgressDesk - FE-16 / BE-16 (INT-16).
 *
 * Backs the Complaint Progress screen with live backend data:
 *   - the open, assigned complaints staff still have to work on, from
 *     GET /complaints/reports
 *   - PUT /complaints/{id}/progress to record a status change, which the API
 *     writes to the immutable audit trail and returns with its progress log;
 *     the row then re-displays the persisted status, note and timestamp, and a
 *     resolved/closed complaint drops off the desk.
 *
 * The acting employee is the complaint's assignee (assignedTo) - the staff
 * member the work belongs to - so the audit entry is attributed to a real,
 * active staff record without the client needing to know the viewer's staff id.
 *
 * Offline fallback: if the backend can't be reached (NetworkError) the hook
 * reads the mock complaints already in ComplaintContext and writes updates
 * locally through the context, so `npm run dev` stays usable without the API -
 * the same contract useAssignmentDesk follows. A backend that *answers* with an
 * error is surfaced through `error`, never papered over.
 *
 * @returns {{ rows, loading, offline, error, update, reload }}
 */
const OPEN_STATUSES = [COMPLAINT_STATUS.ASSIGNED, COMPLAINT_STATUS.IN_PROGRESS];
const DONE_STATUSES = [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED];

/** A complaint belongs on the progress desk while it is assigned and still open. */
function isActiveTask(status, assignedTo) {
  return OPEN_STATUSES.includes(status) && !!assignedTo;
}

/** Live report item -> the unified row shape the screen renders. */
function reportToRow(item) {
  return {
    id: item.id,
    reference: item.reference ?? item.id,
    category: item.category,
    description: item.description,
    location: item.location ?? null,
    raisedBy: item.raisedBy ?? null,
    status: item.status,
    assignedTo: item.assignedTo ?? null,
    assignedName: item.assignedName ?? null,
    updatedAt: item.updatedAt ?? item.createdAt ?? null,
    lastNote: null,
  };
}

/** Mock ComplaintContext complaint -> the same unified row shape (offline). */
function mockToRow(complaint) {
  const last = complaint.timeline?.[complaint.timeline.length - 1] ?? null;
  return {
    id: complaint.id,
    reference: complaint.reference ?? complaint.id,
    category: complaint.category,
    description: complaint.description,
    location: complaint.location ?? complaint.flat ?? null,
    raisedBy: complaint.residentName ?? null,
    status: complaint.status,
    assignedTo: complaint.assignedTo ?? null,
    assignedName: getStaffById(complaint.assignedTo)?.name ?? null,
    updatedAt: last?.at ?? complaint.createdAt ?? null,
    lastNote: last?.notes ?? null,
  };
}

export function useProgressDesk() {
  const { complaints, updateProgress: updateLocal } = useComplaints();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // One large page is plenty for a single society's open complaints.
      const report = await fetchComplaintReport({ pageSize: 100 });
      setRows(
        report.items
          .filter((item) => isActiveTask(item.status, item.assignedTo))
          .map(reportToRow)
      );
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setRows(
          complaints
            .filter((c) => isActiveTask(c.status, c.assignedTo))
            .map(mockToRow)
        );
        setOffline(true);
      } else {
        setRows([]);
        setError(err.detail ?? err.message);
      }
    } finally {
      setLoading(false);
    }
    // `complaints` only feeds the offline fallback; tracking it would refetch
    // from the API on every local edit. Intentionally read at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Record a progress update and re-display the persisted result.
   *
   * Online, the row is updated from the API response (the new status and the
   * audit-trail note/timestamp the server stored). Offline, the change is
   * written through ComplaintContext. Either way a complaint that reaches
   * resolved/closed drops off the desk. Throws on a backend error so the screen
   * can show the server's message.
   */
  const update = useCallback(
    async (complaintId, status, notes, byName) => {
      const dropIfDone = (list) =>
        list.filter((r) => !DONE_STATUSES.includes(r.status));

      if (offline) {
        updateLocal(complaintId, status, notes, byName);
        const now = new Date().toISOString();
        setRows((prev) =>
          dropIfDone(
            prev.map((r) =>
              r.id === complaintId
                ? { ...r, status, updatedAt: now, lastNote: notes || "Status updated" }
                : r
            )
          )
        );
        return { status };
      }

      const row = rows.find((r) => r.id === complaintId);
      const updated = await updateComplaintProgress(complaintId, {
        status,
        employeeId: row?.assignedTo,
        notes,
      });
      const last = updated.timeline?.[updated.timeline.length - 1] ?? null;
      setRows((prev) =>
        dropIfDone(
          prev.map((r) =>
            r.id === complaintId
              ? {
                  ...r,
                  status: updated.status,
                  updatedAt: last?.at ?? r.updatedAt,
                  lastNote: last?.notes ?? r.lastNote,
                }
              : r
          )
        )
      );
      return updated;
    },
    [offline, rows, updateLocal]
  );

  return { rows, loading, offline, error, update, reload: load };
}

export default useProgressDesk;
