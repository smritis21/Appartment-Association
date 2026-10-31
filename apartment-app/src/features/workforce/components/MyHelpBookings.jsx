import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import { BOOKING_STATUS, BOOKING_STATUS_META, shiftLabel } from "../mock/bookings";
import { categoryLabel } from "../mock/houseHelp";
import { formatDate } from "../../../utils/formatDate";

// Resident's own house-help bookings, newest first. Actions depend on status:
//   requested → Confirm / Cancel
//   confirmed → Mark completed / Cancel
//   completed → rate (rating is offered on the Attendance & Ratings screen)
export default function MyHelpBookings({ bookings, onConfirm, onComplete, onCancel }) {
  if (bookings.length === 0) {
    return (
      <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
        <CardContent sx={{ textAlign: "center", py: 5, color: "text.secondary" }}>
          <EventBusyOutlinedIcon sx={{ fontSize: 40, opacity: 0.35, mb: 1 }} />
          <Typography variant="body2">You have no house-help bookings yet.</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Stack spacing={1.5}>
      {bookings.map((b) => {
        const meta = BOOKING_STATUS_META[b.status];
        const active = b.status === BOOKING_STATUS.REQUESTED || b.status === BOOKING_STATUS.CONFIRMED;
        return (
          <Card
            key={b.id}
            variant="outlined"
            sx={{ borderRadius: 3, borderColor: "divider", opacity: active ? 1 : 0.75 }}
          >
            <CardContent sx={{ "&:last-child": { pb: 2 } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                    {b.helpName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {categoryLabel(b.category)} · {formatDate(b.date, { weekday: "short" })} · {shiftLabel(b.shift)}
                  </Typography>
                  {b.notes && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                      “{b.notes}”
                    </Typography>
                  )}
                </Box>
                <Chip size="small" label={meta.label} color={meta.color} variant={active ? "filled" : "outlined"} />
              </Box>

              <Divider sx={{ my: 1.25 }} />

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                <Typography variant="caption" color="text.secondary" fontFamily="var(--font-mono)">
                  {b.id}
                </Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  {b.status === BOOKING_STATUS.REQUESTED && (
                    <Button size="small" variant="contained" color="success" onClick={() => onConfirm(b)}>
                      Confirm
                    </Button>
                  )}
                  {b.status === BOOKING_STATUS.CONFIRMED && (
                    <Button size="small" variant="outlined" onClick={() => onComplete(b)}>
                      Mark completed
                    </Button>
                  )}
                  {active && (
                    <Button size="small" color="error" variant="outlined" onClick={() => onCancel(b)}>
                      Cancel
                    </Button>
                  )}
                </Box>
              </Box>
            </CardContent>
          </Card>
        );
      })}
    </Stack>
  );
}
