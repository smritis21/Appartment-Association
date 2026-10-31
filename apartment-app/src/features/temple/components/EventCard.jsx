import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  LinearProgress,
  Typography,
} from "@mui/material";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { formatDateTime } from "../../../utils/formatDate";

export default function EventCard({ event, onVolunteer }) {
  const needed = event.volunteersNeeded ?? 10;
  const joined = event.volunteersJoined ?? 0;
  const full = joined >= needed && needed > 0;
  const progress = Math.min(100, Math.round((joined / (needed || 1)) * 100));

  return (
    <Card
      sx={{
        borderRadius: 3,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        border: "1.5px solid",
        borderColor: event.signedUp ? "primary.main" : "divider",
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
          <Typography variant="h6" fontWeight={700} color="text.primary">
            {event.title}
          </Typography>
          {event.signedUp && (
            <Chip
              icon={<CheckCircleOutlinedIcon />}
              label="Volunteering"
              size="small"
              color="success"
              variant="outlined"
              sx={{ fontWeight: 600 }}
            />
          )}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1, color: "text.secondary" }}>
          <EventOutlinedIcon fontSize="small" />
          <Typography variant="body2">{formatDateTime(event.date)}</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5, color: "text.secondary" }}>
          <PlaceOutlinedIcon fontSize="small" />
          <Typography variant="body2">{event.location}</Typography>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {event.description}
        </Typography>

        <Box sx={{ mt: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5, color: "text.secondary" }}>
            <GroupsOutlinedIcon fontSize="small" />
            <Typography variant="caption">
              {joined} / {needed} volunteers
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={progress}
            color={full ? "success" : "primary"}
            sx={{ height: 6, borderRadius: 3 }}
          />
        </Box>
      </CardContent>

      {onVolunteer && (
        <Box sx={{ p: 2, pt: 0 }}>
          <Button
            fullWidth
            variant={event.signedUp ? "outlined" : "contained"}
            color={event.signedUp ? "inherit" : "primary"}
            disabled={full && !event.signedUp}
            onClick={() => onVolunteer(event)}
          >
            {event.signedUp
              ? "Withdraw"
              : full
              ? "Volunteers Full"
              : "Volunteer"}
          </Button>
        </Box>
      )}
    </Card>
  );
}
