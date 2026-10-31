import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import StarOutlineOutlinedIcon from "@mui/icons-material/StarOutlineOutlined";
import PageHeader from "../../../components/common/PageHeader";
import AttendanceTable from "../components/AttendanceTable";
import RatingDialog from "../components/RatingDialog";
import { checkIn, checkOut, isCheckedIn, getAttendanceForUser } from "../mock/attendance";
import {
  getBookingsForUser,
  getRatableBookings,
  shiftLabel,
  BOOKING_STATUS,
} from "../mock/bookings";
import { addRating, getRatedBookingIds } from "../mock/ratings";
import { categoryLabel } from "../mock/houseHelp";
import { useAuth } from "../../../hooks/useAuth";
import { formatDate } from "../../../utils/formatDate";

// Resident attendance / entry-log screen: check house help in (entry) and out
// (exit), and leave a star-rating + comment on completed bookings.
export default function AttendanceLogPage() {
  const { user } = useAuth();
  const [entryOpen, setEntryOpen] = useState(false);
  const [entryHelpId, setEntryHelpId] = useState("");
  const [entryError, setEntryError] = useState("");
  const [rateTarget, setRateTarget] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [version, setVersion] = useState(0);

  const toast = (message, severity = "success") => setSnackbar({ open: true, message, severity });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const logs = useMemo(() => getAttendanceForUser(user), [user, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ratable = useMemo(() => getRatableBookings(user, getRatedBookingIds()), [user, version]);

  // Distinct workers the resident has an active/completed booking with, that are
  // not already on premises - the pool the entry-log can check in. Recomputed
  // each render (re-renders are bumped by `version`) as it reads mutable
  // singletons.
  const checkInOptions = buildCheckInOptions(user);

  const openEntry = () => {
    setEntryHelpId("");
    setEntryError("");
    setEntryOpen(true);
  };

  const confirmEntry = () => {
    if (!entryHelpId) {
      setEntryError("Please select a worker to check in.");
      return;
    }
    const opt = checkInOptions.find((o) => o.helpId === entryHelpId);
    const rec = checkIn({
      helpId: opt.helpId,
      helpName: opt.helpName,
      category: opt.category,
      flat: user?.flat ?? "-",
      loggedBy: user?.name ?? "Resident",
    });
    setEntryOpen(false);
    toast(`${rec.helpName} checked in at ${rec.checkIn}`);
    setVersion((v) => v + 1);
  };

  const handleCheckOut = (row) => {
    const rec = checkOut(row.id);
    toast(`${rec.helpName} checked out · ${rec.hours} h logged`);
    setVersion((v) => v + 1);
  };

  const handleRate = ({ stars, comment }) => {
    const name = rateTarget.helpName;
    addRating({
      helpId: rateTarget.helpId,
      bookingId: rateTarget.id,
      stars,
      comment,
      by: user?.name ?? "Resident",
      flat: user?.flat ?? "-",
    });
    setRateTarget(null);
    toast(`Thanks - ${stars}-star rating saved for ${name}`);
    setVersion((v) => v + 1);
  };

  return (
    <Box>
      <PageHeader
        title="Attendance & Ratings"
        subtitle="Log house-help entry and exit, and rate completed services"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Attendance & Ratings" }]}
        action={
          <Button variant="contained" startIcon={<LoginOutlinedIcon />} onClick={openEntry}>
            Log Entry
          </Button>
        }
      />

      {/* Ratable completed services */}
      {ratable.length > 0 && (
        <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider", mb: 3, bgcolor: "primary.light" }}>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
              <StarOutlineOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                Rate your completed services
              </Typography>
            </Box>
            <Grid container spacing={1.5}>
              {ratable.map((b) => (
                <Grid size={{ xs: 12, sm: 6 }} key={b.id}>
                  <Card variant="outlined" sx={{ borderRadius: 2, borderColor: "divider", bgcolor: "background.paper" }}>
                    <CardContent sx={{ "&:last-child": { pb: 2 } }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                            {b.helpName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {categoryLabel(b.category)} · {formatDate(b.date, { weekday: "short" })} · {shiftLabel(b.shift)}
                          </Typography>
                        </Box>
                        <Chip size="small" label="Completed" variant="outlined" />
                      </Box>
                      <Button size="small" variant="contained" sx={{ mt: 1.5 }} onClick={() => setRateTarget(b)}>
                        Rate service
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ mb: 1.5 }}>
        Entry Log
      </Typography>
      <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
        <AttendanceTable logs={logs} onCheckOut={handleCheckOut} />
      </Card>

      {/* Check-in dialog */}
      <Dialog open={entryOpen} onClose={() => setEntryOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Log a house-help entry</DialogTitle>
        <DialogContent>
          {checkInOptions.length === 0 ? (
            <Alert severity="info" sx={{ mt: 1 }}>
              No booked workers are available to check in. Confirm a booking first, or your workers are already on
              premises.
            </Alert>
          ) : (
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              <TextField
                select
                label="Worker"
                value={entryHelpId}
                onChange={(e) => {
                  setEntryHelpId(e.target.value);
                  setEntryError("");
                }}
                error={!!entryError}
                helperText={entryError || "Only your confirmed / completed bookings are listed"}
                fullWidth
              >
                {checkInOptions.map((o) => (
                  <MenuItem key={o.helpId} value={o.helpId}>
                    {o.helpName} · {categoryLabel(o.category)}
                  </MenuItem>
                ))}
              </TextField>
              <Alert severity="info">Check-in stamps the current time as the entry for {user?.flat ?? "your flat"}.</Alert>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEntryOpen(false)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button onClick={confirmEntry} variant="contained" disabled={checkInOptions.length === 0}>
            Check in
          </Button>
        </DialogActions>
      </Dialog>

      <RatingDialog open={!!rateTarget} booking={rateTarget} onClose={() => setRateTarget(null)} onSubmit={handleRate} />

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

// Distinct confirmed/completed workers for a resident that are not already
// checked in - the candidates the entry-log can check in.
function buildCheckInOptions(user) {
  const seen = new Map();
  getBookingsForUser(user)
    .filter((b) => b.status === BOOKING_STATUS.CONFIRMED || b.status === BOOKING_STATUS.COMPLETED)
    .forEach((b) => {
      if (!seen.has(b.helpId) && !isCheckedIn({ helpId: b.helpId, flat: user?.flat })) {
        seen.set(b.helpId, { helpId: b.helpId, helpName: b.helpName, category: b.category });
      }
    });
  return [...seen.values()];
}

