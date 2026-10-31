import {
  Box, Chip, Divider, Grid, MenuItem, Paper, Skeleton, TextField, Typography,
} from "@mui/material";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import SummarizeOutlinedIcon from "@mui/icons-material/SummarizeOutlined";
import TimerOutlinedIcon from "@mui/icons-material/TimerOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import StarOutlineOutlinedIcon from "@mui/icons-material/StarOutlineOutlined";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../../components/common/PageHeader";
import DashboardCard from "../../../components/cards/DashboardCard";
import SimpleBarChart from "../../../components/charts/SimpleBarChart";
import { useComplaints } from "../../../context/ComplaintContext";
import {
  COMPLAINT_CATEGORIES, COMPLAINT_STATUS, getAvgResolutionDays,
} from "../mock/complaints";
import { fetchComplaintReport, getReportResolutionDays } from "../../../services/complaintReportService";
import { isOffline } from "../../../services/apiClient";

const REPORT_YEAR = 2026;

const MONTH_OPTIONS = [
  { value: "all", label: "All Months (2026)" },
  { value: 3, label: "April 2026" },
  { value: 4, label: "May 2026" },
  { value: 5, label: "June 2026" },
  { value: 6, label: "July 2026" },
];

// The date range each month option asks the API for (INT-14). "all" is the
// whole reporting year; a specific month is its first-to-last calendar day.
// Formatted by hand rather than via toISOString() so the local date is not
// shifted a day by the UTC conversion.
function monthRange(month) {
  const iso = (y, m, d) =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (month === "all") {
    return { dateFrom: iso(REPORT_YEAR, 1, 1), dateTo: iso(REPORT_YEAR, 12, 31) };
  }
  const lastDay = new Date(REPORT_YEAR, month + 1, 0).getDate();
  return {
    dateFrom: iso(REPORT_YEAR, month + 1, 1),
    dateTo:   iso(REPORT_YEAR, month + 1, lastDay),
  };
}

// FE-14 - Complaint Reports Screen (Admin): monthly volume, category
// breakdown and resolution stats with a month selector and bar chart.
// INT-14: the screen loads from GET /complaints/reports (BE-14) and the month
// selector re-fetches across the matching date range, so the volume and
// resolution figures are real live data - with offline fallback to the local
// mock complaints, the same pattern as ComplaintMonitoringPage.
export default function ComplaintReportsPage() {
  const { complaints } = useComplaints();
  const [month, setMonth] = useState("all");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // INT-14: re-fetch whenever the selected month changes, asking the API for
  // exactly that month's date range so the numbers are scoped server-side.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const { dateFrom, dateTo } = monthRange(month);
    fetchComplaintReport({ dateFrom, dateTo, pageSize: 200 })
      .then((data) => {
        if (!cancelled) { setReport(data); setOffline(false); }
      })
      .catch((err) => {
        if (!cancelled) {
          if (isOffline(err)) setOffline(true);
          setReport(null);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [month]);

  // Offline fallback: the mock list filtered to the same month client-side.
  const offlineFiltered = useMemo(() => {
    if (month === "all") return complaints;
    return complaints.filter((c) => new Date(c.createdAt).getMonth() === month);
  }, [complaints, month]);

  const stats = useMemo(() => {
    if (report) {
      // Live data: totals and status counts are already scoped to the range,
      // and the resolution time is derived from the returned items. The report
      // API carries no feedback, so ratings come from the offline path only.
      const total = report.total;
      const resolved = report.byStatus.resolved + report.byStatus.closed;
      const avgDays = getReportResolutionDays(report.items);
      return { total, resolved, avgDays, avgRating: 0, ratedCount: 0 };
    }
    const total = offlineFiltered.length;
    const resolved = offlineFiltered.filter((c) =>
      [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED].includes(c.status)
    ).length;
    const avgDays = getAvgResolutionDays(offlineFiltered);
    const rated = offlineFiltered.filter((c) => c.feedback);
    const avgRating =
      rated.length > 0
        ? rated.reduce((s, c) => s + c.feedback.rating, 0) / rated.length
        : 0;
    return { total, resolved, avgDays, avgRating, ratedCount: rated.length };
  }, [report, offlineFiltered]);

  const categoryData = useMemo(() => {
    if (report) {
      // Scoped, busiest-first category counts straight from the live report.
      return report.byCategory.map((c) => ({
        label: c.category.split(" ")[0],
        value: c.value,
      }));
    }
    return COMPLAINT_CATEGORIES.map((cat) => ({
      label: cat.split(" ")[0],
      value: offlineFiltered.filter((c) => c.category === cat).length,
    }));
  }, [report, offlineFiltered]);

  const STAT_CARDS = [
    { title: "Total Complaints", value: stats.total, icon: SummarizeOutlinedIcon, color: "primary.main" },
    { title: "Resolved / Closed", value: stats.resolved, icon: TaskAltOutlinedIcon, color: "success.main" },
    { title: "Avg. Resolution Time", value: `${stats.avgDays.toFixed(1)} days`, icon: TimerOutlinedIcon, color: "warning.main" },
    { title: "Avg. Rating", value: stats.ratedCount > 0 ? `${stats.avgRating.toFixed(1)} / 5` : "-", icon: StarOutlineOutlinedIcon, color: "secondary.main" },
  ];

  return (
    <Box>
      <PageHeader
        title="Complaint Reports"
        subtitle="Monthly complaint analytics - volume, categories and resolution performance"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Complaint Desk", href: "/complaints/monitoring" },
          { label: "Reports" },
        ]}
        action={
          <TextField
            select
            size="small"
            label="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            sx={{ minWidth: 190 }}
          >
            {MONTH_OPTIONS.map((m) => (
              <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
            ))}
          </TextField>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STAT_CARDS.map((c) => (
          <Grid size={{ xs: 6, md: 3 }} key={c.title}>
            {loading ? <Skeleton variant="rounded" height={98} /> : (
              <DashboardCard title={c.title} value={c.value} icon={c.icon} color={c.color} />
            )}
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 3, height: "100%" }}>
            <Typography variant="subtitle1" fontWeight={700}>Category Breakdown</Typography>
            <Typography variant="caption" color="text.secondary">
              Complaint volume per category for the selected period
            </Typography>
            <Divider sx={{ my: 1.5 }} />
            <SimpleBarChart data={categoryData} height={200} color="secondary.main"
              emptyLabel="No complaints in this period" />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 3, height: "100%" }}>
            <Typography variant="subtitle1" fontWeight={700}>Resolution Summary</Typography>
            <Divider sx={{ my: 1.5 }} />
            {[
              ["Complaints received", stats.total],
              ["Resolved or closed", stats.resolved],
              ["Still open", stats.total - stats.resolved],
              ["Resolution rate", stats.total > 0 ? `${Math.round((stats.resolved / stats.total) * 100)}%` : "-"],
              ["Average resolution time", `${stats.avgDays.toFixed(1)} days`],
              ["Feedback received", stats.ratedCount],
            ].map(([label, value]) => (
              <Box key={label} sx={{ display: "flex", justifyContent: "space-between", py: 1, borderBottom: "1px dashed", borderColor: "divider" }}>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
                <Typography variant="body2" fontWeight={700}>{value}</Typography>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
