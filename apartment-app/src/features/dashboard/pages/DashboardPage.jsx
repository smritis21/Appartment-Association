import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Skeleton,
  Tooltip,
  Typography,
} from "@mui/material";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import QrCode2OutlinedIcon from "@mui/icons-material/QrCode2Outlined";
import TempleHinduOutlinedIcon from "@mui/icons-material/TempleHinduOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import HandymanOutlinedIcon from "@mui/icons-material/HandymanOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import CleaningServicesOutlinedIcon from "@mui/icons-material/CleaningServicesOutlined";
import ContactsOutlinedIcon from "@mui/icons-material/ContactsOutlined";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import DashboardCard from "../../../components/cards/DashboardCard";
import { useAuth } from "../../../hooks/useAuth";
import { ROLES, ROLE_LABELS, MANAGEMENT_ROLES, RESIDENT_ROLES } from "../../../constants/roles";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDate } from "../../../utils/formatDate";
import { OVERVIEW, RECENT_ANNOUNCEMENTS, UPCOMING_EVENTS } from "../mock/overview";
import { mockPasses, getOnPremiseVisitors } from "../../visitors/mock/passes";
import { useComplaintStats } from "../../../hooks/useComplaintStats";

// INT-07 - DashboardPage now reads the "Open Complaints" count from
// GET /complaints/stats (BE-07) via useComplaintStats. The hook handles the
// offline fallback automatically (same pattern as ComplaintMonitoringPage),
// so the card still renders meaningful data when the backend is unreachable.

const RESIDENT_QUICK_ACTIONS = [
  { label: "Pay Bill", icon: PaymentsOutlinedIcon, path: "/payments" },
  { label: "Raise Complaint", icon: ReportProblemOutlinedIcon, path: "/complaints/new" },
  { label: "Visitor Pass", icon: QrCode2OutlinedIcon, path: "/visitors/passes" },
  { label: "Book Facility", icon: EventAvailableOutlinedIcon, path: "/facilities" },
  { label: "Temple Sevas", icon: TempleHinduOutlinedIcon, path: "/temple" },
  { label: "Marketplace", icon: StorefrontOutlinedIcon, path: "/marketplace" },
  { label: "Ask Assistant", icon: SmartToyOutlinedIcon, path: "/assistant" },
];

const MAINTENANCE_QUICK_ACTIONS = [
  { label: "Assigned Tasks", icon: BuildOutlinedIcon, path: "/complaints/progress" },
  { label: "Staff Workload", icon: GroupsOutlinedIcon, path: "/maintenance/workload" },
  { label: "Work Orders", icon: PendingActionsOutlinedIcon, path: "/maintenance/work-orders" },
  { label: "Workforce", icon: HandymanOutlinedIcon, path: "/workforce/services" },
  { label: "Announcements", icon: CampaignOutlinedIcon, path: "/announcements" },
  { label: "Ask Assistant", icon: SmartToyOutlinedIcon, path: "/assistant" },
];

const SECURITY_QUICK_ACTIONS = [
  { label: "Gate Desk", icon: MeetingRoomOutlinedIcon, path: "/visitors/gate" },
  { label: "Visitor Passes", icon: QrCode2OutlinedIcon, path: "/visitors/passes" },
  { label: "Announcements", icon: CampaignOutlinedIcon, path: "/announcements" },
];

