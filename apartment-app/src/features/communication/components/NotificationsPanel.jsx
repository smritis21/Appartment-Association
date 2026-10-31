// FE-03: NotificationsPanel - slide-over drawer
import {
  Badge, Box, Chip, Divider, Drawer, IconButton,
  List, ListItem, ListItemAvatar, ListItemText,
  Tooltip, Typography,
} from "@mui/material";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import BookmarkOutlinedIcon from "@mui/icons-material/BookmarkOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useNotifications } from "../../../context/NotificationContext";

const TYPE_CONFIG = {
  complaint:    { icon: ErrorOutlinedIcon,         color: "warning.main",   label: "Complaint" },
  visitor:      { icon: VerifiedUserOutlinedIcon,  color: "info.main",      label: "Visitor" },
  payment:      { icon: PaymentOutlinedIcon,       color: "error.main",     label: "Payment" },
  event:        { icon: EventNoteOutlinedIcon,     color: "success.main",   label: "Event" },
  announcement: { icon: CampaignOutlinedIcon,      color: "primary.main",   label: "Announcement" },
  emergency:    { icon: ReportProblemOutlinedIcon, color: "error.main",     label: "Emergency" },
  booking:      { icon: BookmarkOutlinedIcon,      color: "success.main",   label: "Booking" },
  forum:        { icon: ForumOutlinedIcon,         color: "text.secondary", label: "Forum" },
};

function NotificationItem({ notif, onRead }) {
  const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.announcement;
  const Icon = cfg.icon;

  return (
    <ListItem
      alignItems="flex-start"
      button
      onClick={() => onRead(notif.id)}
      sx={{
        bgcolor: notif.read ? "transparent" : "primary.light",
        borderLeft: notif.read ? "none" : "3px solid",
        borderColor: "secondary.main",
        borderRadius: 1,
        mb: 0.5,
        "&:hover": { bgcolor: "action.hover" },
        transition: "background 0.15s",
        cursor: "pointer",
      }}
    >
      <ListItemAvatar sx={{ minWidth: 40, mt: 0.5 }}>
        <Box
          sx={{
            width: 32, height: 32, borderRadius: 2,
            bgcolor: "primary.light",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon sx={{ fontSize: 16, color: cfg.color }} />
        </Box>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" fontWeight={notif.read ? 400 : 700} sx={{ lineHeight: 1.4 }}>
              {notif.title}
            </Typography>
            {!notif.read && (
              <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "secondary.main", flexShrink: 0 }} />
            )}
          </Box>
        }
        secondary={
          <>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.5, mt: 0.25 }}>
              {notif.message}
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
              <Chip label={cfg.label} size="small" sx={{ height: 18, fontSize: 10, bgcolor: "primary.light", color: "primary.main" }} />
              <Typography variant="caption" color="text.disabled">{notif.time}</Typography>
            </Box>
          </>
        }
      />
    </ListItem>
  );
}

export default function NotificationsPanel() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // Shared with the notification centre, so clearing or reading in one place
  // updates the badge here too.
  const { notifications, unreadCount, refresh, markRead, markAllRead } = useNotifications();

  const handleRead = (id) => markRead(id);
  const handleMarkAll = () => markAllRead();

  const handleViewAll = () => { setOpen(false); navigate("/notifications"); };

  return (
    <>
      {/* Bell icon in Navbar */}
      <Tooltip title="Notifications">
        <IconButton size="small" onClick={() => { setOpen(true); refresh(); }}>
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsOutlinedIcon />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Slide-over Drawer */}
      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: 380, display: "flex", flexDirection: "column" } }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            px: 2.5, py: 2,
            bgcolor: "primary.main", color: "white",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <NotificationsOutlinedIcon sx={{ fontSize: 20 }} />
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                Notifications
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.7 }}>
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            {unreadCount > 0 && (
              <Tooltip title="Mark all read">
                <IconButton size="small" onClick={handleMarkAll} sx={{ color: "white" }}>
                  <DoneAllOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: "white" }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Unread banner */}
        {unreadCount > 0 && (
          <Box sx={{ px: 2.5, py: 1, bgcolor: "secondary.light", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography variant="caption" color="secondary.dark" fontWeight={600}>
              {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
            </Typography>
            <Typography
              variant="caption" color="secondary.dark" fontWeight={700}
              sx={{ cursor: "pointer", textDecoration: "underline" }}
              onClick={handleMarkAll}
            >
              Clear
            </Typography>
          </Box>
        )}

        {/* List */}
        <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 1 }}>
          {notifications.length === 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 200, gap: 2 }}>
              <NotificationsOutlinedIcon sx={{ fontSize: 48, color: "text.disabled" }} />
              <Typography variant="body2" color="text.secondary">All caught up! No notifications.</Typography>
            </Box>
          ) : (
            <List dense disablePadding>
              {notifications.map((n) => (
                <NotificationItem key={n.id} notif={n} onRead={handleRead} />
              ))}
            </List>
          )}
        </Box>

        <Divider />

        {/* Footer */}
        <Box sx={{ px: 2.5, py: 2 }}>
          <Box
            component="button"
            onClick={handleViewAll}
            sx={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 1, py: 1.25, borderRadius: 2,
              bgcolor: "primary.light", color: "primary.main",
              fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer",
              "&:hover": { bgcolor: "primary.main", color: "white" },
              transition: "all 0.15s",
            }}
          >
            View Notification Center <ArrowForwardIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>
      </Drawer>
    </>
  );
}

