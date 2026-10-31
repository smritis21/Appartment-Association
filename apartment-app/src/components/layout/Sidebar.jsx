// Updated Sidebar - adds communication section nav items
import { useState } from "react";
import { useTheme } from "@mui/material/styles";
import {
  Box,
  Collapse,
  Divider,
  useMediaQuery,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from "@mui/material";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ContactsOutlinedIcon from "@mui/icons-material/ContactsOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import QrCode2OutlinedIcon from "@mui/icons-material/QrCode2Outlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import TempleHinduOutlinedIcon from "@mui/icons-material/TempleHinduOutlined";
import EventAvailableOutlinedIcon from "@mui/icons-material/EventAvailableOutlined";
import CleaningServicesOutlinedIcon from "@mui/icons-material/CleaningServicesOutlined";
import HandymanOutlinedIcon from "@mui/icons-material/HandymanOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
// Communication feature icons
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppContext } from "../../context/AppContext";
import { useAuth } from "../../hooks/useAuth";
import { ROLES, MANAGEMENT_ROLES, RESIDENT_ROLES } from "../../constants/roles";
import appConfig from "../../config/appConfig";

const DRAWER_WIDTH = 260;

// Bug 23: each nav entry carries a `tKey` into sidebar.* in the i18n resource
// files (see src/i18n/*.json). `label` stays as the English fallback used
// when a key is missing translation coverage - the pattern used to expand
// coverage incrementally is: add the key to all three JSON files, then set
// tKey here.
// canSee() below checks each entry's `roles`. Management-facing screens
// (Residents, Audit Logs, ...) are gated via `roles`; broadly-applicable
// ones (Dashboard, Directory, AI Assistant, ...) omit it and stay open to
// every role.
const MAIN_NAV = [
  { label: "Dashboard",       tKey: "sidebar.dashboard",      icon: DashboardOutlinedIcon,   path: "/dashboard" },
  { label: "Assigned Tasks",  tKey: "sidebar.assignedTasks",  icon: BuildOutlinedIcon,       path: "/complaints/progress", roles: [ROLES.MAINTENANCE, ...MANAGEMENT_ROLES] },
  { label: "Residents",       tKey: "sidebar.residents",      icon: PeopleOutlinedIcon,       path: "/residents", roles: MANAGEMENT_ROLES },
  { label: "Approval Queue",  tKey: "sidebar.approvalQueue",  icon: HowToRegOutlinedIcon,     path: "/onboarding/approval-queue", roles: MANAGEMENT_ROLES },
  {
    label: "Visitors",
    tKey: "sidebar.visitors",
    icon: MeetingRoomOutlinedIcon,
    roles: [...RESIDENT_ROLES, ...MANAGEMENT_ROLES, ROLES.SECURITY],
    children: [
      { label: "Visitor Approvals", tKey: "sidebar.visitorApprovals", icon: MeetingRoomOutlinedIcon, path: "/visitors/approvals", roles: RESIDENT_ROLES },
      { label: "Visitor Passes",    tKey: "sidebar.visitorPasses",    icon: QrCode2OutlinedIcon,     path: "/visitors/passes", roles: [...RESIDENT_ROLES, ...MANAGEMENT_ROLES] },
      // Gate desk checks visitors in/out at the gate - security/management, not residents.
      { label: "Gate Desk",         tKey: "sidebar.gateDesk",         icon: ShieldOutlinedIcon,      path: "/visitors/gate", roles: [ROLES.SECURITY, ...MANAGEMENT_ROLES] },
    ],
  },
  { label: "AI Assistant",    tKey: "sidebar.aiAssistant",    icon: SmartToyOutlinedIcon,     path: "/assistant", roles: [...RESIDENT_ROLES, ...MANAGEMENT_ROLES, ROLES.MAINTENANCE] },
  { label: "Directory",       tKey: "sidebar.directory",      icon: ContactsOutlinedIcon,     path: "/directory", roles: MANAGEMENT_ROLES },
  { label: "Complaints",      tKey: "sidebar.complaints",     icon: ReportProblemOutlinedIcon, path: "/complaints", roles: RESIDENT_ROLES },
  { label: "Complaint Desk",  tKey: "sidebar.complaintDesk",  icon: SupportAgentOutlinedIcon, path: "/complaints/monitoring", roles: [ROLES.PRESIDENT, ROLES.ADMIN] },
  { label: "Analytics",       tKey: "sidebar.analytics",      icon: InsightsOutlinedIcon,     path: "/analytics", roles: [ROLES.PRESIDENT, ROLES.ADMIN] },
  // Payments & billing
  { label: "Payments",        tKey: "sidebar.payments",       icon: PaymentOutlinedIcon,      path: "/payments", roles: [...RESIDENT_ROLES, ...MANAGEMENT_ROLES] },
  { label: "Billing",         tKey: "sidebar.billing",        icon: ReceiptOutlinedIcon,      path: "/billing", roles: MANAGEMENT_ROLES },
  { label: "Reminders",       tKey: "sidebar.reminders",      icon: NotificationsOutlinedIcon,path: "/reminders", roles: [...RESIDENT_ROLES, ...MANAGEMENT_ROLES] },
  { label: "Documents",       tKey: "sidebar.documents",      icon: FolderOutlinedIcon,       path: "/documents", roles: MANAGEMENT_ROLES },
  { label: "Audit Logs",      tKey: "sidebar.auditLogs",      icon: HistoryOutlinedIcon,      path: "/audit", roles: [ROLES.ADMIN] },
  // Settings stays open to everyone
  { label: "Settings",        tKey: "sidebar.settings",       icon: SettingsOutlinedIcon,     path: "/settings" },
];

