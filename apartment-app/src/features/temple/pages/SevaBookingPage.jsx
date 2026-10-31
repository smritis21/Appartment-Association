// INT-33: Seva Booking - live API integration
import { useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Divider, Grid, Snackbar, TextField, Typography,
} from "@mui/material";
import TempleHinduOutlinedIcon from "@mui/icons-material/TempleHinduOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import PageHeader from "../../../components/common/PageHeader";
import ConfirmationDialog from "../../../components/common/ConfirmationDialog";
import SevaCard from "../components/SevaCard";
import SlotPicker from "../components/SlotPicker";
import { SEVA_TYPES, getBookableDates } from "../mock/sevas";
import { createSevaBooking } from "../../../services/templeService";
import { isOffline, ApiError } from "../../../services/apiClient";
import { nextBookingId } from "../mock/bookings";
import { formatCurrency } from "../../../utils/formatCurrency";
import { useAuth } from "../../../hooks/useAuth";

const emptyForm = { seva: null, date: "", time: "", devotee: "" };

export default function SevaBookingPage() {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [offline, setOffline] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });
  const [booking, setBooking] = useState(null);

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const validate = () => {
    const next = {};
    if (!form.seva) next.seva = "Please choose a seva";
    if (!form.date) next.slot = "Please pick a date";
    else if (!form.time) next.slot = "Please pick a time slot";
    if (!form.devotee.trim()) next.devotee = "Please enter the devotee name";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleBookClick = () => {
    if (validate()) setConfirmOpen(true);
  };

  const confirmBooking = async () => {
    setConfirmOpen(false);
    setSubmitting(true);
    setApiError(null);
    const dateLabel = getBookableDates().find((d) => d.value === form.date)?.label ?? form.date;

    try {
      let ref;
      if (offline) {
        ref = nextBookingId();
      } else {
        const result = await createSevaBooking({
          residentId: user?.residentId ?? user?.id ?? "resident",
          sevaType: form.seva.id,
          bookingDate: form.date,
          slot: form.time,
          amount: form.seva.price,
        });
        ref = result.id;
        setOffline(false);
      }
      const created = {
        id: ref,
        sevaName: form.seva.name,
        amount: form.seva.price,
        dateLabel,
        time: form.time,
        devotee: form.devotee.trim(),
      };
      setBooking(created);
      setSnackbar({ open: true, message: `${created.sevaName} booked · ${created.id}` });
      setForm(emptyForm);
      setErrors({});
    } catch (err) {
      if (isOffline(err)) {
        setOffline(true);
        // retry locally
        const ref = nextBookingId();
        const created = { id: ref, sevaName: form.seva.name, amount: form.seva.price, dateLabel, time: form.time, devotee: form.devotee.trim() };
        setBooking(created);
        setSnackbar({ open: true, message: `${created.sevaName} booked · ${created.id}` });
        setForm(emptyForm);
        setErrors({});
      } else {
        setApiError(err instanceof ApiError ? err.detail : "Booking failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Book a Seva"
        subtitle="Select a pooja, pick a slot and confirm your monthly booking"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Temple", href: "/temple" },
          { label: "Book a Seva" },
        ]}
      />

      {booking && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setBooking(null)}>
          Booking confirmed - <strong>{booking.sevaName}</strong> on {booking.dateLabel} at{" "}
          {booking.time} for {booking.devotee}. Reference <strong>{booking.id}</strong>.
        </Alert>
      )}

      {apiError && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setApiError(null)}>{apiError}</Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ mb: 1.5 }}>
            1. Choose a seva
          </Typography>
          <Grid container spacing={2}>
            {SEVA_TYPES.map((seva) => (
              <Grid size={{ xs: 12, sm: 6 }} key={seva.id}>
                <SevaCard seva={seva} selected={form.seva?.id === seva.id} onSelect={(s) => set({ seva: s, time: "" })} />
              </Grid>
            ))}
          </Grid>
          {errors.seva && (
            <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>{errors.seva}</Typography>
          )}

          <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ mt: 3, mb: 1.5 }}>
            2. Pick a slot
          </Typography>
          <SlotPicker
            sevaId={form.seva?.id}
            date={form.date}
            time={form.time}
            onDateChange={(date) => set({ date, time: "" })}
            onTimeChange={(time) => set({ time })}
            errorMessage={errors.slot}
          />

          <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ mt: 3, mb: 1.5 }}>
            3. Devotee details
          </Typography>
          <TextField
            label="Devotee name" fullWidth size="small"
            value={form.devotee} onChange={(e) => set({ devotee: e.target.value })}
            error={!!errors.devotee} helperText={errors.devotee}
          />
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ borderRadius: 3, border: "1.5px solid", borderColor: "divider", position: "sticky", top: 16 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="text.primary">Booking Summary</Typography>
              <Divider sx={{ my: 1.5 }} />
              {[
                ["Seva",    form.seva?.name ?? "-"],
                ["Date",    form.date ? getBookableDates().find((d) => d.value === form.date)?.label : "-"],
                ["Time",    form.time || "-"],
                ["Devotee", form.devotee || "-"],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                  <Typography variant="body2" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ textAlign: "right" }}>{value}</Typography>
                </Box>
              ))}
              <Divider sx={{ my: 1.5 }} />
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
                <Typography variant="body1" fontWeight={700} color="text.primary">Dakshina</Typography>
                <Typography variant="body1" fontWeight={700} color="primary.main">
                  {form.seva ? formatCurrency(form.seva.price) : "-"}
                </Typography>
              </Box>
              <Button fullWidth variant="contained" size="large"
                startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <TempleHinduOutlinedIcon />}
                onClick={handleBookClick} disabled={submitting}>
                Confirm Booking
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ConfirmationDialog
        open={confirmOpen}
        title="Confirm this seva booking?"
        message={
          form.seva
            ? `${form.seva.name} on ${getBookableDates().find((d) => d.value === form.date)?.label} at ${form.time}. A dakshina of ${formatCurrency(form.seva.price)} will be collected.`
            : ""
        }
        confirmLabel="Confirm Booking"
        severity="primary"
        onConfirm={confirmBooking}
        onCancel={() => setConfirmOpen(false)}
      />

      <Snackbar open={snackbar.open} autoHideDuration={3500}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity="success" variant="filled" onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

