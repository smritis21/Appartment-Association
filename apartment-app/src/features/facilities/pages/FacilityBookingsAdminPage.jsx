import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import PageHeader from "../../../components/common/PageHeader";
import EmptyState from "../../../components/common/EmptyState";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { useFacilities } from "../../../hooks/useFacilities";
import { fetchFacilityBookings } from "../../../services/facilityService";
import { fetchResidents } from "../../../services/residentService";
import { FACILITIES as mockFacilities } from "../mock/facilities";
import { facilityBookings as mockFacilityBookings, BOOKING_STATUS } from "../mock/bookings";
import { ROLE_LABELS } from "../../../constants/roles";
import { formatDate, formatDateTime } from "../../../utils/formatDate";

// Management-only view: every facility booking in the society, showing who
// booked what, which slot and when it was raised. Read-only register for the
// Secretary / committee.
//
// Fetches live bookings for every active facility plus the resident directory
// (to resolve resident_id -> name/flat/role), and falls back to the static
// mock data if the backend is unreachable - same dual-path pattern used by
// the resident-facing facility/temple/visitor pages.
export default function FacilityBookingsAdminPage() {
  const { facilities, loading: facilitiesLoading, offline: facilitiesOffline } = useFacilities();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [facilityFilter, setFacilityFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    if (facilitiesLoading) return;
    setLoading(true);
    try {
      if (facilitiesOffline || !facilities.length) throw new Error("Facilities unavailable");

      const [residents, ...bookingLists] = await Promise.all([
        fetchResidents({ limit: 500 }),
        ...facilities.map((f) => fetchFacilityBookings(f.id)),
      ]);
      const residentById = new Map(residents.map((r) => [r.id, r]));
      const facilityById = new Map(facilities.map((f) => [f.id, f]));

      const combined = bookingLists.flat().map((b) => {
        const resident = residentById.get(b.residentId);
        const facility = facilityById.get(b.facilityId);
        return {
          id: b.id,
          facilityId: b.facilityId,
          facilityName: facility?.name ?? b.facilityId,
          date: b.date,
          time: b.time,
          bookedBy: resident?.name ?? b.residentId ?? "-",
          flat: resident ? `${resident.wing}-${resident.flat}` : "-",
          role: resident?.role ?? "-",
          status: b.status,
          createdAt: b.createdAt,
        };
      });
      setRows(combined);
      setOffline(false);
    } catch {
      setRows([...mockFacilityBookings]);
      setOffline(true);
    } finally {
      setLoading(false);
    }
  }, [facilities, facilitiesLoading, facilitiesOffline]);

  useEffect(() => { load(); }, [load]);

  const facilityOptions = offline || facilitiesOffline || !facilities.length ? mockFacilities : facilities;

  const visibleRows = useMemo(() => {
    return [...rows]
      .filter((b) => facilityFilter === "all" || b.facilityId === facilityFilter)
      .filter((b) => statusFilter === "all" || b.status === statusFilter)
      .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
  }, [rows, facilityFilter, statusFilter]);

  const confirmedCount = rows.filter((b) => b.status === BOOKING_STATUS.CONFIRMED).length;

  return (
    <Box>
      <PageHeader
        title="Facility Bookings"
        subtitle="Every gym, pool and court reservation across the society"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Facility Bookings" },
        ]}
      />

      {loading ? (
        <LoadingSpinner message="Loading facility bookings..." />
      ) : (
        <>
          {/* Summary tiles */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <StatTile label="Total bookings" value={rows.length} />
            <StatTile label="Confirmed" value={confirmedCount} />
            <StatTile label="Facilities" value={facilityOptions.length} />
          </Grid>

          {/* Filters */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="fac-filter">Facility</InputLabel>
              <Select
                labelId="fac-filter"
                label="Facility"
                value={facilityFilter}
                onChange={(e) => setFacilityFilter(e.target.value)}
              >
                <MenuItem value="all">All facilities</MenuItem>
                {facilityOptions.map((f) => (
                  <MenuItem key={f.id} value={f.id}>
                    {f.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel id="status-filter">Status</InputLabel>
              <Select
                labelId="status-filter"
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value={BOOKING_STATUS.CONFIRMED}>Confirmed</MenuItem>
                <MenuItem value={BOOKING_STATUS.CANCELLED}>Cancelled</MenuItem>
              </Select>
            </FormControl>
          </Box>

          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
            {visibleRows.length === 0 ? (
              <EmptyState
                icon={EventNoteOutlinedIcon}
                title="No bookings match"
                description="Try clearing the facility or status filter."
              />
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ "& th": { fontWeight: 700, color: "text.secondary" } }}>
                      <TableCell>Reference</TableCell>
                      <TableCell>Facility</TableCell>
                      <TableCell>Booked by</TableCell>
                      <TableCell>Flat</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Time slot</TableCell>
                      <TableCell>Booked on</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {visibleRows.map((b) => (
                      <TableRow key={b.id} hover>
                        <TableCell sx={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>
                          {b.id}
                        </TableCell>
                        <TableCell>{b.facilityName}</TableCell>
                        <TableCell>{b.bookedBy}</TableCell>
                        <TableCell>{b.flat}</TableCell>
                        <TableCell>{ROLE_LABELS[b.role] ?? b.role}</TableCell>
                        <TableCell>{formatDate(b.date, { weekday: "short" })}</TableCell>
                        <TableCell>{b.time}</TableCell>
                        <TableCell sx={{ color: "text.secondary", fontSize: 12.5 }}>
                          {formatDateTime(b.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={b.status === BOOKING_STATUS.CONFIRMED ? "Confirmed" : "Cancelled"}
                            color={b.status === BOOKING_STATUS.CONFIRMED ? "success" : "default"}
                            variant={b.status === BOOKING_STATUS.CONFIRMED ? "filled" : "outlined"}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Card>
        </>
      )}
    </Box>
  );
}

function StatTile({ label, value }) {
  return (
    <Grid size={{ xs: 12, sm: 4 }}>
      <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider", p: 2 }}>
        <Typography variant="h4" fontWeight={700} color="primary.main">
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
      </Card>
    </Grid>
  );
}
