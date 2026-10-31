import { useState, useMemo } from "react";
import {
  Box, Chip, Grid, TextField, InputAdornment, Snackbar, Alert, Button,
  IconButton, Tooltip, Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import TodayOutlinedIcon from "@mui/icons-material/TodayOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import AuditActivityCard from "../components/AuditActivityCard";
import AuditFilterPanel from "../components/AuditFilterPanel";
import AuditLogTable from "../components/AuditLogTable";
import { getAllAuditLogs, getAuditStats, AUDIT_STATUS, AUDIT_SEVERITY } from "../mock/auditLogs";
import { useAuditFeed } from "../hooks/useAuditFeed";

const EMPTY_FILTERS = { module: "all", severity: "all", status: "all", role: "all", dateFrom: "", dateTo: "" };

function computeStats(logs) {
  const today = new Date().toISOString().split("T")[0];
  const todayLogs = logs.filter((l) => l.timestamp.startsWith(today));
  const uniqueUsers = new Set(logs.map((l) => l.performedBy).filter((u) => u !== "System" && u !== "Unknown"));
  return {
    total: logs.length,
    todayCount: todayLogs.length,
    successful: logs.filter((l) => l.status === AUDIT_STATUS.SUCCESS).length,
    failed: logs.filter((l) => l.status === AUDIT_STATUS.FAILED).length,
    critical: logs.filter((l) => l.severity === AUDIT_SEVERITY.CRITICAL).length,
    uniqueUsers: uniqueUsers.size,
  };
}

export default function AuditLogsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [toast, setToast] = useState(false);

  // Bug 20a: fetches once on mount, then polls every 20s and exposes a
  // manual refresh() so payment/billing/login activity shows up without a
  // full page reload.
  const { logs: apiLogs, offline, authError, refreshing, refresh } = useAuditFeed({ pageSize: 200 });

  const allLogs = apiLogs ?? getAllAuditLogs();
  const stats = useMemo(() => (apiLogs ? computeStats(apiLogs) : getAuditStats()), [apiLogs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allLogs.filter((log) => {
      if (q && ![log.performedBy, log.residentName, log.action, log.module, log.flat, log.wing]
        .filter(Boolean).some((v) => v.toLowerCase().includes(q))) return false;
      if (filters.module   !== "all" && log.module          !== filters.module)   return false;
      if (filters.severity !== "all" && log.severity        !== filters.severity) return false;
      if (filters.status   !== "all" && log.status          !== filters.status)   return false;
      if (filters.role     !== "all" && log.performedRole   !== filters.role)     return false;
      if (filters.dateFrom && log.timestamp.split("T")[0] < filters.dateFrom)     return false;
      if (filters.dateTo   && log.timestamp.split("T")[0] > filters.dateTo)       return false;
      return true;
    });
  }, [allLogs, search, filters]);

  const CARDS = [
    { label: "Total Activities",   value: stats.total,       icon: AssessmentOutlinedIcon,    color: "primary.main" },
    { label: "Today's Activities", value: stats.todayCount,  icon: TodayOutlinedIcon,         color: "info.main" },
    { label: "Successful Actions", value: stats.successful,  icon: CheckCircleOutlinedIcon,   color: "success.main" },
    { label: "Failed Actions",     value: stats.failed,      icon: CancelOutlinedIcon,        color: "error.main" },
    { label: "Critical Events",    value: stats.critical,    icon: WarningAmberOutlinedIcon,  color: "warning.main" },
    { label: "Unique Users",       value: stats.uniqueUsers, icon: PeopleOutlinedIcon,        color: "secondary.main" },
  ];

  return (
    <Box>
      <PageHeader
        title="Audit Logs"
        subtitle="Track all system activity and administrative actions."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Audit Logs" }]}
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" size="small" sx={{ textTransform: "none" }}
              onClick={() => navigate("/audit/login")}>Login Logs</Button>
            <Button variant="outlined" size="small" sx={{ textTransform: "none" }}
              onClick={() => navigate("/audit/activity")}>Activity Timeline</Button>
          </Box>
        }
      />

      {offline && (
        <Chip
          icon={<CloudOffOutlinedIcon />}
          label="Backend unreachable - showing sample data"
          color="warning"
          variant="outlined"
          size="small"
          sx={{ mb: 2 }}
        />
      )}
      {authError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          You need an admin account to view live audit logs - showing sample data instead.
        </Alert>
      )}

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {CARDS.map((c) => (
          <Grid size={{ xs: 6, sm: 4, md: 2 }} key={c.label}>
            <AuditActivityCard label={c.label} value={c.value} icon={c.icon} color={c.color} />
          </Grid>
        ))}
      </Grid>

      {/* Search */}
      <TextField
        fullWidth size="small" placeholder="Search by user, resident, action, module, flat, wing…"
        value={search} onChange={(e) => setSearch(e.target.value)}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        sx={{ mb: 2 }}
      />

      {/* Filters */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <AuditFilterPanel
            filters={filters}
            onChange={setFilters}
            onReset={() => { setFilters(EMPTY_FILTERS); setToast(true); }}
          />
        </Box>
        <Tooltip title="Refresh now">
          <span>
            <IconButton onClick={refresh} disabled={refreshing} sx={{ mt: 0.5 }}>
              <RefreshOutlinedIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
        Auto-refreshes every 20s.
      </Typography>

      {/* Table */}
      <AuditLogTable logs={filtered} />

      <Snackbar open={toast} autoHideDuration={2500} onClose={() => setToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="info" onClose={() => setToast(false)} sx={{ width: "100%" }}>
          Filters reset.
        </Alert>
      </Snackbar>
    </Box>
  );
}

