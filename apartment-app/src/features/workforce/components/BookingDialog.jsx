import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import { SHIFTS, hasClash, hasOwnClash } from "../mock/bookings";
import { categoryLabel } from "../mock/houseHelp";

const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const emptyForm = { date: "", shift: "", notes: "" };

// Booking form for a chosen worker. Validates that a date (today or later) and
// shift are picked, and that neither the worker nor the resident already holds
// that date+shift (availability distinction + double-book guard from the AC).
export default function BookingDialog({ open, help, user, onClose, onConfirm }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const todayISO = toISO(new Date());

  // Reset the form each time the dialog opens for a new worker.
  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setErrors({});
    }
  }, [open, help]);

  if (!help) return null;

  const set = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const validate = () => {
    const next = {};
    if (!form.date) next.date = "Please choose a date";
    else if (form.date < todayISO) next.date = "Date cannot be in the past";
    if (!form.shift) next.shift = "Please choose a shift";

    if (!next.date && !next.shift) {
      if (hasOwnClash({ user, helpId: help.id, date: form.date, shift: form.shift })) {
        next.shift = "You already have this worker booked for that shift.";
      } else if (hasClash({ helpId: help.id, date: form.date, shift: form.shift })) {
        next.shift = "This worker is already booked for that shift. Pick another.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleConfirm = () => {
    if (validate()) onConfirm({ ...form });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Book {help.name}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          {categoryLabel(help.category)} · {help.experienceYears} yrs experience
        </Typography>

        {help.phone && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 2 }}>
            <PhoneOutlinedIcon sx={{ fontSize: 15 }} color="action" />
            <Typography
              variant="body2"
              component="a"
              href={`tel:${help.phone}`}
              color="primary.main"
              sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
            >
              {help.phone}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <TextField
            label="Date"
            type="date"
            value={form.date}
            onChange={(e) => set({ date: e.target.value })}
            slotProps={{ inputLabel: { shrink: true } }}
            inputProps={{ min: todayISO }}
            error={!!errors.date}
            helperText={errors.date}
            fullWidth
          />
          <TextField
            select
            label="Shift"
            value={form.shift}
            onChange={(e) => set({ shift: e.target.value })}
            error={!!errors.shift}
            helperText={errors.shift}
            fullWidth
          >
            {SHIFTS.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Notes (optional)"
            value={form.notes}
            onChange={(e) => set({ notes: e.target.value })}
            multiline
            minRows={2}
            placeholder="e.g. daily sweeping and utensils"
            fullWidth
          />
        </Box>

        <Alert severity="info" sx={{ mt: 2 }}>
          Booked for <strong>{user?.name ?? "you"}</strong> ({user?.flat ?? "-"}) at{" "}
          {help.rating.toFixed(1)}★ · charged {help.verified ? "monthly" : "on trial"}.
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Cancel
        </Button>
        <Button onClick={handleConfirm} variant="contained">
          Confirm Booking
        </Button>
      </DialogActions>
    </Dialog>
  );
}

