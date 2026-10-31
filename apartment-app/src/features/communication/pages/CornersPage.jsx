// INT-34: Community Corners - live API integration
import {
  Alert, Box, Button, Card, CardContent, Chip,
  CircularProgress, Dialog, DialogContent, DialogTitle, Divider,
  LinearProgress, Snackbar, Tab, Tabs, Typography,
} from "@mui/material";
import AutoStoriesOutlinedIcon from "@mui/icons-material/AutoStoriesOutlined";
import FavoriteOutlinedIcon from "@mui/icons-material/FavoriteOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import StarOutlinedIcon from "@mui/icons-material/StarOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useCallback, useEffect, useState } from "react";
import { fetchActivities, signupForActivity } from "../../../services/communityService";
import { isOffline, ApiError } from "../../../services/apiClient";
import { cornersData } from "../mock/communicationData";
import PageHeader from "../../../components/common/PageHeader";
import { useAuth } from "../../../hooks/useAuth";

const CORNERS = [
  { key: "kids",         label: "Kids Corner",     icon: AutoStoriesOutlinedIcon, color: "success",  desc: "Activities for children aged 4–14" },
  { key: "senior",       label: "Senior Citizens", icon: FavoriteOutlinedIcon,    color: "error",    desc: "Health, yoga & social for elders" },
  { key: "recreational", label: "Recreational",    icon: BoltOutlinedIcon,        color: "warning",  desc: "DIY, sports & hobby activities" },
  { key: "social",       label: "Social Circle",   icon: GroupsOutlinedIcon,      color: "primary",  desc: "Volunteer & community initiatives" },
];

const STATUS_COLOR = { upcoming: "primary", ongoing: "success", completed: "default", cancelled: "error", past: "default", open: "primary", closed: "default" };

// Normalise live API activity to the shape ActivityCard expects
function normalise(a) {
  return {
    id:          a.id,
    corner:      a.corner,
    title:       a.title,
    description: a.description,
    schedule:    a.activityDate ?? "See details",
    location:    a.venue ?? "Community Area",
    instructor:  a.instructor ?? null,
    spots:       a.capacity ?? null,
    enrolled:    a.signupCount ?? 0,
    // API returns upcoming/ongoing/completed/cancelled; mock uses open/closed
    status:      a.status === "open" ? "upcoming" : a.status === "closed" ? "past" : (a.status ?? "upcoming"),
    userJoined:  false,
  };
}

// ── Activity Card ─────────────────────────────────────────────────────────────
function ActivityCard({ activity, onClick }) {
  const fill = activity.spots && activity.enrolled
    ? Math.min(100, Math.round((activity.enrolled / activity.spots) * 100))
    : null;
  const spotsLeft = activity.spots ? activity.spots - (activity.enrolled ?? 0) : null;

  return (
    <Card elevation={1} sx={{ borderRadius: 2, cursor: "pointer", transition: "all 0.15s", "&:hover": { boxShadow: 4, transform: "translateY(-1px)" } }} onClick={onClick}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ lineHeight: 1.3, flex: 1 }}>{activity.title}</Typography>
          <Chip label={activity.status} size="small" color={STATUS_COLOR[activity.status] ?? "default"} sx={{ height: 20, fontSize: 10, flexShrink: 0, ml: 1 }} />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.55 }}>{activity.description}</Typography>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 1.5 }}>
          <Box sx={{ display: "flex", gap: 0.75 }}>
            <AccessTimeOutlinedIcon sx={{ fontSize: 13, color: "text.disabled", mt: 0.15 }} />
            <Typography variant="caption" color="text.secondary">{activity.schedule}</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 0.75 }}>
            <LocationOnOutlinedIcon sx={{ fontSize: 13, color: "text.disabled", mt: 0.15 }} />
            <Typography variant="caption" color="text.secondary">{activity.location}</Typography>
          </Box>
          {activity.instructor && (
            <Box sx={{ display: "flex", gap: 0.75 }}>
              <StarOutlinedIcon sx={{ fontSize: 13, color: "warning.main", mt: 0.15 }} />
              <Typography variant="caption" color="text.secondary">Instructor: <strong>{activity.instructor}</strong></Typography>
            </Box>
          )}
          {activity.enrolled !== undefined && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <PeopleOutlinedIcon sx={{ fontSize: 13, color: "text.disabled" }} />
              <Typography variant="caption" color="text.secondary">{activity.enrolled} enrolled</Typography>
              {spotsLeft !== null && spotsLeft > 0 && <Chip label={`${spotsLeft} spots left`} size="small" color="success" sx={{ height: 16, fontSize: 9 }} />}
              {spotsLeft !== null && spotsLeft <= 0 && <Chip label="Full" size="small" color="warning" sx={{ height: 16, fontSize: 9 }} />}
            </Box>
          )}
        </Box>
        {fill !== null && (
          <LinearProgress variant="determinate" value={fill} color={spotsLeft === 0 ? "warning" : "primary"} sx={{ height: 5, borderRadius: 3, mb: 1.5 }} />
        )}
        {activity.userJoined && (
          <Chip label="✓ Registered" size="small" color="success" sx={{ fontSize: 10, height: 20 }} />
        )}
      </CardContent>
    </Card>
  );
}

