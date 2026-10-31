import { useCallback, useEffect, useState } from "react";
import {
  fetchFacilities,
  fetchAvailability,
  createFacilityBooking,
  cancelFacilityBooking,
  fetchFacilityBookings,
} from "../services/facilityService";
import { isOffline } from "../services/apiClient";
import { FACILITIES as mockFacilities } from "../features/facilities/mock/facilities";
import {
  facilityBookings as mockBookings,
  addBooking as mockAdd,
  cancelBooking as mockCancel,
  getBookingsForUser as mockGetForUser,
} from "../features/facilities/mock/bookings";

/**
 * useFacilities - INT-32
 *
 * Fetches the live facilities list. Slot availability is fetched on demand
 * when the user selects a facility + date. Book/cancel mutations call the API
 * and reload. Offline fallback serves the mock static data.
 */
export function useFacilities() {
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFacilities();
      setFacilities(data);
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setFacilities(mockFacilities ?? []);
        setOffline(true);
      } else {
        setError(err.detail ?? err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { facilities, loading, offline, error, reload: load };
}

/**
 * useFacilityBookings - gets bookings for the current user across all facilities.
 * In online mode queries each facility in parallel; offline falls back to mock.
 */
export function useFacilityBookings(facilityIds, user) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!facilityIds?.length) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const results = await Promise.all(
        facilityIds.map((id) =>
          fetchFacilityBookings(id, { residentId: user?.id }).catch(() => [])
        )
      );
      setBookings(results.flat());
      setOffline(false);
    } catch {
      setBookings(mockGetForUser(user) ?? []);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [facilityIds, user]);

  useEffect(() => { load(); }, [load]);

  return { bookings, loading, offline, reload: load };
}

export { fetchAvailability, createFacilityBooking, cancelFacilityBooking };
export default useFacilities;

