import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Skeleton,
  Snackbar,
  Typography,
} from "@mui/material";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import PageHeader from "../../../components/common/PageHeader";
import ConfirmationDialog from "../../../components/common/ConfirmationDialog";
import FacilitySelector from "../components/FacilitySelector";
import SlotCalendar from "../components/SlotCalendar";
import MyBookingsList from "../components/MyBookingsList";
import { getBookableDates, getSlotState, SLOT_STATE } from "../mock/facilities";
import {
  facilityBookings as mockFacilityBookings,
  addBooking as mockAddBooking,
  cancelBooking as mockCancelBooking,
  getBookingsForUser,
} from "../mock/bookings";
import { useAuth } from "../../../hooks/useAuth";
import { ROLE_LABELS } from "../../../constants/roles";
import { useFacilities, createFacilityBooking, cancelFacilityBooking } from "../../../hooks/useFacilities";

const emptyForm = { facility: null, date: "", time: "" };

export default function FacilityBookingPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [lastBooking, setLastBooking] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  const [version, setVersion] = useState(0);

  const { facilities, loading, offline, error } = useFacilities();

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const myBookings = useMemo(() => getBookingsForUser(user), [user, version]);

  const dateLabel = (value) =>
    getBookableDates().find((d) => d.value === value)?.label ?? value;

  const validate = () => {
    const next = {};
    if (!form.facility) next.facility = "Please choose a facility";
    if (!form.date) next.slot = "Please pick a day";
    else if (!form.time) next.slot = "Please pick an available time slot";
    else {
      const slot = { time: form.time, end: 24 };
      const state = getSlotState({
        facility: form.facility,
        date: form.date,
        slot,
        bookings: mockFacilityBookings,
      });
      if (state !== SLOT_STATE.AVAILABLE) {
        next.slot = "That slot is no longer available. Please pick another.";
      }
      const clash = myBookings.some(
        (b) =>
          b.status === "confirmed" &&
          b.facilityId === form.facility.id &&
          b.date === form.date &&
          b.time === form.time,
      );
      if (clash) next.slot = "You already have this slot booked.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleBookClick = () => {
    if (validate()) setConfirmOpen(true);
  };

  const confirmBooking = async () => {
    if (!offline && form.facility) {
      try {
        await createFacilityBooking(form.facility.id, {
          date: form.date,
          time: form.time,
          residentId: user?.id ?? "RES-001",
        });
      } catch {
        // Fallback to local mock if API fails
      }
    }
    const created = mockAddBooking({
      facilityId: form.facility.id,
      facilityName: form.facility.name,
      date: form.date,
      time: form.time,
      bookedBy: user?.name ?? "Resident",
      flat: user?.flat ?? "-",
      role: user?.role ?? "owner",
    });
    setLastBooking({ ...created, dateLabel: dateLabel(created.date) });
    setConfirmOpen(false);
    setSnackbar({ open: true, message: `${created.facilityName} booked · ${created.id}` });
    setForm(emptyForm);
    setErrors({});
    setVersion((v) => v + 1);
  };

  const confirmCancel = async () => {
    if (cancelTarget) {
      if (!offline) {
        try {
          await cancelFacilityBooking(cancelTarget.id);
        } catch {
          // Fallback to local mock
        }
      }
      mockCancelBooking(cancelTarget.id);
      setSnackbar({ open: true, message: `Booking ${cancelTarget.id} cancelled` });
      setCancelTarget(null);
      setVersion((v) => v + 1);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Book a Facility"
        subtitle="Reserve the gym, pool or sports court for an available slot"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Facilities" },
        ]}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load facilities: {error}
        </Alert>
      )}

      {lastBooking && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setLastBooking(null)}>
          Booking confirmed - <strong>{lastBooking.facilityName}</strong> on {lastBooking.dateLabel}{" "}
          at {lastBooking.time}. Reference <strong>{lastBooking.id}</strong>.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Booking flow */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ mb: 1.5 }}>
            1. Choose a facility
          </Typography>
          {loading ? (
            <Skeleton variant="rounded" height={100} />
          ) : (
            <FacilitySelector
              facilities={facilities}
              selectedId={form.facility?.id}
              onSelect={(facility) => set({ facility, time: "" })}
            />
          )}
          {errors.facility && (
            <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
              {errors.facility}
            </Typography>
          )}

          <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ mt: 3, mb: 1.5 }}>
            2. Pick a day &amp; slot
          </Typography>
          <SlotCalendar
            facility={form.facility}
            date={form.date}
            time={form.time}
            bookings={mockFacilityBookings}
            onDateChange={(date) => set({ date, time: "" })}
            onTimeChange={(time) => set({ time })}
            errorMessage={errors.slot}
          />
        </Grid>

        {/* Summary + confirm */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card
            sx={{
              borderRadius: 3,
              border: "1.5px solid",
              borderColor: form.time ? "primary.main" : "divider",
              position: { md: "sticky" },
              top: 16,
            }}
          >
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                <CalendarMonthOutlinedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                  Booking Summary
                </Typography>
              </Box>

              <SummaryRow label="Resident" value={user?.name ?? "-"} />
              <SummaryRow label="Flat" value={user?.flat ?? "-"} />
              <SummaryRow label="Role" value={user ? ROLE_LABELS[user.role] ?? user.role : "-"} />
              <Divider sx={{ my: 1.5 }} />

              {form.facility ? (
                <>
                  <SummaryRow label="Facility" value={form.facility.name} />
                  <SummaryRow label="Day" value={form.date ? dateLabel(form.date) : "Not picked yet"} muted={!form.date} />
                  <SummaryRow label="Time slot" value={form.time || "Not picked yet"} muted={!form.time} />
                </>
              ) : (
                <Chip
                  size="small"
                  label="Choose a facility to get started"
                  variant="outlined"
                  sx={{ width: "100%" }}
                />
              )}

              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<EventAvailableOutlinedIcon />}
                disabled={!form.facility || !form.date || !form.time}
                onClick={handleBookClick}
                sx={{ mt: 2.5 }}
              >
                Book Slot
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ mb: 1.5 }}>
          My Bookings
        </Typography>
        <MyBookingsList bookings={myBookings} onCancel={(b) => setCancelTarget(b)} />
      </Box>

      <ConfirmationDialog
        open={confirmOpen}
        title="Confirm this booking?"
        message={
          form.facility
            ? `${form.facility.name} on ${form.date ? dateLabel(form.date) : ""} at ${form.time}, booked for ${user?.name ?? "you"} (${user?.flat ?? "-"}).`
            : ""
        }
        confirmLabel="Confirm Booking"
        severity="primary"
        onConfirm={confirmBooking}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmationDialog
        open={!!cancelTarget}
        title="Cancel this booking?"
        message={
          cancelTarget
            ? `This frees up ${cancelTarget.facilityName} on ${dateLabel(cancelTarget.date)} at ${cancelTarget.time} for other residents.`
            : ""
        }
        confirmLabel="Cancel Booking"
        cancelLabel="Keep it"
        severity="error"
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function SummaryRow({ label, value, muted = false }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5, gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={muted ? 400 : 600}
        color={muted ? "text.disabled" : "text.primary"}
        fontStyle={muted ? "italic" : "normal"}
        sx={{ textAlign: "right" }}
      >
        {value}
      </Typography>
    </Box>
  );
}