// ── Register Dialog ───────────────────────────────────────────────────────────
function RegisterDialog({ activity, offline, onClose, onSuccess }) {
  const { user } = useAuth();
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!activity) return null;

  const handleJoin = async () => {
    setSubmitting(true);
    setError(null);
    try {
      if (!offline) {
        await signupForActivity(activity.id, user?.residentId ?? user?.id ?? "resident");
      }
      setDone(true);
      onSuccess(activity);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!activity} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle>{done ? "Registration Confirmed!" : activity.title}</DialogTitle>
      <DialogContent>
        {done ? (
          <Box sx={{ textAlign: "center", py: 2 }}>
            <CheckCircleOutlineIcon sx={{ fontSize: 56, color: "success.main", mb: 1.5 }} />
            <Typography variant="body1" gutterBottom>
              You're registered for <strong>{activity.title}</strong>!
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75 }}>
              <AccessTimeOutlinedIcon fontSize="small" /> {activity.schedule}
            </Typography>
            <Button variant="contained" fullWidth sx={{ mt: 2 }} onClick={onClose}>Done</Button>
          </Box>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ lineHeight: 1.65 }}>
              {activity.description}
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mb: 2 }}>
              <Box sx={{ display: "flex", gap: 0.75 }}>
                <AccessTimeOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary">{activity.schedule}</Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 0.75 }}>
                <LocationOnOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
                <Typography variant="caption" color="text.secondary">{activity.location}</Typography>
              </Box>
            </Box>
            {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button variant="outlined" fullWidth onClick={onClose}>Cancel</Button>
              <Button variant="contained" fullWidth startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <CalendarMonthOutlinedIcon />}
                onClick={handleJoin} disabled={submitting || activity.status === "completed" || activity.status === "cancelled" || activity.status === "past"}>
                {(activity.status === "completed" || activity.status === "past") ? "Completed" : activity.status === "cancelled" ? "Cancelled" : "Join / Register"}
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CornersPage() {
  const [activeCorner, setActiveCorner] = useState("kids");
  const [allActivities, setAllActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [selected, setSelected] = useState(null);
  const [toast, setToast] = useState({ open: false, msg: "" });

  const load = useCallback(async () => {
    try {
      const data = await fetchActivities();
      setAllActivities(data.map(normalise));
      setOffline(false);
    } catch (err) {
      if (isOffline(err)) {
        setAllActivities(cornersData);
        setOffline(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activities = allActivities.filter((a) => a.corner === activeCorner);
  const corner = CORNERS.find((c) => c.key === activeCorner);

  const handleSuccess = (activity) => {
    // Optimistically update enrolled count
    setAllActivities((prev) =>
      prev.map((a) => a.id === activity.id ? { ...a, enrolled: (a.enrolled ?? 0) + 1, userJoined: true } : a)
    );
  };

  return (
    <Box>
      <PageHeader
        title="Community Corners"
        subtitle="Discover and join activities curated for every member of our community"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Community Corners" }]}
      />

      {offline && (
        <Chip icon={<CloudOffOutlinedIcon />} label="Backend unreachable - showing sample data"
          color="warning" variant="outlined" size="small" sx={{ mb: 2 }} />
      )}

      {/* Corner selector */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, mb: 3 }}>
        {CORNERS.map((c) => {
          const count = allActivities.filter((a) => a.corner === c.key).length;
          const isActive = activeCorner === c.key;
          const Icon = c.icon;
          return (
            <Card key={c.key} elevation={isActive ? 3 : 1} onClick={() => setActiveCorner(c.key)}
              sx={{ borderRadius: 2, cursor: "pointer", border: "2px solid", borderColor: isActive ? `${c.color}.main` : "divider",
                bgcolor: isActive ? `${c.color}.light` : "background.paper", transition: "all 0.15s",
                "&:hover": { borderColor: `${c.color}.main`, boxShadow: 3 } }}>
              <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: isActive ? `${c.color}.main` : `${c.color}.light`,
                  display: "flex", alignItems: "center", justifyContent: "center", mb: 1.5 }}>
                  <Icon sx={{ color: isActive ? "white" : `${c.color}.main`, fontSize: 20 }} />
                </Box>
                <Typography variant="subtitle2" fontWeight={700} color={isActive ? `${c.color}.dark` : "text.primary"}>{c.label}</Typography>
                <Typography variant="caption" color="text.secondary">{loading ? "…" : count} activities</Typography>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      {/* Active corner header */}
      {corner && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5, p: 2, bgcolor: "background.paper", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: `${corner.color}.light`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <corner.icon sx={{ color: `${corner.color}.main`, fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" fontWeight={700}>{corner.label}</Typography>
            <Typography variant="body2" color="text.secondary">{corner.desc}</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            {(["upcoming", "ongoing", "completed", "cancelled"]).map((s) => {
              const cnt = activities.filter((a) => a.status === s).length;
              if (!cnt) return null;
              return <Chip key={s} label={`${cnt} ${s}`} size="small" color={STATUS_COLOR[s]} sx={{ fontSize: 10 }} />;
            })}
          </Box>
        </Box>
      )}

      {/* Activities grid */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : activities.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          {corner && <corner.icon sx={{ fontSize: 56, color: "text.disabled", mb: 2 }} />}
          <Typography variant="h6" color="text.secondary" fontWeight={600}>No activities yet</Typography>
          <Typography variant="body2" color="text.disabled">Check back soon for new activities.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 2.5 }}>
          {activities.map((a) => (
            <ActivityCard key={a.id} activity={a} onClick={() => setSelected(a)} />
          ))}
        </Box>
      )}

      <RegisterDialog
        activity={selected}
        offline={offline}
        onClose={() => setSelected(null)}
        onSuccess={(activity) => {
          handleSuccess(activity);
          setToast({ open: true, msg: `Registered for "${activity.title}"!` });
          setSelected(null);
        }}
      />

      <Snackbar open={toast.open} autoHideDuration={3000}
        onClose={() => setToast({ open: false, msg: "" })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity="success" onClose={() => setToast({ open: false, msg: "" })}>{toast.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

