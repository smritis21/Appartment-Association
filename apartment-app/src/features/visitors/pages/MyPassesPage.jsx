import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Snackbar,
  Tab,
  Tabs,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import QrCode2OutlinedIcon from "@mui/icons-material/QrCode2Outlined";
import { useEffect, useMemo, useState } from "react";
import {
  mockPasses,
  PASS_STATE,
  ENTRY_STATE,
  computePassState,
} from "../mock/passes";
import { fetchPasses, issuePass } from "../../../services/visitorService";
import { isOffline } from "../../../services/apiClient";
import PassCard from "../components/PassCard";
import GuestPassForm from "../components/GuestPassForm";
import PageHeader from "../../../components/common/PageHeader";
import StatCard from "../../../components/cards/StatCard";
import EmptyState from "../../../components/common/EmptyState";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { useAuth } from "../../../hooks/useAuth";

const TABS = [
  { value: "all", label: "All" },
  { value: PASS_STATE.ACTIVE, label: "Active" },
  { value: PASS_STATE.UPCOMING, label: "Upcoming" },
  { value: PASS_STATE.EXPIRED, label: "Expired" },
];

export default function MyPassesPage() {
  const { user } = useAuth();
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  useEffect(() => {
    if (!user?.residentId) {
      // No linked resident record (e.g. staff/admin login) - nothing to fetch.
      setPasses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchPasses({ residentId: user.residentId })
      .then((data) => { setPasses(data); setOffline(false); })
      .catch((err) => {
        if (isOffline(err)) {
          setOffline(true);
          const flat = user?.flat;
          setPasses(flat ? mockPasses.filter((p) => p.flat === flat) : mockPasses);
        }
      })
      .finally(() => setLoading(false));
  }, [user]);

  const counts = useMemo(() => {
    const c = { [PASS_STATE.ACTIVE]: 0, [PASS_STATE.UPCOMING]: 0, [PASS_STATE.EXPIRED]: 0, all: passes.length };
    passes.forEach((p) => { c[computePassState(p)] += 1; });
    return c;
  }, [passes]);

  const visible = useMemo(
    () => (tab === "all" ? passes : passes.filter((p) => computePassState(p) === tab)),
    [passes, tab]
  );

  const handleIssue = async (data) => {
    try {
      if (!offline && user?.residentId) {
        const pass = await issuePass({ ...data, residentId: user.residentId });
        setPasses((prev) => [pass, ...prev]);
        setFormOpen(false);
        setSnackbar({ open: true, message: `Pass ${pass.code} issued for ${pass.visitorName}.`, severity: "success" });
        return;
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message,
        severity: "error",
      });
      return;
    }

    // Offline / no linked resident - local demo fallback.
    const pass = {
      id: `GP-${Date.now()}`,
      code: `JKR-${String(Math.floor(1000 + Math.random() * 9000))}`,
      flat: user?.flat ?? "A-101",
      host: user?.name ?? "Resident",
      entry: ENTRY_STATE.AWAITING,
      entryAt: null,
      exitAt: null,
      gate: "Main Gate",
      ...data,
    };
    setPasses((prev) => [pass, ...prev]);
    setFormOpen(false);
    setSnackbar({ open: true, message: `Pass ${pass.code} issued for ${pass.visitorName}.`, severity: "success" });
  };

  return (
    <Box>
      <PageHeader
        title="Visitor Passes"
        subtitle="Issue guest passes and log expected deliveries for your flat"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Visitor Passes" }]}
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
            Issue Pass
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={4}>
          <StatCard label="Active" value={counts[PASS_STATE.ACTIVE]} />
        </Grid>
        <Grid size={4}>
          <StatCard label="Upcoming" value={counts[PASS_STATE.UPCOMING]} />
        </Grid>
        <Grid size={4}>
          <StatCard label="Expired" value={counts[PASS_STATE.EXPIRED]} />
        </Grid>
      </Grid>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 2, borderBottom: "1px solid", borderColor: "divider" }}
      >
        {TABS.map((t) => (
          <Tab key={t.value} value={t.value} label={`${t.label} (${counts[t.value]})`} />
        ))}
      </Tabs>

      {loading ? (
        <LoadingSpinner message="Loading your passes..." />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={QrCode2OutlinedIcon}
          title="No passes here"
          description="Issue a guest pass or log an expected delivery to get started."
          action={() => setFormOpen(true)}
          actionLabel="Issue Pass"
        />
      ) : (
        <Grid container spacing={2}>
          {visible.map((pass) => (
            <Grid size={{ xs: 12, md: 6 }} key={pass.id}>
              <PassCard pass={pass} />
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Issue a Visitor Pass</DialogTitle>
        <DialogContent>
          <GuestPassForm onIssue={handleIssue} onCancel={() => setFormOpen(false)} />
        </DialogContent>
      </Dialog>

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

