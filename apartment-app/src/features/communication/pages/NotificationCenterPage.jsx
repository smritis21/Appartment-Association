// FE-37: Notification Center - unified list for all alert types
import {
  Alert, Box, Chip, Divider, IconButton, List, ListItemButton,
  ListItemAvatar, ListItemText, Paper, Tab, Tabs, Tooltip, Typography,
} from "@mui/material";
import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import DeleteOutlineOutlinedIcon from "@mui/icons-material/DeleteOutlineOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import BookmarkOutlinedIcon from "@mui/icons-material/BookmarkOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import { useState } from "react";
import PageHeader from "../../../components/common/PageHeader";
import { useNotifications } from "../../../context/NotificationContext";
import DashboardCard from "../../../components/cards/DashboardCard";

const TYPE_CONFIG = {
  complaint:    { icon: ErrorOutlinedIcon,        color: "warning.main",   label: "Complaint",    chipColor: "warning" },
  visitor:      { icon: VerifiedUserOutlinedIcon,   color: "info.main",      label: "Visitor",      chipColor: "info" },
  payment:      { icon: PaymentOutlinedIcon,       color: "error.main",     label: "Payment",      chipColor: "error" },
  event:        { icon: EventNoteOutlinedIcon,     color: "success.main",   label: "Event",        chipColor: "success" },
  announcement: { icon: CampaignOutlinedIcon,      color: "primary.main",   label: "Announcement", chipColor: "primary" },
  emergency:    { icon: ReportProblemOutlinedIcon, color: "error.main",     label: "Emergency",    chipColor: "error" },
  booking:      { icon: BookmarkOutlinedIcon,      color: "success.main",   label: "Booking",      chipColor: "success" },
  forum:        { icon: ForumOutlinedIcon,         color: "text.secondary", label: "Forum",        chipColor: "default" },
};

const TABS = [
  { key: "all",          label: "All" },
  { key: "complaint",    label: "Complaints" },
  { key: "visitor",      label: "Visitors" },
  { key: "payment",      label: "Payments" },
  // Facility and temple bookings arrive as their own type; without a tab they
  // were only reachable under "All".
  { key: "booking",      label: "Bookings" },
  { key: "event",        label: "Events" },
  { key: "announcement", label: "Announcements" },
  { key: "emergency",    label: "Emergency" },
];

function NotifRow({ notif, onRead }) {
  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.announcement;
  const Icon = cfg.icon;

  return (
    <ListItemButton
      alignItems="flex-start"
      onClick={() => onRead(notif.id)}
      sx={{
        bgcolor: notif.read ? "transparent" : "primary.light",
        borderLeft: "3px solid",
        borderColor: notif.read ? "transparent" : "secondary.main",
        borderRadius: 1,
        mb: 0.5,
        "&:hover": { bgcolor: "action.hover" },
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      <ListItemAvatar sx={{ minWidth: 44, mt: 0.5 }}>
        <Box
          sx={{
            width: 36, height: 36, borderRadius: 2,
            bgcolor: "primary.light",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon sx={{ fontSize: 18, color: cfg.color }} />
        </Box>
      </ListItemAvatar>
      <ListItemText
        slotProps={{ secondary: { component: "div" } }}
        primary={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip label={cfg.label} size="small" color={cfg.chipColor} sx={{ height: 18, fontSize: 10 }} />
            {!notif.read && (
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "secondary.main", flexShrink: 0 }} />
            )}
          </Box>
        }
        secondary={
          <>
            <Typography
              variant="body2"
              fontWeight={notif.read ? 400 : 700}
              color="text.primary"
              sx={{ mt: 0.25 }}
            >
              {notif.title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.5, mt: 0.25 }}>
              {notif.message}
            </Typography>
            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: "block" }}>
              {notif.time}
            </Typography>
          </>
        }
      />
      {!notif.read && (
        <Typography variant="caption" color="primary.main" sx={{ flexShrink: 0, mt: 1 }}>
          tap to read
        </Typography>
      )}
    </ListItemButton>
  );
}

