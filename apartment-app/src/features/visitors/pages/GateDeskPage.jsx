import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  MenuItem,
  Paper,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import DoorFrontOutlinedIcon from "@mui/icons-material/DoorFrontOutlined";
import { useEffect, useMemo, useState } from "react";
import {
  mockPasses,
  ENTRY_STATE,
  getOnPremiseVisitors,
} from "../mock/passes";
import { fetchPasses, lookupPassByCode, approvePassEntry, recordExit } from "../../../services/visitorService";
import { isOffline } from "../../../services/apiClient";
import GateVerifyPanel from "../components/GateVerifyPanel";
import VisitorHistoryTable from "../components/VisitorHistoryTable";
import PageHeader from "../../../components/common/PageHeader";
import SearchBar from "../../../components/common/SearchBar";
import EmptyState from "../../../components/common/EmptyState";
import { formatDateTime } from "../../../utils/formatDate";

export default function GateDeskPage() {
  const [passes, setPasses] = useState(mockPasses);
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState("verify");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [flatFilter, setFlatFilter] = useState("all");

  useEffect(() => {
    fetchPasses({ limit: 200 })
      .then((data) => { setPasses(data); setOffline(false); })
      .catch((err) => { if (isOffline(err)) setOffline(true); });
  }, []);

  const onPremise = useMemo(() => getOnPremiseVisitors(passes), [passes]);
  const flats = useMemo(() => [...new Set(passes.map((p) => p.flat))].sort(), [passes]);

  const notify = (message, severity = "success") => setSnackbar({ open: true, message, severity });

  const upsertPass = (updated) => {
    setPasses((prev) =>
      prev.some((p) => p.id === updated.id)
        ? prev.map((p) => (p.id === updated.id ? updated : p))
        : [updated, ...prev]
    );
  };

  const updateEntryLocal = (pass, entry, stamp) => {
    setPasses((prev) =>
      prev.map((p) => (p.id === pass.id ? { ...p, entry, ...stamp } : p))
    );
  };

  const handleLookup = async (code) => {
    if (offline) return mockPasses.find((p) => p.code.toUpperCase() === code.toUpperCase()) ?? null;
    try {
      return await lookupPassByCode(code);
    } catch (err) {
      if (isOffline(err)) setOffline(true);
      return null;
    }
  };

  const handleEntry = async (pass) => {
    if (offline) {
      updateEntryLocal(pass, ENTRY_STATE.ON_PREMISE, { entryAt: new Date().toISOString() });
      notify(`${pass.visitorName} checked in at ${pass.gate}.`);
      return;
    }
    try {
      const updated = await approvePassEntry(pass.code, pass.gate);
      upsertPass(updated);
      notify(`${pass.visitorName} checked in at ${pass.gate}.`);
    } catch (err) {
      notify(isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message, "error");
    }
  };
  const handleDeny = (pass) => {
    // No backend concept of "deny" exists for an already-issued pass (see
    // visitors.py) - this is a gate-desk-local note only, not persisted.
    updateEntryLocal(pass, ENTRY_STATE.DENIED, {});
    notify(`Entry denied for ${pass.visitorName}.`, "error");
  };
  const handleExit = async (pass) => {
    if (offline) {
      updateEntryLocal(pass, ENTRY_STATE.EXITED, { exitAt: new Date().toISOString() });
      notify(`${pass.visitorName} checked out.`, "info");
      return;
    }
    try {
      const updated = await recordExit(pass.id);
      upsertPass(updated);
      notify(`${pass.visitorName} checked out.`, "info");
    } catch (err) {
      notify(isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message, "error");
    }
  };

  const history = useMemo(() => {
    const q = search.toLowerCase();
    return passes.filter((p) => {
      const matchSearch =
        p.visitorName.toLowerCase().includes(q) || p.code.toLowerCase().includes(q);
      const matchFlat = flatFilter === "all" || p.flat === flatFilter;
      // validFrom is null for BE-05 walk-in entries logged without a pass
      // (no validity window) - treat those as never matching a date filter
      // rather than crashing on .slice() of null.
      const matchDate = !dateFilter || (!!p.validFrom && p.validFrom.slice(0, 10) === dateFilter);
      return matchSearch && matchFlat && matchDate;
    });
  }, [passes, search, flatFilter, dateFilter]);

  return (
    <Box>
      <PageHeader
        title="Gate Desk"
        subtitle="Verify passes, record entry and exit, and review visitor history"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Gate Desk" }]}
      />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ mb: 2.5, borderBottom: "1px solid", borderColor: "divider" }}
      >
        <Tab value="verify" label="Verify & Entry" />
        <Tab value="onsite" label={`On Premises (${onPremise.length})`} />
        <Tab value="history" label="Visitor History" />
      </Tabs>

      {tab === "verify" && (
        <GateVerifyPanel
          onLookup={handleLookup}
          onEntry={handleEntry}
          onDeny={handleDeny}
          onExit={handleExit}
        />
      )}

      {tab === "onsite" && (
        onPremise.length === 0 ? (
          <EmptyState
            icon={DoorFrontOutlinedIcon}
            title="Nobody on premises"
            description="Visitors you check in will appear here until they exit."
          />
        ) : (
          <Grid container spacing={2}>
            {onPremise.map((p) => (
              <Grid size={{ xs: 12, md: 6 }} key={p.id}>
                <Paper elevation={1} sx={{ borderRadius: 2, p: 2, display: "flex", alignItems: "center", gap: 2 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography variant="subtitle1" fontWeight={700} noWrap>{p.visitorName}</Typography>
                      <Chip label="On Premises" color="success" size="small" />
                    </Box>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {p.purpose} · Flat {p.flat} · {p.gate}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      In since {formatDateTime(p.entryAt)}
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    color="info"
                    startIcon={<LogoutOutlinedIcon />}
                    onClick={() => handleExit(p)}
                  >
                    Record Exit
                  </Button>
                </Paper>
              </Grid>
            ))}
          </Grid>
        )
      )}

      {tab === "history" && (
        <Box>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
              <SearchBar
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or code..."
                sx={{ flex: 1, minWidth: 200 }}
              />
              <TextField
                type="date"
                size="small"
                label="Date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ minWidth: 160 }}
              />
              <TextField
                select
                size="small"
                label="Flat"
                value={flatFilter}
                onChange={(e) => setFlatFilter(e.target.value)}
                sx={{ minWidth: 140 }}
              >
                <MenuItem value="all">All Flats</MenuItem>
                {flats.map((f) => (
                  <MenuItem key={f} value={f}>{f}</MenuItem>
                ))}
              </TextField>
              {(search || dateFilter || flatFilter !== "all") && (
                <Button
                  color="inherit"
                  onClick={() => { setSearch(""); setDateFilter(""); setFlatFilter("all"); }}
                >
                  Clear
                </Button>
              )}
            </Box>
          </Paper>
          <VisitorHistoryTable rows={history} />
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

