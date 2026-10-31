import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  Skeleton,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ViewListOutlinedIcon from "@mui/icons-material/ViewListOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import PageHeader from "../../../components/common/PageHeader";
import EmptyState from "../../../components/common/EmptyState";
import ScheduleCalendar from "../components/ScheduleCalendar";
import MaintenanceScheduleForm from "../components/MaintenanceScheduleForm";
import {
  eventAssigneeName,
  eventPriorityMeta,
  facilityNames,
} from "../mock/scheduledEvents";
import { formatDate } from "../../../utils/formatDate";
import { useMaintenanceSchedule } from "../../../hooks/useMaintenanceSchedule";

function EventRow({ ev }) {
  const meta = eventPriorityMeta(ev.priority);
  const accent = meta.color === "default" ? "text.secondary" : `${meta.color}.main`;
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        borderLeft: "4px solid",
        borderLeftColor: accent,
        display: "flex",
        gap: 2,
        flexWrap: "wrap",
        alignItems: "flex-start",
      }}
    >
      <Box sx={{ minWidth: 96 }}>
        <Typography variant="body2" fontWeight={700} color="text.primary">
          {formatDate(ev.date, { weekday: "short" })}
        </Typography>
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: "text.secondary" }}>
          <ScheduleOutlinedIcon sx={{ fontSize: 15 }} />
          <Typography variant="caption">{ev.time}</Typography>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, minWidth: 200 }}>
        <Typography variant="body2" fontWeight={700} color="text.primary">
          {ev.title}
        </Typography>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5} sx={{ mt: 0.75 }}>
          {facilityNames(ev.facilities).map((name) => (
            <Chip key={name} size="small" variant="outlined" label={name} />
          ))}
        </Stack>
        {ev.notes && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
            {ev.notes}
          </Typography>
        )}
      </Box>

      <Stack spacing={0.5} alignItems="flex-end">
        <Chip size="small" label={meta.label} color={meta.color} variant="outlined" />
        <Typography variant="caption" color="text.secondary">
          {eventAssigneeName(ev.assignee)}
        </Typography>
      </Stack>
    </Box>
  );
}

export default function MaintenanceSchedulePage() {
  const [formOpen, setFormOpen] = useState(false);
  const [view, setView] = useState("calendar");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const { events, loading, offline, error, createSchedule } = useMaintenanceSchedule();

  const handleSubmit = async (data) => {
    const res = await createSchedule(data);
    if (res.ok) {
      setSnackbar({
        open: true,
        message: `Scheduled ${data.title} for ${formatDate(data.date)} at ${data.time}`,
        severity: "success",
      });
      setFormOpen(false);
    } else {
      setSnackbar({
        open: true,
        message: res.error || "Failed to schedule activity",
        severity: "error",
      });
    }
  };

  return (
    <Box>
      <PageHeader
        title="Schedule Maintenance"
        subtitle="Plan maintenance activities and see them on a calendar or list"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Schedule Maintenance" }]}
        action={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setFormOpen(true)}>
            Schedule activity
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load schedule: {error}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, v) => v && setView(v)}
          aria-label="View mode"
        >
          <ToggleButton value="calendar" aria-label="Calendar view">
            <CalendarMonthOutlinedIcon sx={{ fontSize: 18, mr: 0.75 }} /> Calendar
          </ToggleButton>
          <ToggleButton value="list" aria-label="List view">
            <ViewListOutlinedIcon sx={{ fontSize: 18, mr: 0.75 }} /> List
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider", p: 2.5 }}>
        {loading ? (
          <Skeleton variant="rounded" height={320} />
        ) : view === "calendar" ? (
          <ScheduleCalendar events={events} />
        ) : (
          <Box>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <ViewListOutlinedIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={700}>
                Scheduled activities
              </Typography>
            </Stack>
            <Divider sx={{ mb: 1.5 }} />
            {events.length === 0 ? (
              <EmptyState
                title="Nothing scheduled yet"
                description="Use “Schedule activity” to plan your first maintenance activity."
              />
            ) : (
              <Stack spacing={1.25}>
                {events.map((ev) => (
                  <EventRow key={ev.id} ev={ev} />
                ))}
              </Stack>
            )}
          </Box>
        )}
      </Card>

      <MaintenanceScheduleForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

