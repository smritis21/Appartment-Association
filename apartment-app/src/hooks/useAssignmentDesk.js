import { useCallback, useEffect, useState } from "react";
import { fetchComplaintReport } from "../services/complaintReportService";
import { assignComplaint, fetchAssignableStaff } from "../services/complaintService";
import { isOffline } from "../services/apiClient";
import { useComplaints } from "../context/ComplaintContext";
import {
  COMPLAINT_STATUS,
  mockStaff,
  getStaffById,
} from "../features/complaints/mock/complaints";

/**
 * useAssignmentDesk - FE-06 / BE-06 (INT-06).
 *
 * Backs the Complaint Assignment screen with live backend data:
 *   - open complaints from GET /complaints/reports
 *   - the assignable staff list from GET /staff/workload
 *   - PUT /complaints/{id}/assign to allocate, then re-display the persisted
 *     staff name and timestamp the API returns.
 *
 * Offline fallback: if the backend can't be reached (NetworkError) the hook
 * reads the mock complaints already in ComplaintContext and the mock staff
 * list, and assignment writes locally through the context - so `npm run dev`
 * stays usable without the API, the same contract useComplaintStats follows.
 * A backend that *answers* with an error is surfaced, never papered over.
 *
 * @returns {{ rows, staff, loading, offline, error, assign, reload }}
 */
const OPEN_STATUSES = [
  COMPLAINT_STATUS.SUBMITTED,
  COMPLAINT_STATUS.ASSIGNED,
  COMPLAINT_STATUS.IN_PROGRESS,
];

function isOpen(status) {
  return OPEN_STATUSES.includes(status);
}

/** Last time a mock complaint was moved to "assigned", for the offline view. */
function lastAssignedAt(complaint) {
  const entry = [...(complaint.timeline ?? [])]
    .reverse()
    .find((t) => t.status === COMPLAINT_STATUS.ASSIGNED);
  return entry?.at ?? null;
}

/** Mock ComplaintContext complaint -> the unified row shape the screen renders. */
function mockToRow(complaint) {
  return {
    id: complaint.id,
    category: complaint.category,
    description: complaint.description,
    location: complaint.location ?? complaint.flat ?? null,
    raisedBy: complaint.residentName ?? null,
    status: complaint.status,
    assignedTo: complaint.assignedTo ?? null,
    assignedName: getStaffById(complaint.assignedTo)?.name ?? null,
    assignedAt: complaint.assignedTo ? lastAssignedAt(complaint) : null,
  };
}

export function useAssignmentDesk() {
  const { complaints, assignComplaint: assignLocal } = useComplaints();
  const [rows, setRows] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // One large page is plenty for a single society's open complaints.
      const [report, staffList] = await Promise.all([
        fetchComplaintReport({ pageSize: 100 }),
        fetchAssignableStaff(),
      ]);
      setRows(report.items.filter((item) => isOpen(item.status)));
      setStaff(staffList);
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setRows(complaints.filter((c) => isOpen(c.status)).map(mockToRow));
        setStaff(mockStaff.map((s) => ({ id: s.id, name: s.name, role: s.specialization })));
        setOffline(true);
      } else {
        setRows([]);
        setStaff([]);
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
   * Assign a complaint and re-display the persisted result.
   *
   * Online, the row is updated from the API response (assigned_to, the resolved
   * staff name, and the server-stamped assigned_at). Offline, the assignment is
   * written through ComplaintContext and reflected locally. Throws on a backend
   * error so the screen can show the server's message.
   */
  const assign = useCallback(
    async (complaintId, staffId, assignedBy) => {
      if (offline) {
        assignLocal(complaintId, staffId, assignedBy);
        const name = staff.find((s) => s.id === staffId)?.name ?? null;
        const now = new Date().toISOString();
        setRows((prev) =>
          prev.map((r) =>
            r.id === complaintId
              ? {
                  ...r,
                  assignedTo: staffId,
                  assignedName: name,
                  assignedAt: now,
                  status:
                    r.status === COMPLAINT_STATUS.SUBMITTED
                      ? COMPLAINT_STATUS.ASSIGNED
                      : r.status,
                }
              : r
          )
        );
        return { assignedStaffName: name, assignedAt: now };
      }

      const result = await assignComplaint(complaintId, staffId, assignedBy);
      setRows((prev) =>
        prev.map((r) =>
          r.id === complaintId
            ? {
                ...r,
                assignedTo: result.assignedTo,
                assignedName: result.assignedStaffName,
                assignedAt: result.assignedAt,
                status: result.status,
              }
            : r
        )
      );
      return result;
    },
    [offline, staff, assignLocal]
  );

  return { rows, staff, loading, offline, error, assign, reload: load };
}

export default useAssignmentDesk;
