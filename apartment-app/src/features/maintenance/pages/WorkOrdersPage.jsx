import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Snackbar,
  TextField,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import PageHeader from "../../../components/common/PageHeader";
import WorkOrderBoard from "../components/WorkOrderBoard";
import WorkOrderForm from "../components/WorkOrderForm";
import {
  WO_STATUS,
  WO_TYPE,
  WO_TYPE_META,
  PRIORITY,
  PRIORITY_META,
  STAFF,
} from "../mock/workOrders";
import { ASSETS } from "../mock/assets";
import { useWorkOrders } from "../../../hooks/useWorkOrders";

function StatTile({ label, value, color = "primary.main" }) {
  return (
    <Grid size={{ xs: 6, sm: 3 }}>
      <Box sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", p: 2, height: "100%" }}>
        <Box sx={{ fontSize: 28, fontWeight: 700, color, fontFamily: "var(--font-serif)" }}>{value}</Box>
        <Box sx={{ fontSize: 13.5, color: "text.secondary" }}>{label}</Box>
      </Box>
    </Grid>
  );
}

export default function WorkOrdersPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);
  const [assignValue, setAssignValue] = useState("");
  const [completeTarget, setCompleteTarget] = useState(null);
  const [outcome, setOutcome] = useState("");
  const [outcomeError, setOutcomeError] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const [typeFilter, setTypeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assetFilter, setAssetFilter] = useState("all");

  const filterParams = useMemo(() => {
    const f = {};
    if (typeFilter !== "all") f.type = typeFilter;
    if (priorityFilter !== "all") f.priority = priorityFilter;
    return f;
  }, [typeFilter, priorityFilter]);

  const {
    orders,
    stats,
    loading,
    offline,
    error,
    createWorkOrder,
    assignWorkOrder,
    advanceWorkOrder,
    completeWorkOrder,
  } = useWorkOrders(filterParams);

  const toast = (message, severity = "success") => setSnackbar({ open: true, message, severity });

  const filtered = useMemo(() => {
    return (orders ?? [])
      .filter((w) => assetFilter === "all" || w.assetId === assetFilter)
      .slice()
      .sort((a, b) => (PRIORITY_META[b.priority]?.rank ?? 0) - (PRIORITY_META[a.priority]?.rank ?? 0));
  }, [orders, assetFilter]);

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };
  const openEdit = (wo) => {
    setEditTarget(wo);
    setFormOpen(true);
  };
  const handleFormSubmit = async (data) => {
    if (editTarget) {
      toast(`${editTarget.id} updated`);
    } else {
      const res = await createWorkOrder(data);
      if (res.ok) {
        toast(`Work order created`);
      } else {
        toast(res.error || "Failed to create work order", "error");
      }
    }
    setFormOpen(false);
    setEditTarget(null);
  };

  const openAssign = (wo) => {
    setAssignTarget(wo);
    setAssignValue(wo.assignee ?? "");
  };
  const confirmAssign = async () => {
    const res = await assignWorkOrder(assignTarget.id, assignValue || null);
    if (res.ok) {
      const name = STAFF.find((s) => s.id === assignValue)?.name ?? assignValue ?? "no one";
      toast(`${assignTarget.id} assigned to ${name}`);
    } else {
      toast(res.error || "Failed to assign work order", "error");
    }
    setAssignTarget(null);
  };

  const handleAdvance = async (wo) => {
    const nextIsComplete = WO_STATUS.IN_PROGRESS === wo.status;
    if (nextIsComplete) {
      setCompleteTarget(wo);
      setOutcome("");
      setOutcomeError("");
      return;
    }
    if (wo.status === WO_STATUS.OPEN && !wo.assignee) {
      openAssign(wo);
      toast("Assign someone before starting this order.", "info");
      return;
    }
    const res = await advanceWorkOrder(wo.id);
    if (res.ok) {
      toast(`${wo.id} moved forward`);
    } else {
      toast(res.error || "Failed to update status", "error");
    }
  };

  const confirmComplete = async () => {
    if (outcome.trim().length < 5) {
      setOutcomeError("Record a short outcome (min 5 characters).");
      return;
    }
    const res = await completeWorkOrder(completeTarget.id, outcome.trim());
    if (res.ok) {
      toast(`${completeTarget.id} completed`);
    } else {
      toast(res.error || "Failed to complete work order", "error");
    }
    setCompleteTarget(null);
  };

  return (
    <Box>
      <PageHeader
        title="Work Orders"
        subtitle="Track reactive and preventive maintenance across the society"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Work Orders" }]}
        action={
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openCreate}>
            New work order
          </Button>
        }
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load work orders: {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {loading ? (
          <>
            <Grid size={{ xs: 6, sm: 3 }}><Skeleton variant="rounded" height={90} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><Skeleton variant="rounded" height={90} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><Skeleton variant="rounded" height={90} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><Skeleton variant="rounded" height={90} /></Grid>
          </>
        ) : (
          <>
            <StatTile label="Total orders" value={stats.total} />
            <StatTile label="Open" value={stats.open} color="text.primary" />
            <StatTile label="Overdue" value={stats.overdue} color="error.main" />
            <StatTile label="Completed" value={stats.completed} color="success.main" />
          </>
        )}
      </Grid>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2.5 }}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="type-f">Type</InputLabel>
          <Select labelId="type-f" label="Type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <MenuItem value="all">All types</MenuItem>
            {Object.values(WO_TYPE).map((t) => (
              <MenuItem key={t} value={t}>{WO_TYPE_META[t]?.label ?? t}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="prio-f">Priority</InputLabel>
          <Select labelId="prio-f" label="Priority" value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <MenuItem value="all">All priorities</MenuItem>
            {Object.values(PRIORITY).map((p) => (
              <MenuItem key={p} value={p}>{PRIORITY_META[p]?.label ?? p}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel id="asset-f">Asset</InputLabel>
          <Select labelId="asset-f" label="Asset" value={assetFilter} onChange={(e) => setAssetFilter(e.target.value)}>
            <MenuItem value="all">All assets</MenuItem>
            {ASSETS.map((a) => (
              <MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {loading ? (
        <Skeleton variant="rounded" height={300} />
      ) : (
        <WorkOrderBoard
          workOrders={filtered}
          onAssign={openAssign}
          onAdvance={handleAdvance}
          onEdit={openEdit}
        />
      )}

      <WorkOrderForm
        open={formOpen}
        workOrder={editTarget}
        onClose={() => {
          setFormOpen(false);
          setEditTarget(null);
        }}
        onSubmit={handleFormSubmit}
      />

      <Dialog open={!!assignTarget} onClose={() => setAssignTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Assign {assignTarget?.id}</DialogTitle>
        <DialogContent>
          <TextField
            select
            label="Staff / vendor"
            value={assignValue}
            onChange={(e) => setAssignValue(e.target.value)}
            fullWidth
            sx={{ mt: 1 }}
          >
            <MenuItem value="">- Unassigned -</MenuItem>
            {STAFF.map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.name} · {s.trade}</MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAssignTarget(null)} variant="outlined" color="inherit">Cancel</Button>
          <Button onClick={confirmAssign} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!completeTarget} onClose={() => setCompleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Complete {completeTarget?.id}</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            Recording an outcome adds this to the asset&apos;s maintenance history.
          </Alert>
          <TextField
            label="Outcome"
            value={outcome}
            onChange={(e) => {
              setOutcome(e.target.value);
              setOutcomeError("");
            }}
            multiline
            minRows={3}
            fullWidth
            placeholder="e.g. Replaced blower motor; plant back online."
            error={!!outcomeError}
            helperText={outcomeError}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCompleteTarget(null)} variant="outlined" color="inherit">Cancel</Button>
          <Button onClick={confirmComplete} variant="contained" color="success">Mark completed</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

