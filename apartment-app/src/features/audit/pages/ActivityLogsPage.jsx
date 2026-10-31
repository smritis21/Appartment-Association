import { useState, useMemo } from "react";
import {
  Box, Chip, FormControl, InputLabel, Select, MenuItem, TextField, InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import PageHeader from "../../../components/common/PageHeader";
import AuditTimeline from "../components/AuditTimeline";
import { getAllAuditLogs, AUDIT_MODULES } from "../mock/auditLogs";
import { useAuditFeed } from "../hooks/useAuditFeed";

export default function ActivityLogsPage() {
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("all");

  // Bug 20a: shared with AuditLogsPage/LoginLogsPage - fetches once, then
  // polls every 20s so new activity shows up without a manual reload.
  const { logs: apiLogs, offline } = useAuditFeed({ pageSize: 200 });

  const allLogs = apiLogs ?? getAllAuditLogs();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allLogs.filter((log) => {
      if (module !== "all" && log.module !== module) return false;
      if (q && ![log.action, log.performedBy, log.residentName, log.description]
        .filter(Boolean).some((v) => v.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [allLogs, search, module]);

  return (
    <Box>
      <PageHeader
        title="Activity Timeline"
        subtitle="Chronological view of all system activity grouped by day."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Audit Logs", href: "/audit" },
          { label: "Activity Timeline" },
        ]}
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

      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <TextField
          size="small" placeholder="Search activity…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
          sx={{ flex: 1, minWidth: 220 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Module</InputLabel>
          <Select value={module} label="Module" onChange={(e) => setModule(e.target.value)}>
            <MenuItem value="all">All Modules</MenuItem>
            {Object.values(AUDIT_MODULES).map((m) => (
              <MenuItem key={m} value={m}>{m}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <AuditTimeline logs={filtered} />
    </Box>
  );
}

