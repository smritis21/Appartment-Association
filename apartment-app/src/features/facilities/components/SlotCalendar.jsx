import { Box, Chip, Paper, Stack, Tooltip, Typography } from "@mui/material";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import { getBookableDates, getSlotGrid, SLOT_STATE } from "../mock/facilities";

// Visual legend + state -> style mapping so booked / blocked / past / available
// slots are clearly distinguished, per the acceptance criteria.
const STATE_STYLE = {
  [SLOT_STATE.AVAILABLE]: {
    label: "Available",
    sx: { bgcolor: "background.paper", borderColor: "success.main", color: "success.dark" },
  },
  [SLOT_STATE.BOOKED]: {
    label: "Booked",
    sx: { bgcolor: "grey.100", borderColor: "warning.main", color: "warning.dark" },
  },
  [SLOT_STATE.BLOCKED]: {
    label: "Blocked (maintenance)",
    sx: { bgcolor: "grey.100", borderColor: "error.main", color: "error.main" },
  },
  [SLOT_STATE.PAST]: {
    label: "Past",
    sx: { bgcolor: "grey.50", borderColor: "grey.300", color: "text.disabled" },
  },
};

function Legend() {
  return (
    <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
      {Object.values(SLOT_STATE).map((state) => (
        <Box key={state} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
          <Box
            sx={{
              width: 14,
              height: 14,
              borderRadius: 0.75,
              border: "2px solid",
              ...STATE_STYLE[state].sx,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {STATE_STYLE[state].label}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

// Date strip + slot grid showing availability for the chosen facility. Only
// AVAILABLE slots are selectable; everything else is visually muted and inert.
export default function SlotCalendar({
  facility,
  date,
  time,
  bookings,
  onDateChange,
  onTimeChange,
  errorMessage,
}) {
  const dates = getBookableDates();

  if (!facility) {
    return (
      <Paper
        variant="outlined"
        sx={{
          borderRadius: 3,
          borderStyle: "dashed",
          borderColor: "divider",
          py: 5,
          textAlign: "center",
          color: "text.secondary",
        }}
      >
        <EventAvailableOutlinedIcon sx={{ fontSize: 34, opacity: 0.4, mb: 1 }} />
        <Typography variant="body2">Choose a facility above to see its availability.</Typography>
      </Paper>
    );
  }

  const grid = date ? getSlotGrid({ facility, date, bookings }) : [];

  return (
    <Box>
      <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
        Choose a day
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 2.5 }}>
        {dates.map((d) => (
          <Chip
            key={d.value}
            label={d.isToday ? `Today · ${d.label}` : d.label}
            clickable
            color={date === d.value ? "primary" : "default"}
            variant={date === d.value ? "filled" : "outlined"}
            onClick={() => onDateChange(d.value)}
            sx={{ fontWeight: date === d.value ? 600 : 400 }}
          />
        ))}
      </Stack>

      {!date ? (
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 3,
            borderStyle: "dashed",
            borderColor: "divider",
            py: 4,
            textAlign: "center",
            color: "text.secondary",
          }}
        >
          <Typography variant="body2">Pick a day above to view time slots for {facility.name}.</Typography>
        </Paper>
      ) : (
        <>
          <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
            Availability
          </Typography>
          <Legend />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(3, 1fr)" },
              gap: 1.25,
            }}
          >
            {grid.map((slot) => {
              const style = STATE_STYLE[slot.state];
              const selectable = slot.state === SLOT_STATE.AVAILABLE;
              const selected = time === slot.time;
              const sharedNote =
                slot.capacity > 1 && slot.state === SLOT_STATE.AVAILABLE
                  ? `${slot.spotsLeft} of ${slot.capacity} spots left`
                  : style.label;
              return (
                <Tooltip key={slot.time} title={sharedNote} arrow>
                  <Box
                    role="button"
                    aria-disabled={!selectable}
                    onClick={() => selectable && onTimeChange(slot.time)}
                    sx={{
                      border: "2px solid",
                      borderRadius: 2,
                      px: 1.5,
                      py: 1.25,
                      cursor: selectable ? "pointer" : "not-allowed",
                      userSelect: "none",
                      textAlign: "center",
                      transition: "box-shadow .15s, transform .1s",
                      ...style.sx,
                      ...(selected && {
                        bgcolor: "primary.main",
                        borderColor: "primary.main",
                        color: "primary.contrastText",
                        boxShadow: 3,
                      }),
                      "&:hover": selectable
                        ? { boxShadow: 2, transform: "translateY(-1px)" }
                        : undefined,
                    }}
                  >
                    <Typography variant="body2" fontWeight={600}>
                      {slot.time}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      {selected ? "Selected" : selectable ? sharedNote : style.label}
                    </Typography>
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </>
      )}

      {errorMessage && (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 1.5 }}>
          {errorMessage}
        </Typography>
      )}
    </Box>
  );
}
