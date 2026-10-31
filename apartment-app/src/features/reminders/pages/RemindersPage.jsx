import {
  Box, Grid, Snackbar, Alert,
} from "@mui/material";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import DoNotDisturbOutlinedIcon from "@mui/icons-material/DoNotDisturbOutlined";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useResidents } from "../../../context/ResidentContext";
import {
  getAllReminders, getReminderStats,
  setReminderState, REMINDER_STATUS,
} from "../mock/reminders";
import {
  fetchReminders, fetchReminderStats, dismissReminder as apiDismissReminder,
} from "../../../services/reminderService";
import { isOffline } from "../../../services/apiClient";
import PageHeader from "../../../components/common/PageHeader";
import DashboardCard from "../../../components/cards/DashboardCard";
import ReminderBanner from "../components/ReminderBanner";
import ReminderList from "../components/ReminderList";

export default function RemindersPage() {
  const { residents } = useResidents();

  const [reminders, setReminders] = useState([]);
  const [stats, setStats]         = useState(getReminderStats());
  const [offline, setOffline]     = useState(false);
  const [toast, setToast]         = useState({ open: false, message: "", severity: "success" });

  const refresh = useCallback(async () => {
    try {
      const [items, apiStats] = await Promise.all([
        fetchReminders(),
        fetchReminderStats(),
      ]);
      setReminders(items);
      setStats({
        unread:    apiStats.sent,
        dueToday:  0,
        upcoming:  0,
        overdue:   0,
        completed: 0,
        dismissed: apiStats.dismissed,
      });
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setReminders(getAllReminders());
        setStats(getReminderStats());
        setOffline(true);
      }
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const residentMap = useMemo(() => {
    const m = {};
    residents.forEach((r) => { m[r.id] = r; });
    return m;
  }, [residents]);

  const topReminder = useMemo(() => {
    return reminders.find((r) => r.status !== REMINDER_STATUS.DISMISSED) ?? null;
  }, [reminders]);
  const topResident = topReminder ? residentMap[topReminder.residentId] : null;

  const handleDismiss = useCallback(async (id) => {
    if (offline) {
      setReminderState(id, REMINDER_STATUS.DISMISSED);
      refresh();
    } else {
      try {
        await apiDismissReminder(id);
        refresh();
      } catch {
        setReminderState(id, REMINDER_STATUS.DISMISSED);
        refresh();
      }
    }
    setToast({ open: true, message: "Reminder dismissed.", severity: "info" });
  }, [offline, refresh]);

  const handleMarkRead = useCallback(async (id) => {
    // No live "mark read" endpoint - dismiss via API (same effect) or update locally
    if (offline) {
      setReminderState(id, REMINDER_STATUS.DISMISSED);
    } else {
      try {
        await apiDismissReminder(id);
      } catch {
        setReminderState(id, REMINDER_STATUS.DISMISSED);
      }
    }
    refresh();
    setToast({ open: true, message: "Reminder marked as read.", severity: "success" });
  }, [offline, refresh]);

  const STAT_CARDS = [
    { title: "Unread",             value: stats.unread,    icon: NotificationsActiveOutlinedIcon, color: "primary.main"   },
    { title: "Due Today",          value: stats.dueToday,  icon: HourglassEmptyOutlinedIcon,      color: "warning.main"   },
    { title: "Upcoming Payments",  value: stats.upcoming,  icon: NotificationsOutlinedIcon,       color: "info.main"      },
    { title: "Overdue Bills",      value: stats.overdue,   icon: ErrorOutlineOutlinedIcon,        color: "error.main"     },
    { title: "Payments Completed", value: stats.completed, icon: CheckCircleOutlinedIcon,         color: "success.main"   },
    { title: "Dismissed",          value: stats.dismissed, icon: DoNotDisturbOutlinedIcon,        color: "text.secondary" },
  ];

  return (
    <Box>
      <PageHeader
        title="Payment Reminders"
        subtitle="Manage and track payment reminders for all residents"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reminders" }]}
      />

      {offline && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Showing sample data - backend unreachable. Start it with{" "}
          <code>uvicorn app.main:app --reload</code>.
        </Alert>
      )}

      {/* Banner - highest priority active reminder */}
      <ReminderBanner
        reminder={topReminder}
        residentName={topResident?.name}
        onDismiss={handleDismiss}
      />

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STAT_CARDS.map((c) => (
          <Grid size={{ xs: 6, sm: 4, md: 2 }} key={c.title}>
            <DashboardCard title={c.title} value={c.value} icon={c.icon} color={c.color} />
          </Grid>
        ))}
      </Grid>

      {/* Reminder list */}
      <ReminderList
        reminders={reminders}
        residentMap={residentMap}
        onMarkRead={handleMarkRead}
        onDismiss={handleDismiss}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

