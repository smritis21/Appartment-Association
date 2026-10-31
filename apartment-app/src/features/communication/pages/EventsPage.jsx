// INT-31: Community Events - live API integration
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle,
  LinearProgress, Snackbar, Tab, Tabs, Typography,
} from "@mui/material";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useCallback, useEffect, useState } from "react";
import { fetchEvents, registerForEvent, unregisterFromEvent } from "../../../services/eventsService";
import { isOffline, ApiError } from "../../../services/apiClient";
import { eventsData } from "../mock/communicationData";
import PageHeader from "../../../components/common/PageHeader";
import DashboardCard from "../../../components/cards/DashboardCard";
import { useAuth } from "../../../hooks/useAuth";

const STATUS_COLOR = { open: "success", full: "warning", closed: "default", Open: "success", Full: "warning", Closed: "default" };

function toUiStatus(s) {
  if (!s) return "open";
  return s.toLowerCase();
}

// ── Event Detail Dialog ───────────────────────────────────────────────────────
function EventDetailDialog({ event, offline, onClose, onRefresh }) {
  const [rsvpDone, setRsvpDone] = useState(false);
  const [volunteerDone, setVolunteerDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState({ open: false, msg: "", severity: "success" });
  const { user } = useAuth();

  // Belt-and-suspenders alongside the `key={selected?.id}` remount on the
  // parent's <EventDetailDialog>: whenever a *different* event is shown in
  // this dialog, its RSVP/volunteer status must not carry over from
  // whatever event was open before. The backend doesn't currently return a
  // per-resident registration flag on the event list, so this resets to the
  // safe default (not registered) rather than the previous event's state.
  useEffect(() => {
    setRsvpDone(false);
    setVolunteerDone(false);
    setError(null);
  }, [event?.id]);

  if (!event) return null;

  const status = toUiStatus(event.status);
  const rsvpCount = event.rsvpCount ?? event.rsvp_count ?? 0;
  const capacity = event.capacity ?? 0;
  const fill = capacity ? Math.min(100, Math.round((rsvpCount / capacity) * 100)) : 0;

  const handleAction = async (type) => {
    const alreadyDone = type === "rsvp" ? rsvpDone : volunteerDone;

    if (offline) {
      const msg = type === "rsvp"
        ? (rsvpDone ? "RSVP cancelled." : "RSVP confirmed!")
        : (volunteerDone ? "Removed from volunteer list." : "Registered as volunteer!");
      type === "rsvp" ? setRsvpDone((v) => !v) : setVolunteerDone((v) => !v);
      setToast({ open: true, msg, severity: "success" });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const residentId = user?.residentId ?? user?.id ?? "resident";
      if (alreadyDone) {
        // Cancelling an existing registration must call the dedicated
        // unregister endpoint, not re-POST the same registration - the
        // backend correctly rejects a duplicate POST with a 409 whose
        // message ("already registered") reads like a bug to someone
        // trying to cancel.
        await unregisterFromEvent(event.id, residentId, type);
      } else {
        await registerForEvent(event.id, residentId, type);
      }
      type === "rsvp" ? setRsvpDone((v) => !v) : setVolunteerDone((v) => !v);
      setToast({
        open: true,
        msg: alreadyDone
          ? (type === "rsvp" ? "RSVP cancelled." : "Removed from volunteer list.")
          : (type === "rsvp" ? "RSVP confirmed! We'll see you there." : "You're now registered as a volunteer!"),
        severity: "success",
      });
      onRefresh();
    } catch (err) {
      const msg = err instanceof ApiError ? err.detail : "Action failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={!!event} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box sx={{ display: "flex", gap: 1, mb: 1, flexWrap: "wrap" }}>
            <Chip label={event.category ?? "Event"} size="small" color="primary" sx={{ height: 20, fontSize: 10 }} />
            <Chip label={event.status} size="small" color={STATUS_COLOR[event.status] ?? "default"} sx={{ height: 20, fontSize: 10 }} />
          </Box>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3 }}>{event.title}</Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <CalendarTodayOutlinedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
              <Typography variant="body2" color="text.secondary">
                {event.date ?? event.eventDate} {event.time ? `· ${event.time}` : ""}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <LocationOnOutlinedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
              <Typography variant="body2" color="text.secondary">{event.venue ?? event.location ?? "-"}</Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <PeopleOutlinedIcon sx={{ fontSize: 15, color: "text.secondary" }} />
              <Typography variant="body2" color="text.secondary">
                {rsvpCount} going · {event.volunteerCount ?? 0} volunteers · Capacity {capacity}
              </Typography>
            </Box>
          </Box>

          <Typography variant="body1" sx={{ lineHeight: 1.75, mb: 2 }}>{event.description}</Typography>

          {capacity > 0 && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.75 }}>
                <Typography variant="caption" color="text.secondary">RSVP capacity</Typography>
                <Typography variant="caption" fontWeight={700} color={fill > 90 ? "warning.main" : "text.secondary"}>{fill}% filled</Typography>
              </Box>
              <LinearProgress variant="determinate" value={fill}
                color={status === "full" ? "warning" : "primary"} sx={{ height: 6, borderRadius: 3 }} />
            </Box>
          )}

          {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: "wrap" }}>
          <Button variant="outlined" onClick={onClose}>Close</Button>
          {status !== "closed" && (
            <>
              <Button variant={rsvpDone ? "contained" : "outlined"} color={rsvpDone ? "success" : "primary"}
                startIcon={<CheckCircleOutlineIcon />} disabled={submitting}
                onClick={() => handleAction("rsvp")}>
                {rsvpDone ? "Cancel RSVP" : "RSVP - I'm Going"}
              </Button>
              <Button variant={volunteerDone ? "contained" : "outlined"}
                color={volunteerDone ? "secondary" : "default"}
                startIcon={volunteerDone ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                disabled={submitting || (status === "full" && !volunteerDone)}
                onClick={() => handleAction("volunteer")}>
                {volunteerDone ? "Volunteering ✓" : "Volunteer"}
              </Button>
            </>
          )}
          {status === "closed" && <Button variant="outlined" disabled>Registration Closed</Button>}
        </DialogActions>
      </Dialog>

      <Snackbar open={toast.open} autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>{toast.msg}</Alert>
      </Snackbar>
    </>
  );
}