export default function NotificationCenterPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [toastMsg, setToastMsg] = useState("");
  // Shared with the navbar bell, so the badge follows what happens here.
  const {
    notifications, unreadCount, loading, offline, error,
    hasResident, markRead, markAllRead, clearAll, dismissError,
  } = useNotifications();

  const filtered =
    activeTab === "all" ? notifications : notifications.filter((n) => n.type === activeTab);

  const filteredUnread = filtered.filter((n) => !n.read).length;

  const handleRead = (id) => markRead(id);

  const handleMarkAll = async () => {
    await markAllRead();
    setToastMsg("All notifications marked as read.");
  };

  const handleClearAll = async () => {
    const result = await clearAll();
    setToastMsg(
      result?.deleted
        ? `Cleared ${result.deleted} notification${result.deleted === 1 ? "" : "s"}.`
        : "There was nothing to clear."
    );
  };

  const STAT_CARDS = [
    { title: "Total",    value: notifications.length, icon: NotificationsOutlinedIcon,    color: "primary.main" },
    { title: "Unread",   value: unreadCount,           icon: CampaignOutlinedIcon,          color: "warning.main" },
    { title: "Emergency",value: notifications.filter((n) => n.type === "emergency").length, icon: ReportProblemOutlinedIcon, color: "error.main" },
    { title: "Payments", value: notifications.filter((n) => n.type === "payment").length,   icon: PaymentOutlinedIcon,       color: "info.main" },
  ];

  return (
    <Box>
      <PageHeader
        title="Notification Center"
        subtitle="All alerts across modules - complaints, visitors, payments, events, and more"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Notifications" }]}
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            {unreadCount > 0 && (
              <Tooltip title="Mark all as read">
                <IconButton onClick={handleMarkAll} size="small" color="primary">
                  <DoneAllOutlinedIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Clear all notifications">
              <IconButton onClick={handleClearAll} size="small" color="error">
                <DeleteOutlineOutlinedIcon />
              </IconButton>
            </Tooltip>
          </Box>
        }
      />

      {offline && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Showing sample notifications - the server is unreachable.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={dismissError}>
          {error}
        </Alert>
      )}
      {!loading && !hasResident && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This account is not linked to a resident record, so it has no notifications.
        </Alert>
      )}

      {/* Toast */}
      {toastMsg && (
        <Alert severity="success" onClose={() => setToastMsg("")} sx={{ mb: 2 }}>
          {toastMsg}
        </Alert>
      )}

      {/* Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, mb: 3 }}>
        {STAT_CARDS.map((c) => (
          <DashboardCard key={c.title} title={c.title} value={c.value} icon={c.icon} color={c.color} />
        ))}
      </Box>

      {/* Unread banner */}
      {filteredUnread > 0 && (
        <Alert
          severity="info"
          sx={{ mb: 2, bgcolor: "primary.light", color: "primary.dark" }}
          action={
            <Chip
              label="Mark all read"
              size="small"
              onClick={handleMarkAll}
              sx={{ cursor: "pointer", bgcolor: "primary.main", color: "white" }}
            />
          }
        >
          <strong>{filteredUnread}</strong> unread notification{filteredUnread !== 1 ? "s" : ""}
        </Alert>
      )}

      {/* Filter tabs */}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1, borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper",
            "& .MuiTab-root": { fontSize: 12.5, minHeight: 44, textTransform: "none", fontWeight: 500 },
            "& .Mui-selected": { color: "primary.main", fontWeight: 700 },
          }}
        >
          {TABS.map((t) => {
            const cnt = t.key === "all"
              ? notifications.filter((n) => !n.read).length
              : notifications.filter((n) => n.type === t.key && !n.read).length;
            return (
              <Tab
                key={t.key}
                value={t.key}
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    {t.label}
                    {cnt > 0 && (
                      <Chip
                        label={cnt}
                        size="small"
                        color="warning"
                        sx={{ height: 18, fontSize: 10, fontWeight: 700 }}
                      />
                    )}
                  </Box>
                }
              />
            );
          })}
        </Tabs>

        {/* Notification list */}
        {loading ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 10, gap: 2 }}>
            <Typography variant="body2" color="text.secondary">Loading notifications…</Typography>
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 10, gap: 2 }}>
            <NotificationsOutlinedIcon sx={{ fontSize: 56, color: "text.disabled" }} />
            <Typography variant="h6" color="text.secondary" fontWeight={600}>All caught up!</Typography>
            <Typography variant="body2" color="text.disabled">No notifications in this category.</Typography>
          </Box>
        ) : (
          <List dense disablePadding sx={{ px: 1.5, py: 1 }}>
            {filtered.map((n, i) => (
              <Box key={n.id}>
                <NotifRow notif={n} onRead={handleRead} />
                {i < filtered.length - 1 && <Divider sx={{ my: 0.25 }} />}
              </Box>
            ))}
          </List>
        )}
      </Paper>

      <Typography variant="caption" color="text.disabled" sx={{ display: "block", textAlign: "center", mt: 2 }}>
        {filtered.length} notification{filtered.length !== 1 ? "s" : ""} · Click any row to mark as read
      </Typography>
    </Box>
  );
}

