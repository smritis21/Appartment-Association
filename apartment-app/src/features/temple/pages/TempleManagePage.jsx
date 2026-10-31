import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import TempleHinduOutlinedIcon from "@mui/icons-material/TempleHinduOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import CloseIcon from "@mui/icons-material/Close";
import PageHeader from "../../../components/common/PageHeader";
import { SEVA_TYPES, addSeva } from "../mock/sevas";
import { mockEvents, addEvent } from "../mock/events";
import {
  fetchTempleEvents,
  createTempleEvent,
  fetchTempleEventSignups,
} from "../../../services/templeService";
import { isOffline, ApiError } from "../../../services/apiClient";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDateTime } from "../../../utils/formatDate";

const emptySeva = { name: "", price: "", duration: "", description: "" };
const emptyEvent = { title: "", date: "", location: "", volunteersNeeded: "", description: "" };

export default function TempleManagePage() {
  const { state } = useLocation();
  const [tab, setTab] = useState(state?.tab === "events" ? "events" : "sevas");
  const [sevas, setSevas] = useState([...SEVA_TYPES]);
  const [events, setEvents] = useState([...mockEvents]);

  const [sevaDialog, setSevaDialog] = useState(false);
  const [eventDialog, setEventDialog] = useState(false);
  const [sevaDraft, setSevaDraft] = useState(emptySeva);
  const [eventDraft, setEventDraft] = useState(emptyEvent);
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [offline, setOffline] = useState(false);
  const [volunteersModal, setVolunteersModal] = useState({
    open: false,
    event: null,
    list: [],
    loading: false,
  });

  const handleOpenVolunteers = async (evt) => {
    setVolunteersModal({ open: true, event: evt, list: [], loading: true });
    try {
      const signups = await fetchTempleEventSignups(evt.id);
      const volunteers = (signups || []).filter((s) => s.type === "volunteer");
      setVolunteersModal({ open: true, event: evt, list: volunteers, loading: false });
    } catch {
      setVolunteersModal({ open: true, event: evt, list: [], loading: false });
    }
  };

  const loadEvents = useCallback(async () => {
    try {
      const data = await fetchTempleEvents();
      setEvents(data.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.eventDate,
        location: e.venue,
        description: e.description,
        volunteersNeeded: e.volunteersNeeded ?? 0,
        volunteersJoined: e.volunteersJoined ?? 0,
        publishedBy: "Secretary",
      })));
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setEvents([...mockEvents]);
        setOffline(true);
      }
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const closeSeva = () => {
    setSevaDialog(false);
    setSevaDraft(emptySeva);
    setError("");
  };
  const closeEvent = () => {
    setEventDialog(false);
    setEventDraft(emptyEvent);
    setError("");
  };

  const submitSeva = () => {
    if (!sevaDraft.name.trim() || !sevaDraft.price || Number(sevaDraft.price) <= 0) {
      setError("Please enter a pooja name and a valid dakshina amount.");
      return;
    }
    const created = addSeva(sevaDraft);
    setSevas([...SEVA_TYPES]);
    closeSeva();
    setSnackbar({ open: true, message: `Pooja "${created.name}" added`, severity: "success" });
  };

  const submitEvent = async () => {
    if (!eventDraft.title.trim() || !eventDraft.date || !eventDraft.location.trim()) {
      setError("Please fill in the title, date and location.");
      return;
    }
    setError("");
    try {
      const created = await createTempleEvent({
        title: eventDraft.title.trim(),
        description: eventDraft.description?.trim() || undefined,
        eventDate: new Date(eventDraft.date).toISOString(),
        venue: eventDraft.location.trim(),
        volunteersNeeded: eventDraft.volunteersNeeded ? Number(eventDraft.volunteersNeeded) : undefined,
      });
      closeEvent();
      setSnackbar({ open: true, message: `Event "${created.title}" published`, severity: "success" });
      await loadEvents();
    } catch (err) {
      if (isOffline(err)) {
        const created = addEvent(eventDraft);
        closeEvent();
        setSnackbar({
          open: true,
          message: `Event "${created.title}" published (offline - saved locally only)`,
          severity: "warning",
        });
        await loadEvents();
      } else {
        setError(err instanceof ApiError ? err.detail : "Could not publish event. Please try again.");
      }
    }
  };

  return (
    <Box>
      <PageHeader
        title="Manage Temple"
        subtitle="Create and manage poojas/sevas and temple events"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Temple", href: "/temple" },
          { label: "Manage" },
        ]}
        action={
          <Chip label="Secretary" color="secondary" size="small" sx={{ fontWeight: 600 }} />
        }
      />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Tab value="sevas" label={`Poojas / Sevas (${sevas.length})`} />
        <Tab value="events" label={`Events (${events.length})`} />
      </Tabs>

      {tab === "sevas" && (
        <>
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setSevaDialog(true)}>
              Add Pooja
            </Button>
          </Box>
          <Grid container spacing={2}>
            {sevas.map((seva) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={seva.id}>
                <Card sx={{ borderRadius: 3, border: "1.5px solid", borderColor: "divider", height: "100%" }}>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <TempleHinduOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                        {seva.name}
                      </Typography>
                    </Box>
                    <Chip
                      label={formatCurrency(seva.price)}
                      size="small"
                      color="secondary"
                      sx={{ my: 1, fontWeight: 600 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                      {seva.duration}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {seva.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {tab === "events" && (
        <>
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
            <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => setEventDialog(true)}>
              Publish Event
            </Button>
          </Box>
          <Grid container spacing={2}>
            {events.map((event) => (
              <Grid size={{ xs: 12, md: 6 }} key={event.id}>
                <Card sx={{ borderRadius: 3, border: "1.5px solid", borderColor: "divider", height: "100%" }}>
                  <CardContent>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <EventOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                        {event.title}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {formatDateTime(event.date)} · {event.location}
                    </Typography>
                    <Divider sx={{ my: 1 }} />
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="caption" color="text.secondary">
                        {event.volunteersJoined} / {event.volunteersNeeded} volunteers · published by{" "}
                        {event.publishedBy}
                      </Typography>
                      <Button
                        size="small"
                        variant="text"
                        startIcon={<GroupsOutlinedIcon />}
                        onClick={() => handleOpenVolunteers(event)}
                      >
                        View Volunteers ({event.volunteersJoined})
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* Add pooja dialog */}
      <Dialog open={sevaDialog} onClose={closeSeva} maxWidth="xs" fullWidth>
        <DialogTitle>Add Pooja / Seva</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="Pooja name"
            fullWidth
            size="small"
            sx={{ mt: 1, mb: 2 }}
            value={sevaDraft.name}
            onChange={(e) => setSevaDraft((d) => ({ ...d, name: e.target.value }))}
          />
          <TextField
            label="Dakshina (INR)"
            type="number"
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            value={sevaDraft.price}
            onChange={(e) => setSevaDraft((d) => ({ ...d, price: e.target.value }))}
          />
          <TextField
            label="Duration (e.g. 30 min)"
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            value={sevaDraft.duration}
            onChange={(e) => setSevaDraft((d) => ({ ...d, duration: e.target.value }))}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            minRows={2}
            size="small"
            value={sevaDraft.description}
            onChange={(e) => setSevaDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeSeva} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button onClick={submitSeva} variant="contained">
            Add Pooja
          </Button>
        </DialogActions>
      </Dialog>

      {/* Publish event dialog */}
      <Dialog open={eventDialog} onClose={closeEvent} maxWidth="xs" fullWidth>
        <DialogTitle>Publish Temple Event</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="Event title"
            fullWidth
            size="small"
            sx={{ mt: 1, mb: 2 }}
            value={eventDraft.title}
            onChange={(e) => setEventDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <TextField
            label="Date & time"
            type="datetime-local"
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            slotProps={{ inputLabel: { shrink: true } }}
            value={eventDraft.date}
            onChange={(e) => setEventDraft((d) => ({ ...d, date: e.target.value }))}
          />
          <TextField
            label="Location"
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            value={eventDraft.location}
            onChange={(e) => setEventDraft((d) => ({ ...d, location: e.target.value }))}
          />
          <TextField
            label="Volunteers needed"
            type="number"
            fullWidth
            size="small"
            sx={{ mb: 2 }}
            value={eventDraft.volunteersNeeded}
            onChange={(e) => setEventDraft((d) => ({ ...d, volunteersNeeded: e.target.value }))}
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            minRows={2}
            size="small"
            value={eventDraft.description}
            onChange={(e) => setEventDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeEvent} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button onClick={submitEvent} variant="contained">
            Publish
          </Button>
        </DialogActions>
      </Dialog>

      {/* Volunteers List Modal */}
      <Dialog
        open={volunteersModal.open}
        onClose={() => setVolunteersModal({ open: false, event: null, list: [], loading: false })}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Registered Volunteers
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {volunteersModal.event?.title}
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setVolunteersModal({ open: false, event: null, list: [], loading: false })}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          {volunteersModal.loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
              <CircularProgress size={24} />
            </Box>
          ) : volunteersModal.list.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 2 }}>
              No registered volunteers for this event yet.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {volunteersModal.list.map((v, i) => (
                <Card key={v.id || i} variant="outlined" sx={{ borderRadius: 2, p: 1.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="body2" fontWeight={700} color="text.primary">
                        {v.residentName || "Resident"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {v.flat ? `Flat: ${v.flat}` : ""} {v.residentPhone ? `· ${v.residentPhone}` : ""}
                      </Typography>
                    </Box>
                    <Chip label="Volunteer" color="primary" size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: 11 }} />
                  </Box>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity ?? "success"}
          variant="filled"
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

