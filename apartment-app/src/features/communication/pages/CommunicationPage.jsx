// FE-27: Communication Hub - central navigation screen for all communication features
import {
  Box, Card, CardContent, Chip, Divider, Grid, Typography,
} from "@mui/material";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import CreateOutlinedIcon from "@mui/icons-material/CreateOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useNavigate } from "react-router-dom";
import { getUnreadCount, getAnnouncements, getForumPosts, eventsData } from "../mock/communicationData";
import PageHeader from "../../../components/common/PageHeader";

const MODULES = [
  {
    title: "Announcements",
    description: "View society notices, updates, and past communications",
    icon: CampaignOutlinedIcon,
    path: "/announcements",
    color: "primary",
    badge: null,
    role: "All Residents",
    feId: "FE-04",
  },
  {
    title: "Notification Center",
    description: "All alerts - complaints, payments, events, and more",
    icon: NotificationsOutlinedIcon,
    path: "/notifications",
    color: "warning",
    badge: () => getUnreadCount() || null,
    role: "All Roles",
    feId: "FE-37",
  },
  {
    title: "Discussion Forum",
    description: "Community discussions, Lost & Found, and recommendations",
    icon: ForumOutlinedIcon,
    path: "/forum",
    color: "info",
    badge: () => getForumPosts().length || null,
    role: "Residents",
    feId: "FE-29",
  },
  {
    title: "Community Events",
    description: "RSVP and volunteer for upcoming society events",
    icon: EventNoteOutlinedIcon,
    path: "/events",
    color: "success",
    badge: () => eventsData.filter((e) => e.type === "upcoming" && e.status === "Open").length || null,
    role: "Residents",
    feId: "FE-31",
  },
  {
    title: "Community Corners",
    description: "Kids, Senior, Recreational, and Social activities",
    icon: AutoStoriesOutlinedIcon,
    path: "/corners",
    color: "secondary",
    badge: null,
    role: "Residents",
    feId: "FE-34",
  },
  {
    title: "Create Announcement",
    description: "Compose, schedule, and publish society notices",
    icon: CreateOutlinedIcon,
    path: "/communication/create",
    color: "primary",
    badge: null,
    role: "President",
    feId: "FE-08",
  },
  {
    title: "Emergency Alert",
    description: "Broadcast urgent alerts immediately to all residents",
    icon: ReportProblemOutlinedIcon,
    path: "/communication/emergency",
    color: "error",
    badge: null,
    role: "President",
    feId: "FE-19",
  },
];

export default function CommunicationPage() {
  const navigate = useNavigate();
  const unread = getUnreadCount();
  const announcements = getAnnouncements();

  return (
    <Box>
      <PageHeader
        title="Communication Hub"
        subtitle="FE-27 · Unified centre for announcements, alerts, forum, events, and community activities"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Communication" }]}
      />

      {/* Quick stats strip */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        {[
          { label: "Unread notifications", value: unread, color: "warning.main" },
          { label: "Active announcements", value: announcements.length, color: "primary.main" },
          { label: "Upcoming events", value: eventsData.filter((e) => e.type === "upcoming").length, color: "success.main" },
          { label: "Forum posts", value: getForumPosts().length, color: "info.main" },
        ].map((s) => (
          <Box key={s.label} sx={{ display: "flex", alignItems: "center", gap: 1, px: 2, py: 1, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
            <Typography variant="h6" fontWeight={800} color={s.color}>{s.value}</Typography>
            <Typography variant="caption" color="text.secondary">{s.label}</Typography>
          </Box>
        ))}
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Module grid */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2.5 }}>
        {MODULES.map((m) => {
          const Icon = m.icon;
          const badgeVal = typeof m.badge === "function" ? m.badge() : m.badge;

          return (
            <Card
              key={m.feId}
              elevation={1}
              onClick={() => navigate(m.path)}
              sx={{
                borderRadius: 2, cursor: "pointer", border: "1px solid",
                borderColor: "divider",
                transition: "all 0.15s ease",
                "&:hover": {
                  boxShadow: 4,
                  borderColor: `${m.color}.main`,
                  transform: "translateY(-2px)",
                },
              }}
            >
              <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
                  <Box
                    sx={{
                      width: 44, height: 44, borderRadius: 2.5,
                      bgcolor: `${m.color}.light`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    <Icon sx={{ color: `${m.color}.main`, fontSize: 22 }} />
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
                    {badgeVal && (
                      <Chip
                        label={badgeVal}
                        size="small"
                        color={m.color === "error" ? "error" : "warning"}
                        sx={{ height: 20, fontSize: 10, fontWeight: 700 }}
                      />
                    )}
                    <ArrowForwardIcon sx={{ fontSize: 16, color: "text.disabled" }} />
                  </Box>
                </Box>

                <Typography variant="subtitle1" fontWeight={700} gutterBottom sx={{ lineHeight: 1.3 }}>
                  {m.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55, mb: 1.5 }}>
                  {m.description}
                </Typography>

                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Chip
                    label={m.role}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: 10, height: 18 }}
                  />
                  <Typography variant="caption" color="text.disabled">{m.feId}</Typography>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}

