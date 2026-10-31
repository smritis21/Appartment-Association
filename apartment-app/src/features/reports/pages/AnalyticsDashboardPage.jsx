import {
  Alert, Box, Button, Chip, Divider, Grid, MenuItem, Paper, Skeleton, TextField, Typography,
} from "@mui/material";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import EmojiPeopleOutlinedIcon from "@mui/icons-material/EmojiPeopleOutlined";
import PoolOutlinedIcon from "@mui/icons-material/PoolOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useState } from "react";
import PageHeader from "../../../components/common/PageHeader";
import DashboardCard from "../../../components/cards/DashboardCard";
import SimpleBarChart from "../../../components/charts/SimpleBarChart";
import { RANGE_OPTIONS } from "../mock/analytics";
import { useReports } from "../../../hooks/useReports";

/** ₹4,500 -> "₹4,500"; ₹3,43,900 -> "₹3.4L". */
function formatRupees(amount) {
  const value = Number(amount) || 0;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toLocaleString("en-IN")}`;
}

export default function AnalyticsDashboardPage() {
  const [range, setRange] = useState(6);

  const {
    summary,
    payments,
    residents,
    visitors,
    maintenance,
    complaints,
    attention,
    facilityUsage,
    loading,
    offline,
    error,
  } = useReports(range);

  const METRICS = [
    {
      title: "Total Complaints",
      value: complaints?.total ?? 0,
      icon: ReportProblemOutlinedIcon,
      color: "error.main",
    },
    {
      title: "Open Complaints",
      // Open means anything not yet resolved or closed.
      value: (complaints?.pending ?? 0) + (complaints?.ongoing ?? 0),
      icon: ReportProblemOutlinedIcon,
      color: "warning.main",
    },
    {
      title: "Fees Collected",
      // ₹4,500 shown as "₹0.0L" is worse than useless, so the unit follows
      // the amount rather than always being lakhs.
      value: formatRupees(payments?.totalCollected || summary?.paymentsCollected || 0),
      icon: PaymentsOutlinedIcon,
      color: "success.main",
    },
    {
      title: "Active Residents",
      // `??` kept a real zero from the first source instead of trying the
      // second; `||` falls through to whichever actually has the figure.
      value: residents?.total || summary?.totalResidents || 0,
      icon: PeopleOutlinedIcon,
      color: "primary.main",
    },
    {
      title: "Visitor Entries",
      value: visitors?.totalEntries || summary?.visitorEntries || 0,
      icon: EmojiPeopleOutlinedIcon,
      color: "info.main",
    },
    {
      title: "Maintenance Tasks",
      value: `${maintenance?.completed ?? 0}/${maintenance?.scheduled ?? 0}`,
      caption: maintenance?.upcoming ? `${maintenance.upcoming} upcoming` : undefined,
      icon: EngineeringOutlinedIcon,
      color: "secondary.main",
    },
  ];

  const handleExport = () => {
    const rows = [
      ["Metric", "Value"],
      ...METRICS.map((m) => [m.title, String(m.value)]),
      [],
      ["Payments per month", ...(payments?.byMonth ?? []).map((d) => `${d.label}:${d.value}`)],
      ["Visitors per month", ...(visitors?.byMonth ?? []).map((d) => `${d.label}:${d.value}`)],
      ["Facility usage", ...facilityUsage.map((d) => `${d.label}:${d.value}`)],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "society-analytics-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Consolidated view of complaints, payments, residents, maintenance and facility usage"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Analytics" }]}
        action={
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <TextField
              select
              size="small"
              label="Range"
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
              sx={{ minWidth: 160 }}
            >
              {RANGE_OPTIONS.map((r) => (
                <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
              ))}
            </TextField>
            <Button
              variant="outlined"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={handleExport}
            >
              Export CSV
            </Button>
          </Box>
        }
      />

      {offline && (
        <Chip
          icon={<CloudOffOutlinedIcon />}
          label="Backend unreachable - showing sample analytics data"
          color="warning"
          variant="outlined"
          size="small"
          sx={{ mb: 2 }}
        />
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load reports: {error}
        </Alert>
      )}

      {/* What the figures are asking you to look at, rather than the figures
          themselves. The ranking, the trend and the anomaly detection are
          computed server-side in aiml.py; the model only puts the leading
          finding into a sentence, from numbers it was handed. */}
      {attention?.length > 0 && (
        <Paper
          elevation={1}
          sx={{ borderRadius: 2, p: 2.5, mb: 3, borderLeft: "4px solid", borderColor: "warning.main" }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <InsightsOutlinedIcon fontSize="small" color="warning" />
            <Typography variant="subtitle1" fontWeight={700}>
              Worth a closer look
            </Typography>
          </Box>

          {attention[0]?.headline && (
            <Typography variant="body2" sx={{ mb: 1.5, color: "text.secondary", fontStyle: "italic" }}>
              {attention[0].headline}
            </Typography>
          )}

          {attention.map((item) => (
            <Box
              key={item.metric}
              sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap", py: 0.4 }}
            >
              <Chip
                size="small"
                label={item.direction === "down" ? "↓" : "↑"}
                color={item.direction === "down" ? "info" : "warning"}
                sx={{ fontWeight: 700, minWidth: 34 }}
              />
              <Typography variant="body2" fontWeight={600}>{item.label}</Typography>
              <Typography variant="body2" color="text.secondary">
                - {item.reason}, now {item.latest?.toLocaleString("en-IN")} {item.unit}
              </Typography>
              {item.forecast != null && (
                <Typography variant="caption" color="text.disabled">
                  next month ≈ {Math.round(item.forecast).toLocaleString("en-IN")}
                </Typography>
              )}
            </Box>
          ))}
        </Paper>
      )}

      {/* Key metrics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {METRICS.map((m) => (
          <Grid size={{ xs: 6, sm: 4, md: 2 }} key={m.title}>
            {loading ? (
              <Skeleton variant="rounded" height={90} />
            ) : (
              <DashboardCard title={m.title} value={m.value} icon={m.icon} color={m.color} />
            )}
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700}>Fee Collection (₹)</Typography>
            <Divider sx={{ my: 1.5 }} />
            {loading ? (
              <Skeleton variant="rounded" height={160} />
            ) : (
              <SimpleBarChart
                data={(payments?.byMonth ?? []).map((d) => ({ ...d, value: Math.round(d.value / 1000) }))}
                height={160}
                color="success.main"
                emptyLabel="No payment data for this range"
              />
            )}
            <Typography variant="caption" color="text.secondary">Values in ₹ thousands</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700}>Visitor Entries</Typography>
            <Divider sx={{ my: 1.5 }} />
            {loading ? (
              <Skeleton variant="rounded" height={160} />
            ) : (
              <SimpleBarChart data={visitors?.byMonth ?? []} height={160} color="info.main"
                emptyLabel="No visitor data for this range" />
            )}
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <PoolOutlinedIcon fontSize="small" color="action" />
              <Typography variant="subtitle1" fontWeight={700}>Facility Usage (bookings)</Typography>
            </Box>
            <Divider sx={{ my: 1.5 }} />
            {loading ? (
              <Skeleton variant="rounded" height={160} />
            ) : (
              <SimpleBarChart data={facilityUsage} height={160} color="secondary.main"
                emptyLabel="No bookings recorded" />
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

