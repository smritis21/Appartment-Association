import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Typography,
} from "@mui/material";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { BOOKING_STATUS, BOOKING_STATUS_LABELS } from "../mock/bookings";
import { formatDate } from "../../../utils/formatDate";

// Is this booking in the past? Past bookings can't be cancelled.
const isPast = (dateISO) => {
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate(),
  ).padStart(2, "0")}`;
  return dateISO < todayISO;
};

// "My bookings" panel for the logged-in resident, with a cancel action on
// upcoming confirmed bookings. Upcoming bookings surface first so a resident
// doesn't have to scroll past old ones to find what's coming up.
export default function MyBookingsList({ bookings, onCancel }) {
  const sorted = [...bookings].sort((a, b) => {
    const aPast = isPast(a.date);
    const bPast = isPast(b.date);
    if (aPast !== bPast) return aPast ? 1 : -1;
    return aPast ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
  });

  if (bookings.length === 0) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
        <CardContent sx={{ textAlign: "center", py: 5, color: "text.secondary" }}>
          <EventBusyOutlinedIcon sx={{ fontSize: 40, opacity: 0.35, mb: 1 }} />
          <Typography variant="body2">You have no facility bookings yet.</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Grid container spacing={1.5}>
      {sorted.map((b) => {
        const cancelled = b.status === BOOKING_STATUS.CANCELLED;
        const past = isPast(b.date);
        return (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={b.id}>
          <Card
            variant="outlined"
            sx={{
              height: "100%",
              borderRadius: 3,
              borderColor: !cancelled && !past ? "success.main" : "divider",
              borderWidth: !cancelled && !past ? 1.5 : 1,
              opacity: cancelled || past ? 0.7 : 1,
            }}
          >
            <CardContent sx={{ "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                    {b.facilityName}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.25 }}>
                    <PlaceOutlinedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(b.date, { weekday: "short" })} · {b.time}
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  size="small"
                  label={cancelled ? BOOKING_STATUS_LABELS[b.status] : past ? "Past" : "Confirmed"}
                  color={cancelled ? "default" : past ? "default" : "success"}
                  variant={cancelled || past ? "outlined" : "filled"}
                />
              </Box>

              <Divider sx={{ my: 1.25 }} />

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="caption" color="text.secondary" fontFamily="var(--font-mono)">
                  {b.id}
                </Typography>
                {!cancelled && !past && (
                  <Button size="small" color="error" variant="outlined" onClick={() => onCancel(b)}>
                    Cancel
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}