// Community services - temple, facilities, house help
const SERVICES_NAV = [
  { label: "Temple",              icon: TempleHinduOutlinedIcon,     path: "/temple", roles: [...RESIDENT_ROLES, ...MANAGEMENT_ROLES] },
  { label: "Facilities",          icon: EventAvailableOutlinedIcon,  path: "/facilities", exact: true, roles: [...RESIDENT_ROLES, ...MANAGEMENT_ROLES] },
  { label: "Marketplace",         icon: StorefrontOutlinedIcon,      path: "/marketplace", roles: [...RESIDENT_ROLES, ...MANAGEMENT_ROLES] },
  { label: "House Help",          icon: CleaningServicesOutlinedIcon, path: "/workforce", roles: [...RESIDENT_ROLES, ...MANAGEMENT_ROLES] },
];

// Manager / secretary operations - maintenance & staffing.
const OPS_NAV = [
  {
    label: "Maintenance",
    icon: BuildOutlinedIcon,
    roles: [ROLES.MAINTENANCE, ...MANAGEMENT_ROLES],
    children: [
      { label: "Staff Workload",      icon: GroupsOutlinedIcon,         path: "/maintenance/workload", roles: [ROLES.MAINTENANCE, ...MANAGEMENT_ROLES] },
      { label: "Work Orders",         icon: BuildOutlinedIcon,          path: "/maintenance/work-orders", roles: [ROLES.MAINTENANCE, ...MANAGEMENT_ROLES] },
      { label: "Schedule Maintenance",icon: PendingActionsOutlinedIcon, path: "/maintenance/schedule", roles: MANAGEMENT_ROLES },
      { label: "Maintenance Calendar",icon: CalendarMonthOutlinedIcon,  path: "/maintenance/calendar", roles: [ROLES.MAINTENANCE, ...MANAGEMENT_ROLES] },
      { label: "Assets",              icon: Inventory2OutlinedIcon,     path: "/maintenance/assets", roles: [ROLES.MAINTENANCE, ...MANAGEMENT_ROLES] },
    ],
  },
  { label: "Facility Bookings", icon: EventAvailableOutlinedIcon, path: "/facilities/bookings", roles: MANAGEMENT_ROLES },
];

// FE-27: Communication section in sidebar
const COMM_NAV = [
  { label: "Communication",   tKey: "sidebar.communication",   icon: HubOutlinedIcon,          path: "/communication" },
  { label: "Announcements",   tKey: "sidebar.announcements",   icon: CampaignOutlinedIcon,     path: "/announcements" },
  { label: "Notifications",   tKey: "sidebar.notifications",   icon: NotificationsOutlinedIcon,path: "/notifications" },
  { label: "Forum",           tKey: "sidebar.forum",           icon: ForumOutlinedIcon,        path: "/forum" },
  { label: "Events",          tKey: "sidebar.events",          icon: EventNoteOutlinedIcon,    path: "/events" },
  { label: "Corners",         tKey: "sidebar.corners",         icon: AutoStoriesOutlinedIcon,  path: "/corners" },
];

function NavItem({ label, tKey, icon: Icon, path, pathname, exact = false }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { sidebarOpen, toggleSidebar } = useAppContext();
  const isMobile = useMediaQuery(useTheme().breakpoints.down("md"));
  const active = exact
    ? pathname === path
    : pathname === path || (path !== "/dashboard" && path !== "/communication" && pathname.startsWith(path));

  const handleClick = () => {
    navigate(path);
    // Overlay drawer covers the page on phones - tuck it away after navigating.
    if (isMobile && sidebarOpen) toggleSidebar();
  };

  return (
    <ListItemButton
      onClick={handleClick}
      selected={active}
      sx={{
        borderRadius: 2,
        mb: 0.5,
        "&.Mui-selected": {
          bgcolor: "primary.light",
          color: "primary.main",
          "& .MuiListItemIcon-root": { color: "primary.main" },
        },
        "&.Mui-selected:hover": { bgcolor: "primary.light" },
      }}
    >
      <ListItemIcon sx={{ minWidth: 36 }}>
        <Icon fontSize="small" />
      </ListItemIcon>
      <ListItemText
        primary={tKey ? t(tKey, { defaultValue: label }) : label}
        slotProps={{ primary: { fontSize: 13.5, fontWeight: active ? 600 : 400 } }}
      />
    </ListItemButton>
  );
}

