import { useCallback, useEffect, useState } from "react";
import {
  fetchHouseHelp,
  fetchBookings,
  fetchHouseHelpAttendance,
  fetchProviders,
  fetchProviderJobs,
  updateBookingStatus as apiUpdateBookingStatus,
  updateJobStatus as apiUpdateJobStatus,
} from "../services/workforceService";
import { isOffline } from "../services/apiClient";
import { houseHelpBookings } from "../features/workforce/mock/bookings";
import { attendanceLogs } from "../features/workforce/mock/attendance";
import { HOUSE_HELP as mockHouseHelp } from "../features/workforce/mock/houseHelp";
import {
  serviceJobs as mockJobs,
  SERVICE_PROVIDERS as mockProviders,
} from "../features/workforce/mock/serviceProviders";

/**
 * useWorkforce - INT-26
 *
 * Loads all workforce data (house help, bookings, attendance, providers, jobs)
 * from the live API. Falls back to mock data when the backend is unreachable.
 */
export function useWorkforce() {
  const [houseHelp, setHouseHelp] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [providers, setProviders] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [hh, bk, att, prov, jobList] = await Promise.all([
        fetchHouseHelp(),
        fetchBookings(),
        fetchHouseHelpAttendance(),
        fetchProviders(),
        fetchProviderJobs(),
      ]);
      setHouseHelp(hh);
      setBookings(bk);
      setAttendance(att);
      setProviders(prov);
      setJobs(jobList);
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setHouseHelp(mockHouseHelp ?? []);
        setBookings(houseHelpBookings ?? []);
        setAttendance(attendanceLogs ?? []);
        setProviders(mockProviders ?? []);
        setJobs(mockJobs ?? []);
        setOffline(true);
      } else {
        setError(err.detail ?? err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateBookingStatus = useCallback(async (bookingId, status) => {
    try {
      await apiUpdateBookingStatus(bookingId, status);
      await load();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.detail ?? err.message };
    }
  }, [load]);

  const updateJobStatus = useCallback(async (jobId, status) => {
    try {
      await apiUpdateJobStatus(jobId, status);
      await load();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.detail ?? err.message };
    }
  }, [load]);

  return {
    houseHelp, bookings, attendance, providers, jobs,
    loading, offline, error,
    reload: load, updateBookingStatus, updateJobStatus,
  };
}

export default useWorkforce;

