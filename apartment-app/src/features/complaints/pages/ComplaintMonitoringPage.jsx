import {
  Alert, Box, Button, Chip, Divider, Grid, LinearProgress, MenuItem,
  Paper, Skeleton, TextField, Tooltip, Typography,
} from "@mui/material";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import DashboardCard from "../../../components/cards/DashboardCard";
import SimpleBarChart from "../../../components/charts/SimpleBarChart";
import { useComplaintStats } from "../../../hooks/useComplaintStats";

// FE-07 - Complaint Monitoring Dashboard (Admin / Association President).
//
// Counts, the monthly trend and the category split all come from
// GET /complaints/stats (BE-07) in a single request, so everything on screen
// is one consistent snapshot rather than several client-side recalculations
// that could disagree with each other.
//
// If the backend is unreachable the hook computes the same payload from the
// local mock complaints and flags offline mode - the layout is unchanged,
// only a "sample data" chip appears. Responsive: cards stack on tablet
// widths via the Grid breakpoints.

const WINDOW_OPTIONS = [
  { value: 3, label: "Last 3 months" },
  { value: 6, label: "Last 6 months" },
  { value: 12, label: "Last 12 months" },
];

const STAT_CARDS = [
  { title: "Pending",   key: "pending",   icon: PendingActionsOutlinedIcon, color: "warning.main", subtitle: "Awaiting assignment" },
  { title: "Ongoing",   key: "ongoing",   icon: EngineeringOutlinedIcon,    color: "info.main",    subtitle: "Assigned or in progress" },
  { title: "Completed", key: "completed", icon: TaskAltOutlinedIcon,        color: "success.main", subtitle: "Resolved or closed" },
  { title: "Total",     key: "total",     icon: SummarizeOutlinedIcon,      color: "primary.main", subtitle: "All complaints on record" },
];

export default function ComplaintMonitoringPage() {
  const navigate = useNavigate();
  const [months, setMonths] = useState(6);
  const { stats, loading, offline, error, reload } = useComplaintStats(months);

  const busy = loading || !stats;
  const maxCategory = Math.max(...(stats?.byCategory ?? []).map((c) => c.value), 1);
  const resolvedTrend = (stats?.trend ?? []).map((p) => ({ label: p.label, value: p.resolved }));

  return (
    <Box>
      <PageHeader
        title="Complaint Monitoring"
        subtitle="Track pending, ongoing and completed complaints across the society"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Complaint Desk" },
        ]}
        action={
          <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
            <TextField
              select
              size="small"
              label="Trend window"
              value={months}
              onChange={(e) => setMonths(Number(e.target.value))}
              sx={{ minWidth: 160 }}
            >
              {WINDOW_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </TextField>
            <Tooltip title="Refresh statistics" arrow>
              <span>
                <Button
                  variant="outlined"
                  onClick={reload}
                  disabled={loading}
                  aria-label="Refresh statistics"
                  sx={{ minWidth: 0, px: 1.5 }}
                >
                  <RefreshOutlinedIcon fontSize="small" />
                </Button>
              </span>
            </Tooltip>
            <Button variant="outlined" onClick={() => navigate("/complaints/assign")}>Assign</Button>
            <Button variant="outlined" onClick={() => navigate("/complaints/progress")}>Progress</Button>
            <Button variant="contained" onClick={() => navigate("/complaints/reports")} sx={{ fontWeight: 600 }}>
              Reports
            </Button>
          </Box>
        }
      />

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" onClick={reload}>Retry</Button>}
        >
          Could not load complaint statistics: {error}
        </Alert>
      )}

      {/* Summary cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STAT_CARDS.map((c) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={c.title}>
            {busy ? (
              <Skeleton variant="rounded" height={98} />
            ) : (
              <DashboardCard
                title={c.title}
                value={stats[c.key]}
                subtitle={c.subtitle}
                icon={c.icon}
                color={c.color}
              />
            )}
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        {/* Monthly trend - raised and resolved, same x-axis */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 3, height: "100%" }}>
            <Typography variant="subtitle1" fontWeight={700}>Complaint Trend</Typography>
            <Typography variant="caption" color="text.secondary">
              Complaints raised per month{stats ? ` - last ${stats.trendMonths} months` : ""}
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            {busy ? (
              <Skeleton variant="rounded" height={180} />
            ) : (
              <SimpleBarChart
                data={stats.trend}
                height={180}
                emptyLabel="No complaints in this period"
              />
            )}

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2.5 }}>
              Complaints resolved per month
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            {busy ? (
              <Skeleton variant="rounded" height={140} />
            ) : (
              <SimpleBarChart
                data={resolvedTrend}
                height={140}
                color="success.main"
                emptyLabel="Nothing resolved in this period"
              />
            )}
          </Paper>
        </Grid>

        {/* Category breakdown */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 3, height: "100%" }}>
            <Typography variant="subtitle1" fontWeight={700}>By Category</Typography>
            <Typography variant="caption" color="text.secondary">
              Distribution of complaints across categories
            </Typography>
            <Divider sx={{ my: 1.5 }} />

            {busy ? (
              <Skeleton variant="rounded" height={200} />
            ) : stats.byCategory.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                No complaints recorded yet
              </Typography>
            ) : (
              stats.byCategory.map((c) => (
                <Box key={c.category} sx={{ mb: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography variant="body2">{c.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{c.value}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(c.value / maxCategory) * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </Box>
              ))
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

