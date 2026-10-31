import { useCallback, useEffect, useState } from "react";
import {
  fetchShifts,
  allocateShift as apiAllocate,
  fetchAttendance,
  markAttendance as apiMark,
} from "../services/staffShiftService";
import { isOffline } from "../services/apiClient";
import { assignments as mockAssignments } from "../features/staffing/mock/roster";
import { staff as mockStaff } from "../features/staffing/mock/staff";
import { attendance as mockAttendance } from "../features/staffing/mock/attendance";

/**
 * useStaffShifts - INT-35
 *
 * Loads shifts and attendance records for a given date from the live API.
 * Mutations (allocateShift, markAttendance) call the API and reload on success.
 * Offline fallback: serves the mock singleton data so pages render without backend.
 */
export function useStaffShifts(date) {
  const [shifts, setShifts] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    setError(null);
    try {
      const [shiftData, attData] = await Promise.all([
        fetchShifts({ shiftDate: date, limit: 200 }),
        fetchAttendance({ dateFrom: date, dateTo: date, limit: 200 }),
      ]);
      setShifts(shiftData);
      setAttendanceRecords(attData);
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        // Offline: filter mock data for the selected date
        setShifts(mockAssignments.filter((a) => a.date === date));
        // The attendance mock uses a different shape; return raw for components
        setAttendanceRecords(
          (mockAttendance ?? []).filter((a) => a.date === date)
        );
        setOffline(true);
      } else {
        setError(err.detail ?? err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => { load(); }, [load]);

  const allocateShift = useCallback(async (data) => {
    try {
      await apiAllocate(data);
      await load();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.detail ?? err.message };
    }
  }, [load]);

  const markAttendance = useCallback(async (data) => {
    try {
      await apiMark(data);
      await load();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.detail ?? err.message };
    }
  }, [load]);

  // Expose the static staff list for UI rendering (comes from mock; no staff CRUD endpoint in scope)
  const staffList = mockStaff;

  return {
    shifts, attendanceRecords, staffList,
    loading, offline, error,
    reload: load, allocateShift, markAttendance,
  };
}

export default useStaffShifts;

