import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import TempleHinduOutlinedIcon from "@mui/icons-material/TempleHinduOutlined";
import VolunteerActivismOutlinedIcon from "@mui/icons-material/VolunteerActivismOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import EastOutlinedIcon from "@mui/icons-material/EastOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import StatCard from "../../../components/cards/StatCard";
import ReceiptCard from "../components/ReceiptCard";
import { mockBookings } from "../mock/bookings";
import { mockDonations, purposeLabel, receiptNoFor } from "../mock/donations";
import { mockEvents } from "../mock/events";
import { SEVA_TYPES } from "../mock/sevas";
import {
  fetchSevaBookings,
  fetchDonations,
  fetchTempleEvents,
  fetchTempleEventSignups,
} from "../../../services/templeService";
import { isOffline } from "../../../services/apiClient";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDateTime } from "../../../utils/formatDate";
import { useAuthContext } from "../../../context/AuthContext";
import { MANAGEMENT_ROLES } from "../../../constants/roles";

const RESIDENT_ACTIONS = [
  { label: "Book a Seva", caption: "Abhishekam, Sandhana Kaapu, Archana", icon: TempleHinduOutlinedIcon, path: "/temple/book" },
  { label: "Make a Donation", caption: "Support temple activities", icon: VolunteerActivismOutlinedIcon, path: "/temple/donate" },
  { label: "Temple Events", caption: "View events & volunteer", icon: EventOutlinedIcon, path: "/temple/events" },
];