// Collapsible parent for pages that live under one section (e.g. /workforce/*).
function NavGroup({ label, tKey, icon: Icon, children: items, pathname }) {
  const { t } = useTranslation();
  const childActive = items.some(
    (i) => pathname === i.path || pathname.startsWith(i.path + "/")
  );
  const [open, setOpen] = useState(childActive);

  return (
    <>
      <ListItemButton onClick={() => setOpen((o) => !o)} sx={{ borderRadius: 2, mb: 0.5 }}>
        <ListItemIcon sx={{ minWidth: 36 }}>
          <Icon fontSize="small" sx={childActive ? { color: "primary.main" } : undefined} />
        </ListItemIcon>
        <ListItemText
          primary={tKey ? t(tKey, { defaultValue: label }) : label}
          slotProps={{ primary: { fontSize: 13.5, fontWeight: childActive ? 600 : 400 } }}
        />
        {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <List dense disablePadding sx={{ pl: 1.5 }}>
          {items.map((item) => (
            <NavItem key={item.path} {...item} pathname={pathname} />
          ))}
        </List>
      </Collapse>
    </>
  );
}

export default function Sidebar({ className }) {
  const { t } = useTranslation();
  const { sidebarOpen, toggleSidebar } = useAppContext();
  const { user } = useAuth();
  const { pathname } = useLocation();
  const theme = useTheme();
  // Overlay drawer on phones/tablets, docked on desktop.
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  // Hide items whose route would just bounce this role back to the dashboard.
  const canSee = (item) => !item.roles || (user && item.roles.includes(user.role));
  const filterNav = (entries) =>
    entries
      .filter(canSee)
      .map((e) => (e.children ? { ...e, children: e.children.filter(canSee) } : e))
      .filter((e) => !e.children || e.children.length > 0);
  const mainNav = filterNav(MAIN_NAV);
  const servicesNav = filterNav(SERVICES_NAV);
  const opsNav = filterNav(OPS_NAV);
  const commNav = filterNav(COMM_NAV);

  return (
    <Drawer
      className={className}
      variant={isMobile ? "temporary" : "persistent"}
      open={sidebarOpen}
      onClose={toggleSidebar}
      ModalProps={{ keepMounted: true }}
      sx={{
        width: !isMobile && sidebarOpen ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        transition: "width 0.25s cubic-bezier(0.22,1,0.36,1)",
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          boxSizing: "border-box",
          borderRight: "1px solid",
          borderColor: "divider",
          bgcolor: "background.paper",
        },
      }}
    >
      <Toolbar />

      {/* App label */}
      <Box sx={{ px: 2, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="caption" color="text.secondary" fontFamily="var(--font-mono)" letterSpacing={1}>
          {t("sidebar.appLabel", { shortName: appConfig.appShortName, defaultValue: `${appConfig.appShortName} · Management` })}
        </Typography>
      </Box>

      {/* Main nav */}
      <List dense sx={{ px: 1, pt: 1 }}>
        {mainNav.map((entry) =>
          entry.children ? (
            <NavGroup key={entry.label} {...entry} pathname={pathname} />
          ) : (
            <NavItem key={entry.path} {...entry} pathname={pathname} />
          )
        )}
      </List>

      <Divider sx={{ mx: 2, my: 0.5 }} />

      {/* Communication section */}
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="overline" color="text.disabled" sx={{ fontSize: 10, letterSpacing: 1 }}>
          {t("sidebar.communicationSection", { defaultValue: "Communication" })}
        </Typography>
      </Box>
      <List dense sx={{ px: 1, pb: 1 }}>
        {commNav.map((item) => (
          <NavItem key={item.path} {...item} pathname={pathname} />
        ))}
      </List>

      {/* Community services section */}
      <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
        <Typography variant="overline" color="text.disabled" sx={{ fontSize: 10, letterSpacing: 1 }}>
          {t("sidebar.servicesSection", { defaultValue: "Services" })}
        </Typography>
      </Box>
      <List dense sx={{ px: 1, pb: 1 }}>
        {servicesNav.map((entry) =>
          entry.children ? (
            <NavGroup key={entry.label} {...entry} pathname={pathname} />
          ) : (
            <NavItem key={entry.path} {...entry} pathname={pathname} />
          )
        )}
      </List>

      {/* Maintenance & staffing operations - management roles only */}
      {opsNav.length > 0 && (
        <>
          <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
            <Typography variant="overline" color="text.disabled" sx={{ fontSize: 10, letterSpacing: 1 }}>
              {t("sidebar.operationsSection", { defaultValue: "Operations" })}
            </Typography>
          </Box>
          <List dense sx={{ px: 1, pb: 1 }}>
            {opsNav.map((entry) =>
              entry.children ? (
                <NavGroup key={entry.label} {...entry} pathname={pathname} />
              ) : (
                <NavItem key={entry.path} {...entry} pathname={pathname} />
              )
            )}
          </List>
        </>
      )}
    </Drawer>
  );
}