// Bug 23: greeting key resolved through i18n - t() falls back to the
// English string below when a language's translation is missing.
function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return ["dashboard.goodMorning", "Good morning"];
  if (h < 17) return ["dashboard.goodAfternoon", "Good afternoon"];
  return ["dashboard.goodEvening", "Good evening"];
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [greetKey, greetDefault] = greetingKey();

  const isMaintenance = user?.role === ROLES.MAINTENANCE;
  const isSecurity = user?.role === ROLES.SECURITY;

  // Billing / visitors - still from local context (no billing API yet in this sprint)
  const dues = OVERVIEW.duesByFlat[user?.flat] ?? { amount: 0, dueDate: null };
  const onPremise = getOnPremiseVisitors(mockPasses).length;

  // INT-07: live complaint counts from GET /complaints/stats
  const { stats: complaintStats, loading: complaintLoading, offline: complaintOffline } =
    useComplaintStats(1); // trend window of 1 month is enough; we only need the counts

  // "Open Complaints" = pending (submitted) + ongoing (assigned / in_progress)
  const openComplaints =
    complaintStats != null
      ? (complaintStats.pending ?? 0) + (complaintStats.ongoing ?? 0)
      : null;

  const quickActions = isMaintenance
    ? MAINTENANCE_QUICK_ACTIONS
    : isSecurity
    ? SECURITY_QUICK_ACTIONS
    : RESIDENT_QUICK_ACTIONS;

  return (
    <Box sx={{ maxWidth: 1280, mx: "auto" }}>
      {/* Welcome header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          {t(greetKey, { defaultValue: greetDefault })}, {user?.name?.split(" ")[0] ?? "Resident"}
        </Typography>
        <Chip label={ROLE_LABELS[user?.role] ?? "Resident"} color="primary" variant="outlined" size="small" />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: -2, mb: 3 }}>
        {t("dashboard.subtitle", { defaultValue: "Here's what's happening in the community today" })}
      </Typography>

      {/* Offline notice - only shown when the stats API is unreachable */}
      {complaintOffline && (
        <Tooltip title="Could not reach the complaints API - showing locally computed figures">
          <Chip
            icon={<CloudOffOutlinedIcon />}
            label="Complaints count: offline estimate"
            color="warning"
            variant="outlined"
            size="small"
            sx={{ mb: 2 }}
          />
        </Tooltip>
      )}

      {/* Overview stats */}
      <Grid container spacing={2} sx={{ mb: 3.5 }}>
        {isMaintenance ? (
          <>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <DashboardCard
                title="Assigned Tasks"
                value={openComplaints ?? 0}
                subtitle="Awaiting resolution · Click to manage"
                icon={BuildOutlinedIcon}
                color="warning.main"
                onClick={() => navigate("/complaints/progress")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <DashboardCard
                title="Work Orders"
                value="Active"
                subtitle="Routine maintenance"
                icon={PendingActionsOutlinedIcon}
                color="primary.main"
                onClick={() => navigate("/maintenance/work-orders")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <DashboardCard
                title={t("dashboard.visitorsOnPremises", { defaultValue: "Visitors On Premises" })}
                value={onPremise}
                subtitle="Live at the Gate Desk"
                icon={MeetingRoomOutlinedIcon}
                color="info.main"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <DashboardCard
                title="House Help"
                value="Directory"
                subtitle="Maids, cooks & helpers"
                icon={CleaningServicesOutlinedIcon}
                color="success.main"
                onClick={() => navigate("/workforce")}
              />
            </Grid>
          </>
        ) : (
          <>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <DashboardCard
                title={t("dashboard.maintenanceDue", { defaultValue: "Maintenance Due" })}
                value={dues.amount > 0 ? formatCurrency(dues.amount) : "Nil"}
                subtitle={dues.amount > 0 ? `Due ${formatDate(dues.dueDate)}` : "You're all paid up"}
                icon={PaymentsOutlinedIcon}
                color={dues.amount > 0 ? "error.main" : "success.main"}
                onClick={() => navigate("/payments")}
              />
            </Grid>

            {/* Open Complaints - INT-07: live from /complaints/stats */}
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              {complaintLoading ? (
                <Skeleton variant="rounded" height={98} />
              ) : (
                <DashboardCard
                  title={t("dashboard.openComplaints", { defaultValue: "Open Complaints" })}
                  value={openComplaints ?? 0}
                  subtitle={openComplaints > 0 ? "Awaiting resolution" : "Nothing open"}
                  icon={ReportProblemOutlinedIcon}
                  color="warning.main"
                  onClick={() =>
                    navigate(
                      MANAGEMENT_ROLES.includes(user?.role)
                        ? "/complaints/monitoring"
                        : "/complaints"
                    )
                  }
                />
              )}
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <DashboardCard
                title={t("dashboard.visitorsOnPremises", { defaultValue: "Visitors On Premises" })}
                value={onPremise}
                subtitle="Live at the Gate Desk"
                icon={MeetingRoomOutlinedIcon}
                color="info.main"
                onClick={() => navigate("/visitors/passes")}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <DashboardCard
                title={t("dashboard.myBookings", { defaultValue: "My Bookings" })}
                value={OVERVIEW.upcomingBookings}
                subtitle={OVERVIEW.upcomingBookings > 0 ? "Upcoming reservation" : "Nothing booked"}
                icon={EventAvailableOutlinedIcon}
                color="primary.main"
                onClick={() => navigate("/facilities")}
              />
            </Grid>
          </>
        )}
      </Grid>

      {/* Quick actions - hidden for Maintenance Staff */}
      {!isMaintenance && (
        <>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>
            {t("dashboard.quickActions", { defaultValue: "Quick actions" })}
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 1.5,
              mb: 3.5,
            }}
          >
            {quickActions.map(({ label, icon: Icon, path }) => (
              <Card sx={{ borderRadius: 2 }} key={path}>
                <CardActionArea onClick={() => navigate(path)} sx={{ height: "100%" }}>
                  <CardContent sx={{ textAlign: "center", py: 2 }}>
                    <Icon sx={{ color: "primary.main", mb: 0.5 }} />
                    <Typography variant="body2" fontWeight={600} noWrap>
                      {label}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </>
      )}

      {/* Announcements + events */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 2.5, height: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <CampaignOutlinedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={700}>
                  {t("dashboard.recentAnnouncements", { defaultValue: "Recent announcements" })}
                </Typography>
              </Box>
              <Button size="small" onClick={() => navigate("/announcements")}>
                {t("dashboard.viewAll", { defaultValue: "View all" })}
              </Button>
            </Box>
            <List dense disablePadding>
              {RECENT_ANNOUNCEMENTS.map((a, i) => (
                <Box key={a.id}>
                  {i > 0 && <Divider component="li" />}
                  <ListItem disableGutters sx={{ py: 1 }}>
                    <ListItemText
                      primary={a.title}
                      secondary={`${a.category} · ${formatDate(a.date)}`}
                      slotProps={{ primary: { fontSize: 14, fontWeight: 600 } }}
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 2.5, height: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <EventNoteOutlinedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={700}>
                  {t("dashboard.upcomingEvents", { defaultValue: "Upcoming events" })}
                </Typography>
              </Box>
              <Button size="small" onClick={() => navigate("/events")}>
                {t("dashboard.viewAll", { defaultValue: "View all" })}
              </Button>
            </Box>
            <List dense disablePadding>
              {UPCOMING_EVENTS.map((e, i) => (
                <Box key={e.id}>
                  {i > 0 && <Divider component="li" />}
                  <ListItem disableGutters sx={{ py: 1 }}>
                    <ListItemText
                      primary={e.title}
                      secondary={`${formatDate(e.date)} · ${e.venue}`}
                      slotProps={{ primary: { fontSize: 14, fontWeight: 600 } }}
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