export default function TempleDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const canManage = MANAGEMENT_ROLES.includes(user?.role);

  const [stats, setStats] = useState({
    bookings: mockBookings.length,
    donated: mockDonations.reduce((s, d) => s + d.amount, 0),
    events: mockEvents.length,
  });
  const [upcomingEvent, setUpcomingEvent] = useState(mockEvents[0] ?? null);
  const [userBookings, setUserBookings] = useState([]);
  const [userDonations, setUserDonations] = useState([]);
  const [templeEvents, setTempleEvents] = useState(mockEvents);
  const [activeTab, setActiveTab] = useState("bookings");
  const [selectedReceipt, setSelectedReceipt] = useState(null);
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

  useEffect(() => {
    Promise.all([
      fetchSevaBookings().catch(() => null),
      fetchDonations().catch(() => null),
      fetchTempleEvents().catch(() => null),
    ]).then(([bookings, donations, events]) => {
      const activeBookings = bookings && bookings.length > 0 ? bookings : mockBookings;
      const activeDonations = donations && donations.length > 0 ? donations : mockDonations;
      const activeEvents = events && events.length > 0 ? events : mockEvents;
      setUserBookings(activeBookings);
      setUserDonations(activeDonations);
      setTempleEvents(activeEvents);
      setStats({
        bookings: activeBookings.length,
        donated: activeDonations.reduce((s, d) => s + (d.amount || 0), 0),
        events: activeEvents.length,
      });
      if (activeEvents?.length) {
        const next = activeEvents.find((e) => e.status !== "completed" && e.status !== "cancelled");
        setUpcomingEvent(next ? { title: next.title, date: next.eventDate || next.date, location: next.venue || next.location } : null);
      }
    });
  }, []);

  const totalVolunteers = templeEvents.reduce((sum, e) => {
    return sum + (e.volunteersJoined ?? 0);
  }, 0);

  // Management (Secretary / President / Admin) view - administration & event volunteer oversight.
  const MANAGE_ACTIONS = [
    {
      label: "Manage Poojas / Sevas",
      caption: "Create and update pooja offerings",
      icon: TempleHinduOutlinedIcon,
      onClick: () => navigate("/temple/manage", { state: { tab: "sevas" } }),
    },
    {
      label: "Manage Events & Volunteers",
      caption: "Publish temple events & oversee volunteer rosters",
      icon: EventOutlinedIcon,
      onClick: () => navigate("/temple/manage", { state: { tab: "events" } }),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="Temple"
        subtitle={
          canManage
            ? "Manage temple poojas, sevas, events and volunteer participation"
            : "Book poojas & sevas, donate, and take part in temple events"
        }
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Temple" }]}
        action={
          canManage ? (
            <Chip
              label={user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : "Management"}
              color="secondary"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          ) : null
        }
      />

      {canManage ? (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Poojas Offered" value={SEVA_TYPES.length} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Temple Events" value={stats.events} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Volunteers Registered" value={totalVolunteers} />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <StatCard label="Donations Received" value={formatCurrency(stats.donated)} />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {MANAGE_ACTIONS.map(({ label, caption, icon: Icon, onClick }) => (
              <Grid size={{ xs: 12, md: 6 }} key={label}>
                <Card
                  onClick={onClick}
                  sx={{
                    borderRadius: 3,
                    cursor: "pointer",
                    height: "100%",
                    border: "1.5px solid",
                    borderColor: "divider",
                    "&:hover": { borderColor: "primary.main", boxShadow: 2 },
                  }}
                >
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ bgcolor: "secondary.light", color: "secondary.main", borderRadius: 2, p: 1.25, display: "flex" }}>
                      <Icon />
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                        {label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {caption}
                      </Typography>
                    </Box>
                    <EastOutlinedIcon fontSize="small" color="action" />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Management: Events & Volunteer Participation */}
          <Box sx={{ mt: 3, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                Temple Events & Volunteer Rosters
              </Typography>
              <Button
                size="small"
                variant="outlined"
                startIcon={<EventOutlinedIcon />}
                onClick={() => navigate("/temple/manage", { state: { tab: "events" } })}
              >
                Manage Events
              </Button>
            </Box>

            <Grid container spacing={2}>
              {templeEvents.map((evt) => {
                const joined = evt.volunteersJoined ?? 0;
                const needed = evt.volunteersNeeded ?? 10;
                const pct = Math.min(100, Math.round((joined / (needed || 1)) * 100));
                return (
                  <Grid size={{ xs: 12, md: 6 }} key={evt.id}>
                    <Card sx={{ borderRadius: 3, border: "1.5px solid", borderColor: "divider", p: 2.5, height: "100%" }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                          <Box sx={{ bgcolor: "secondary.light", color: "secondary.main", borderRadius: 2, p: 1, display: "flex" }}>
                            <EventOutlinedIcon fontSize="small" />
                          </Box>
                          <Box>
                            <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                              {evt.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatDateTime(evt.date || evt.eventDate)} · {evt.location || evt.venue || "Community Temple"}
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          icon={<GroupsOutlinedIcon sx={{ fontSize: "14px !important" }} />}
                          label={`${joined} / ${needed} Volunteers`}
                          size="small"
                          color={joined >= needed ? "success" : "secondary"}
                          variant="outlined"
                          sx={{ fontWeight: 600, fontSize: 11.5 }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {evt.description}
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            color={pct >= 100 ? "success" : "secondary"}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                        </Box>
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                          {pct}%
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<GroupsOutlinedIcon />}
                          onClick={() => handleOpenVolunteers(evt)}
                        >
                          View Volunteer Names ({joined})
                        </Button>
                      </Box>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          </Box>
        </>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 6, sm: 4 }}>
              <StatCard label="My Bookings" value={stats.bookings} />
            </Grid>
            <Grid size={{ xs: 6, sm: 4 }}>
              <StatCard label="Total Donated" value={formatCurrency(stats.donated)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <StatCard label="Upcoming Events" value={stats.events} />
            </Grid>
          </Grid>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            {RESIDENT_ACTIONS.map(({ label, caption, icon: Icon, path }) => (
              <Grid size={{ xs: 12, md: 4 }} key={path}>
                <Card
                  onClick={() => navigate(path)}
                  sx={{
                    borderRadius: 3,
                    cursor: "pointer",
                    height: "100%",
                    border: "1.5px solid",
                    borderColor: "divider",
                    "&:hover": { borderColor: "primary.main", boxShadow: 2 },
                  }}
                >
                  <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box sx={{ bgcolor: "primary.light", color: "primary.main", borderRadius: 2, p: 1.25, display: "flex" }}>
                      <Icon />
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                        {label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {caption}
                      </Typography>
                    </Box>
                    <EastOutlinedIcon fontSize="small" color="action" />
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Tabs for Bookings & Donation Receipts */}
          <Box sx={{ mt: 3, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, flexWrap: "wrap", gap: 1 }}>
              <Tabs
                value={activeTab}
                onChange={(_, v) => setActiveTab(v)}
                sx={{
                  minHeight: 40,
                  "& .MuiTab-root": { textTransform: "none", fontWeight: 600, minHeight: 40, py: 0.5 },
                }}
              >
                <Tab value="bookings" label={`My Seva Bookings (${userBookings.length})`} />
                <Tab value="donations" label={`Donation Receipts (${userDonations.length})`} />
              </Tabs>
              {activeTab === "bookings" ? (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<TempleHinduOutlinedIcon />}
                  onClick={() => navigate("/temple/book")}
                >
                  Book New Seva
                </Button>
              ) : (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<VolunteerActivismOutlinedIcon />}
                  onClick={() => navigate("/temple/donate")}
                >
                  Make a Donation
                </Button>
              )}
            </Box>

            {activeTab === "bookings" && (
              userBookings.length === 0 ? (
                <Card sx={{ borderRadius: 3, p: 3, textAlign: "center", border: "1px dashed", borderColor: "divider" }}>
                  <Typography variant="body2" color="text.secondary">
                    No Seva bookings yet. Book a monthly pooja or archana for your family.
                  </Typography>
                </Card>
              ) : (
                <Grid container spacing={2}>
                  {userBookings.map((b) => {
                    const sevaId = b.sevaType || b.sevaId;
                    const seva = SEVA_TYPES.find((s) => s.id === sevaId);
                    const sevaName = b.sevaName || seva?.name || sevaId;
                    const dateStr = b.bookingDate || b.date;
                    const timeStr = b.slot || b.time;
                    const amountVal = b.amount || seva?.price || 0;
                    const statusVal = b.status || "confirmed";
                    return (
                      <Grid size={{ xs: 12, sm: 6 }} key={b.id}>
                        <Card sx={{ borderRadius: 3, border: "1.5px solid", borderColor: "divider", p: 2, height: "100%" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                              <Box sx={{ bgcolor: "primary.light", color: "primary.main", borderRadius: 2, p: 0.75, display: "flex" }}>
                                <TempleHinduOutlinedIcon fontSize="small" />
                              </Box>
                              <Box>
                                <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                                  {sevaName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Ref: {b.id}
                                </Typography>
                              </Box>
                            </Box>
                            <Chip
                              label={statusVal}
                              size="small"
                              color={statusVal === "cancelled" ? "default" : "success"}
                              variant="outlined"
                              sx={{ fontWeight: 600, fontSize: 11, height: 22, textTransform: "capitalize" }}
                            />
                          </Box>
                          <Divider sx={{ my: 1 }} />
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                Date & Slot
                              </Typography>
                              <Typography variant="body2" fontWeight={600} color="text.primary">
                                {dateStr} {timeStr ? `· ${timeStr}` : ""}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: "right" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                Dakshina
                              </Typography>
                              <Typography variant="body2" fontWeight={700} color="primary.main">
                                {formatCurrency(amountVal)}
                              </Typography>
                            </Box>
                          </Box>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )
            )}

            {activeTab === "donations" && (
              userDonations.length === 0 ? (
                <Card sx={{ borderRadius: 3, p: 3, textAlign: "center", border: "1px dashed", borderColor: "divider" }}>
                  <Typography variant="body2" color="text.secondary">
                    No donation receipts yet. Contribute to temple upkeep, annadhanam, or festival celebrations.
                  </Typography>
                </Card>
              ) : (
                <Grid container spacing={2}>
                  {userDonations.map((d) => {
                    const receiptNumber = d.receiptNo || receiptNoFor(d.id || "DON-001");
                    const devoteeName = d.devotee || d.donorName || user?.name || "Resident";
                    const formattedDate = d.createdAt ? formatDateTime(d.createdAt) : d.donatedAt || "Recent";
                    const donationObj = {
                      id: d.id,
                      amount: d.amount,
                      purpose: d.purpose,
                      devotee: devoteeName,
                      flat: d.flat || user?.flat || "-",
                      status: d.status || "receipted",
                      receiptNo: receiptNumber,
                      createdAt: d.createdAt || new Date().toISOString(),
                    };
                    return (
                      <Grid size={{ xs: 12, sm: 6 }} key={d.id}>
                        <Card sx={{ borderRadius: 3, border: "1.5px solid", borderColor: "divider", p: 2, height: "100%" }}>
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                              <Box sx={{ bgcolor: "success.light", color: "success.main", borderRadius: 2, p: 0.75, display: "flex" }}>
                                <ReceiptLongOutlinedIcon fontSize="small" />
                              </Box>
                              <Box>
                                <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                                  {purposeLabel(d.purpose)}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Receipt: {receiptNumber}
                                </Typography>
                              </Box>
                            </Box>
                            <Chip
                              label="Issued"
                              size="small"
                              color="success"
                              variant="outlined"
                              sx={{ fontWeight: 600, fontSize: 11, height: 22 }}
                            />
                          </Box>
                          <Divider sx={{ my: 1 }} />
                          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
                            <Box>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                Contributor & Date
                              </Typography>
                              <Typography variant="body2" fontWeight={600} color="text.primary">
                                {devoteeName} · {formattedDate}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: "right" }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                                Amount
                              </Typography>
                              <Typography variant="body2" fontWeight={700} color="success.main">
                                {formatCurrency(d.amount)}
                              </Typography>
                            </Box>
                          </Box>
                          <Button
                            size="small"
                            variant="outlined"
                            color="success"
                            fullWidth
                            startIcon={<ReceiptLongOutlinedIcon />}
                            onClick={() => setSelectedReceipt(donationObj)}
                          >
                            View Receipt
                          </Button>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )
            )}
          </Box>
        </>
      )}

      {/* Receipt Modal Dialog */}
      <Dialog
        open={!!selectedReceipt}
        onClose={() => setSelectedReceipt(null)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pb: 1 }}>
          <Typography variant="h6" fontWeight={700}>
            Temple Donation Receipt
          </Typography>
          <IconButton size="small" onClick={() => setSelectedReceipt(null)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 2.5 }}>
          {selectedReceipt && <ReceiptCard donation={selectedReceipt} />}
        </DialogContent>
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

      {upcomingEvent && (
        <Card sx={{ borderRadius: 3, mt: 3, border: "1.5px solid", borderColor: "secondary.main" }}>
          <CardContent>
            <Chip label="Next Event" color="secondary" size="small" sx={{ mb: 1, fontWeight: 600 }} />
            <Typography variant="h6" fontWeight={700} color="text.primary">
              {upcomingEvent.title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {formatDateTime(upcomingEvent.date)} · {upcomingEvent.location}
            </Typography>
            <Button
              variant="text"
              endIcon={<EastOutlinedIcon />}
              sx={{ mt: 1, px: 0 }}
              onClick={() => navigate(canManage ? "/temple/manage" : "/temple/events", canManage ? { state: { tab: "events" } } : undefined)}
            >
              {canManage ? "Manage events" : "View all events"}
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

