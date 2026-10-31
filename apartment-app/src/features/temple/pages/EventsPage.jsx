// INT-33: Temple Events - live API integration
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Chip, Grid, Snackbar } from "@mui/material";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import EmptyState from "../../../components/common/EmptyState";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import ConfirmationDialog from "../../../components/common/ConfirmationDialog";
import EventCard from "../components/EventCard";
import {
  fetchTempleEvents,
  fetchTempleEventSignups,
  signupForTempleEvent,
  withdrawTempleEventSignup,
} from "../../../services/templeService";
import { isOffline, ApiError } from "../../../services/apiClient";
import { mockEvents } from "../mock/events";
import { useAuthContext } from "../../../context/AuthContext";
import { MANAGEMENT_ROLES } from "../../../constants/roles";

export default function EventsPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const canManage = MANAGEMENT_ROLES.includes(user?.role);

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [confirm, setConfirm] = useState({ open: false, event: null });
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const load = useCallback(async () => {
    try {
      const data = await fetchTempleEvents();
      const myId = user?.residentId || user?.id;
      const myName = user?.name?.toLowerCase();

      const eventsWithStatus = await Promise.all(
        data.map(async (e) => {
          let signedUp = false;
          try {
            const signups = await fetchTempleEventSignups(e.id);
            signedUp = (signups || []).some(
              (s) =>
                s.type === "volunteer" &&
                (s.residentId === myId || (myName && s.residentName?.toLowerCase() === myName))
            );
          } catch {
            signedUp = false;
          }
          return {
            id: e.id,
            title: e.title,
            date: e.eventDate,
            location: e.venue,
            description: e.description,
            volunteersNeeded: e.volunteersNeeded ?? 10,
            volunteersJoined: e.volunteersJoined ?? 0,
            signedUp,
            publishedBy: "Secretary",
          };
        })
      );
      setEvents(eventsWithStatus);
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setEvents([...mockEvents]);
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(
    () => [...events].sort((a, b) => new Date(a.date) - new Date(b.date)),
    [events]
  );

  const requestVolunteer = (event) => setConfirm({ open: true, event });

  const applyVolunteer = async () => {
    const { event } = confirm;
    setConfirm({ open: false, event: null });

    if (offline) {
      setEvents((prev) =>
        prev.map((e) => {
          if (e.id !== event.id) return e;
          const signedUp = !e.signedUp;
          return { ...e, signedUp, volunteersJoined: e.volunteersJoined + (signedUp ? 1 : -1) };
        })
      );
      setSnackbar({
        open: true,
        message: event.signedUp
          ? `Withdrawn from "${event.title}"`
          : `You're signed up to volunteer for "${event.title}"`,
        severity: event.signedUp ? "info" : "success",
      });
      return;
    }

    setSubmitting(true);
    try {
      const residentParam = user?.residentId ?? user?.id ?? "resident";
      if (event.signedUp) {
        await withdrawTempleEventSignup(event.id, residentParam, "volunteer");
        setSnackbar({
          open: true,
          message: `Withdrawn from "${event.title}"`,
          severity: "info",
        });
      } else {
        await signupForTempleEvent(event.id, residentParam, "volunteer");
        setSnackbar({
          open: true,
          message: `You're signed up to volunteer for "${event.title}"`,
          severity: "success",
        });
      }
      await load();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof ApiError ? err.detail : "Action failed. Please try again.",
        severity: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Temple Events"
        subtitle="Upcoming events at the community temple - sign up to volunteer"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Temple", href: "/temple" },
          { label: "Events" },
        ]}
        action={
          canManage ? (
            <Button
              variant="outlined"
              startIcon={<SettingsOutlinedIcon />}
              onClick={() => navigate("/temple/manage", { state: { tab: "events" } })}
            >
              Manage Events
            </Button>
          ) : null
        }
      />

      {loading ? (
        <LoadingSpinner message="Loading temple events..." />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={EventOutlinedIcon}
          title="No events scheduled"
          description="There are no temple events at the moment. Please check back soon."
        />
      ) : (
        <Grid container spacing={2}>
          {sorted.map((event) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={event.id}>
              <EventCard event={event} onVolunteer={requestVolunteer} />
            </Grid>
          ))}
        </Grid>
      )}

      <ConfirmationDialog
        open={confirm.open}
        title={confirm.event?.signedUp ? "Withdraw from this event?" : "Volunteer for this event?"}
        message={
          confirm.event?.signedUp
            ? `You will be removed from the volunteer list for "${confirm.event?.title}".`
            : `You will be added to the volunteer list for "${confirm.event?.title}".`
        }
        confirmLabel={submitting ? "Processing…" : confirm.event?.signedUp ? "Withdraw" : "Sign Up"}
        severity={confirm.event?.signedUp ? "error" : "primary"}
        onConfirm={applyVolunteer}
        onCancel={() => setConfirm({ open: false, event: null })}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