// ── Upcoming Event Card ────────────────────────────────────────────────────────
function UpcomingCard({ event, onClick }) {
  const rsvpCount = event.rsvpCount ?? 0;
  const capacity = event.capacity ?? 0;
  const fill = capacity ? Math.min(100, Math.round((rsvpCount / capacity) * 100)) : 0;
  const status = toUiStatus(event.status);

  return (
    <Card elevation={1} sx={{ borderRadius: 2, overflow: "hidden", cursor: "pointer", transition: "all 0.15s", "&:hover": { boxShadow: 4, transform: "translateY(-2px)" } }} onClick={onClick}>
      <Box sx={{ height: 4, bgcolor: status === "full" ? "warning.main" : "primary.main" }} />
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
          <Box>
            <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.3, mb: 0.5 }}>{event.title}</Typography>
            <Chip label={event.category ?? "Event"} size="small" variant="outlined" sx={{ height: 18, fontSize: 10 }} />
          </Box>
          <Chip label={event.status} size="small" color={STATUS_COLOR[event.status] ?? "default"} sx={{ height: 20, fontSize: 10 }} />
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <CalendarTodayOutlinedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
            <Typography variant="caption" color="text.secondary">
              {event.date ?? event.eventDate} {event.time ? `· ${event.time}` : ""}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <LocationOnOutlinedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
            <Typography variant="caption" color="text.secondary">{event.venue ?? event.location ?? "-"}</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            <PeopleOutlinedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
            <Typography variant="caption" color="text.secondary">
              {rsvpCount}/{capacity} RSVPs · {event.volunteerCount ?? 0} volunteers
            </Typography>
          </Box>
        </Box>

        {capacity > 0 && (
          <Box sx={{ mb: 1.5 }}>
            <LinearProgress variant="determinate" value={fill}
              color={status === "full" ? "warning" : "primary"} sx={{ height: 5, borderRadius: 3 }} />
            <Typography variant="caption" color="text.disabled" sx={{ display: "block", mt: 0.5, textAlign: "right" }}>
              {fill}% filled
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ── Past Event Card ───────────────────────────────────────────────────────────
function PastCard({ event, onClick }) {
  return (
    <Card elevation={1} sx={{ borderRadius: 2, overflow: "hidden", cursor: "pointer", "&:hover": { boxShadow: 3 } }} onClick={onClick}>
      <Box sx={{ height: 100, bgcolor: "primary.light", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <PhotoCameraOutlinedIcon sx={{ fontSize: 36, color: "primary.main", opacity: 0.35 }} />
      </Box>
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>{event.title}</Typography>
        <Typography variant="caption" color="text.secondary">
          {event.date ?? event.eventDate} · {event.venue ?? event.location ?? "-"}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          <Chip label={event.category ?? "Event"} size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />
          <Chip label={`${event.rsvpCount ?? 0} attended`} size="small" sx={{ fontSize: 10, height: 18 }} />
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState("upcoming");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchEvents();
      setEvents(data);
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setEvents(eventsData);
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Live API: status is "open"/"full"/"closed". Mock uses type "upcoming"/"past".
  const upcoming = events.filter((e) => {
    if (e.type) return e.type === "upcoming";
    const s = toUiStatus(e.status);
    return s !== "closed" && s !== "completed" && s !== "cancelled";
  });
  const past = events.filter((e) => {
    if (e.type) return e.type === "past";
    const s = toUiStatus(e.status);
    return s === "closed" || s === "completed" || s === "cancelled";
  });

  const totalRsvp = upcoming.filter((e) => e.userRsvp).length;
  const openEvents = upcoming.filter((e) => toUiStatus(e.status) === "open").length;

  const STAT_CARDS = [
    { title: "Upcoming Events",  value: upcoming.length, icon: EventNoteOutlinedIcon,  color: "primary.main" },
    { title: "My RSVPs",         value: totalRsvp,        icon: CheckCircleOutlineIcon, color: "success.main" },
    { title: "Open for RSVP",    value: openEvents,       icon: PeopleOutlinedIcon,     color: "info.main" },
    { title: "Past Events",      value: past.length,      icon: PhotoCameraOutlinedIcon,color: "text.secondary" },
  ];

  return (
    <Box>
      <PageHeader
        title="Community Events"
        subtitle="View, RSVP, and volunteer for upcoming society events and festival celebrations"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Events" }]}
      />

      {offline && (
        <Chip icon={<CloudOffOutlinedIcon />} label="Backend unreachable - showing sample data"
          color="warning" variant="outlined" size="small" sx={{ mb: 2 }} />
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, mb: 3 }}>
        {STAT_CARDS.map((c) => (
          <DashboardCard key={c.title} title={c.title} value={loading ? "…" : c.value} icon={c.icon} color={c.color} />
        ))}
      </Box>

      <Box sx={{ borderBottom: "1px solid", borderColor: "divider", mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ "& .MuiTab-root": { textTransform: "none", fontWeight: 500 } }}>
          <Tab value="upcoming" label={`Upcoming (${upcoming.length})`} />
          <Tab value="past" label={`Past Events (${past.length})`} />
        </Tabs>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : tab === "upcoming" ? (
        upcoming.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <EventNoteOutlinedIcon sx={{ fontSize: 56, color: "text.disabled", mb: 2 }} />
            <Typography variant="h6" color="text.secondary">No upcoming events</Typography>
          </Box>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2.5 }}>
            {upcoming.map((e) => <UpcomingCard key={e.id} event={e} onClick={() => setSelected(e)} />)}
          </Box>
        )
      ) : (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Photos and highlights from past community events
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 2 }}>
            {past.map((e) => <PastCard key={e.id} event={e} onClick={() => setSelected(e)} />)}
          </Box>
        </Box>
      )}

      <EventDetailDialog key={selected?.id} event={selected} offline={offline} onClose={() => setSelected(null)} onRefresh={load} />
    </Box>
  );
}

