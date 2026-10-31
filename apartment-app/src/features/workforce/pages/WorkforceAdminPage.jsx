import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  Chip,
  Grid,
  Rating,
  Snackbar,
  Alert,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from "@mui/material";
import PageHeader from "../../../components/common/PageHeader";
import EmptyState from "../../../components/common/EmptyState";
import AttendanceTable from "../components/AttendanceTable";
import { houseHelpBookings, BOOKING_STATUS_META, shiftLabel } from "../mock/bookings";
import { attendanceLogs } from "../mock/attendance";
import { getAllRatings } from "../mock/ratings";
import { categoryLabel } from "../mock/houseHelp";
import {
  serviceJobs,
  JOB_STATUS,
  JOB_STATUS_META,
  JOB_FLOW,
  tradeLabel,
  getProviderById,
  getProvidersForTrade,
  assignJob,
  advanceJob,
} from "../mock/serviceProviders";
import { formatDate, formatDateTime } from "../../../utils/formatDate";

// Management-only workforce register. Read-only oversight of house-help
// bookings, attendance and ratings, plus active management of service jobs:
// assign an open job to a provider and advance it to completion.
export default function WorkforceAdminPage() {
  const [tab, setTab] = useState(0);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignProvider, setAssignProvider] = useState("");
  const [assignError, setAssignError] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [version, setVersion] = useState(0);

  const toast = (message, severity = "success") => setSnackbar({ open: true, message, severity });

  // `version` bumps after every mutation to force a re-read of the singleton
  // arrays (their contents change without the reference changing).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bookings = useMemo(() => [...houseHelpBookings].sort((a, b) => b.date.localeCompare(a.date)), [version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const logs = useMemo(() => [...attendanceLogs].sort((a, b) => b.date.localeCompare(a.date)), [version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ratings = useMemo(() => getAllRatings(), [version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const jobs = useMemo(() => [...serviceJobs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [version]);

  const openJobs = serviceJobs.filter((j) => j.status === JOB_STATUS.OPEN).length;

  const openAssign = (job) => {
    setAssignTarget(job);
    setAssignProvider("");
    setAssignError("");
  };

  const confirmAssign = () => {
    if (!assignProvider) {
      setAssignError("Please choose a provider.");
      return;
    }
    assignJob(assignTarget.id, assignProvider);
    const p = getProviderById(assignProvider);
    setAssignTarget(null);
    toast(`Job ${assignTarget.id} assigned to ${p.name}`);
    setVersion((v) => v + 1);
  };

  const handleAdvance = (job) => {
    advanceJob(job.id);
    toast(`Job ${job.id} moved forward`);
    setVersion((v) => v + 1);
  };

  const canAdvance = (job) => {
    const idx = JOB_FLOW.indexOf(job.status);
    return idx >= 1 && idx < JOB_FLOW.length - 1; // assigned or in_progress
  };

  return (
    <Box>
      <PageHeader
        title="Workforce Register"
        subtitle="Society-wide house-help bookings, attendance, ratings and service-job assignment"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Workforce Register" }]}
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <StatTile label="House-help bookings" value={houseHelpBookings.length} />
        <StatTile label="Attendance records" value={attendanceLogs.length} />
        <StatTile label="Open service jobs" value={openJobs} />
      </Grid>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Tab label="House-Help Bookings" />
        <Tab label="Attendance" />
        <Tab label="Ratings" />
        <Tab label={`Service Jobs${openJobs ? ` (${openJobs} open)` : ""}`} />
      </Tabs>

      {tab === 0 && (
        <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, color: "text.secondary" } }}>
                  <TableCell>Reference</TableCell>
                  <TableCell>Worker</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell>Booked by</TableCell>
                  <TableCell>Flat</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Shift</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {bookings.map((b) => {
                  const meta = BOOKING_STATUS_META[b.status];
                  return (
                    <TableRow key={b.id} hover>
                      <TableCell sx={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{b.id}</TableCell>
                      <TableCell>{b.helpName}</TableCell>
                      <TableCell>{categoryLabel(b.category)}</TableCell>
                      <TableCell>{b.bookedBy}</TableCell>
                      <TableCell>{b.flat}</TableCell>
                      <TableCell>{formatDate(b.date, { weekday: "short" })}</TableCell>
                      <TableCell>{shiftLabel(b.shift)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={meta.label} color={meta.color} variant="outlined" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {tab === 1 && (
        <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
          <AttendanceTable logs={logs} />
        </Card>
      )}

      {tab === 2 && (
        <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider", p: 2 }}>
          {ratings.length === 0 ? (
            <EmptyState title="No ratings yet" description="Ratings left by residents will appear here." />
          ) : (
            <Stack spacing={1.5} divider={<Box sx={{ borderBottom: "1px solid", borderColor: "divider" }} />}>
              {ratings.map((r) => (
                <Box key={r.id} sx={{ pt: 0.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                        {r.help ? r.help.name : r.helpId}
                      </Typography>
                      {r.help && (
                        <Typography variant="caption" color="text.secondary">
                          {categoryLabel(r.help.category)}
                        </Typography>
                      )}
                      <Rating value={r.stars} size="small" readOnly />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatDateTime(r.createdAt)}
                    </Typography>
                  </Box>
                  {r.comment && (
                    <Typography variant="body2" color="text.primary" sx={{ mt: 0.5 }}>
                      “{r.comment}”
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    - {r.by}, {r.flat} · booking {r.bookingId}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Card>
      )}

      {tab === 3 && (
        <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, color: "text.secondary" } }}>
                  <TableCell>Reference</TableCell>
                  <TableCell>Trade</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Raised by</TableCell>
                  <TableCell>Flat</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobs.map((j) => {
                  const meta = JOB_STATUS_META[j.status];
                  const provider = getProviderById(j.providerId);
                  return (
                    <TableRow key={j.id} hover>
                      <TableCell sx={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}>{j.id}</TableCell>
                      <TableCell>{tradeLabel(j.trade)}</TableCell>
                      <TableCell sx={{ maxWidth: 240 }}>
                        <Typography variant="body2" color="text.secondary" noWrap title={j.description}>
                          {j.description}
                        </Typography>
                      </TableCell>
                      <TableCell>{j.raisedBy}</TableCell>
                      <TableCell>{j.flat}</TableCell>
                      <TableCell>{provider ? provider.name : "-"}</TableCell>
                      <TableCell>
                        <Chip size="small" label={meta.label} color={meta.color} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        {j.status === JOB_STATUS.OPEN && (
                          <Button size="small" variant="contained" onClick={() => openAssign(j)}>
                            Assign
                          </Button>
                        )}
                        {canAdvance(j) && (
                          <Button size="small" variant="outlined" onClick={() => handleAdvance(j)}>
                            {j.status === JOB_STATUS.ASSIGNED ? "Start" : "Complete"}
                          </Button>
                        )}
                        {(j.status === JOB_STATUS.COMPLETED || j.status === JOB_STATUS.CANCELLED) && (
                          <Typography variant="caption" color="text.disabled">
                            -
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {/* Assign dialog */}
      <Dialog open={!!assignTarget} onClose={() => setAssignTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign a provider</DialogTitle>
        <DialogContent>
          {assignTarget && (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {tradeLabel(assignTarget.trade)} · {assignTarget.id} · {assignTarget.flat}
              </Typography>
              <TextField
                select
                label="Provider"
                value={assignProvider}
                onChange={(e) => {
                  setAssignProvider(e.target.value);
                  setAssignError("");
                }}
                error={!!assignError}
                helperText={assignError}
                fullWidth
              >
                {getProvidersForTrade(assignTarget.trade).map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name} · {p.rating.toFixed(1)}★ · {p.jobsDone} jobs
                  </MenuItem>
                ))}
              </TextField>
              {getProvidersForTrade(assignTarget.trade).length === 0 && (
                <Alert severity="warning" sx={{ mt: 2 }}>
                  No empanelled provider for this trade.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAssignTarget(null)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmAssign} variant="contained">
            Assign Job
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
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

