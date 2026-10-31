import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import { getAvailableSlots, getBookableDates } from "../mock/sevas";

// Date + time slot selector. All values are controlled by the parent page so it
// can validate before allowing a booking. `errorMessage` renders a field-level
// validation hint (e.g. "Please pick a slot").
export default function SlotPicker({
  sevaId,
  date,
  time,
  onDateChange,
  onTimeChange,
  errorMessage,
}) {
  const slots = sevaId && date ? getAvailableSlots(sevaId, date) : [];
  const dates = getBookableDates();

  return (
    <Box>
      <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
        <InputLabel id="seva-date-label">Booking date</InputLabel>
        <Select
          labelId="seva-date-label"
          label="Booking date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
        >
          {dates.map((d) => (
            <MenuItem key={d.value} value={d.value}>
              {d.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
        Select a time slot
      </Typography>

      {!date ? (
        <Typography variant="body2" color="text.secondary">
          Choose a date to see available slots.
        </Typography>
      ) : slots.filter((s) => s.available).length === 0 ? (
        <Typography variant="body2" color="error">
          All slots are fully booked for this date. Please select another date.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
          {slots
            .filter((slot) => slot.available)
            .map((slot) => (
              <Chip
                key={slot.time}
                label={slot.time}
                clickable
                color={time === slot.time ? "primary" : "default"}
                variant={time === slot.time ? "filled" : "outlined"}
                onClick={() => onTimeChange(slot.time)}
                sx={{ fontWeight: time === slot.time ? 600 : 400 }}
              />
            ))}
        </Box>
      )}

      {errorMessage && (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
          {errorMessage}
        </Typography>
      )}
    </Box>
  );
}
