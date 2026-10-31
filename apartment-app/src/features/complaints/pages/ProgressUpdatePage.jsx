import {
  Alert, Box, Button, Chip, Divider, Grid, MenuItem, Paper, Snackbar,
  TextField, Typography,
} from "@mui/material";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import EmptyState from "../../../components/common/EmptyState";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { useAuth } from "../../../hooks/useAuth";
import { useProgressDesk } from "../../../hooks/useProgressDesk";
import { ROLES } from "../../../constants/roles";
import { COMPLAINT_STATUS, STATUS_LABELS, STATUS_ORDER } from "../mock/complaints";
import { formatDateTime } from "../../../utils/formatDate";
import ComplaintStatusChip from "../components/ComplaintStatusChip";

// FE-16 - Complaint Progress Update Screen (Staff). The assigned, still-open
// complaints come from the live backend (BE-14) and each status change calls
// PUT /complaints/{id}/progress (BE-16): the API records the change on the
// immutable audit trail and the same update then shows on the resident's
// tracking screen (INT-16 / INT-02). Falls back to local mock data when the
// backend is unreachable.
export default function ProgressUpdatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { rows, loading, offline, error, update } = useProgressDesk();
  const [drafts, setDrafts] = useState({}); // { [id]: { status, notes } }
  const [busyId, setBusyId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const isStaff = user?.role === ROLES.MAINTENANCE;

  // Staff can move a complaint forward up to Resolved; only management closes a
  // complaint (after resident confirmation), matching the closure trail in the
  // seed data and the transitions the backend allows.
  const nextStatuses = (current) => {
    const forward = STATUS_ORDER.slice(STATUS_ORDER.indexOf(current) + 1);
    return isStaff ? forward.filter((s) => s !== COMPLAINT_STATUS.CLOSED) : forward;
  };

  const setDraft = (id, patch) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const handleUpdate = async (row) => {
    const draft = drafts[row.id];
    if (!draft?.status) return;
    setBusyId(row.id);
    try {
      await update(row.id, draft.status, draft.notes, user?.name ?? "Staff");
      setDrafts((prev) => ({ ...prev, [row.id]: { status: "", notes: "" } }));
      setSnackbar({
        open: true,
        severity: "success",
        message: `${row.reference || row.id} moved to ${STATUS_LABELS[draft.status]}.`,
      });
    } catch (err) {
      // A backend rejection (400 illegal transition, 403 inactive staff, 404
      // unknown) carries a message worth showing.
      setSnackbar({
        open: true,
        severity: "error",
        message: err.detail ?? err.message ?? "Progress update failed.",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Update Complaint Progress"
        subtitle={isStaff ? "Assigned complaints - update status as work progresses" : "Assigned complaints across all staff"}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Complaint Desk", href: "/complaints/monitoring" },
          { label: "Progress" },
        ]}
      />

      {offline && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Showing local data - the server could not be reached, so progress
          updates will not be saved to the backend.
        </Alert>
      )}

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <Paper elevation={1} sx={{ borderRadius: 2 }}>
          <EmptyState
            icon={BuildOutlinedIcon}
            title="No assigned complaints"
            description="Complaints assigned for maintenance will appear here."
          />
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {rows.map((c) => {
            const draft = drafts[c.id] ?? { status: "", notes: "" };
            return (
              <Grid size={{ xs: 12, md: 6 }} key={c.id}>
                <Paper elevation={1} sx={{ borderRadius: 2, p: 2.5 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography
                      fontWeight={700}
                      fontFamily="var(--font-mono)"
                      sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                      onClick={() => navigate(`/complaints/${c.id}`)}
                    >
                      {c.reference || c.id}
                    </Typography>
                    <ComplaintStatusChip status={c.status} />
                  </Box>
                  <Typography variant="body2" sx={{ mt: 1 }}>{c.description}</Typography>
                  <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
                    <Chip label={c.category} size="small" variant="outlined" />
                    {c.location && <Chip label={c.location} size="small" variant="outlined" />}
                    {!isStaff && c.assignedName && (
                      <Chip label={`Assigned: ${c.assignedName}`} size="small" color="info" variant="outlined" />
                    )}
                  </Box>
                  {c.updatedAt && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                      Last update: {formatDateTime(c.updatedAt)}{c.lastNote ? ` - ${c.lastNote}` : ""}
                    </Typography>
                  )}

                  <Divider sx={{ my: 1.5 }} />

                  <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, sm: 5 }}>
                      <TextField
                        select
                        fullWidth
                        size="small"
                        label="New Status"
                        value={draft.status}
                        onChange={(e) => setDraft(c.id, { status: e.target.value })}
                      >
                        {nextStatuses(c.status).map((s) => (
                          <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>
                        ))}
                      </TextField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 7 }}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Work Notes"
                        placeholder="What was done?"
                        value={draft.notes ?? ""}
                        onChange={(e) => setDraft(c.id, { notes: e.target.value })}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
                        <Button
                          variant="contained"
                          size="small"
                          disabled={!draft.status || busyId === c.id}
                          onClick={() => handleUpdate(c)}
                          sx={{ fontWeight: 600 }}
                        >
                          {busyId === c.id ? "Updating…" : "Update Status"}
                        </Button>
                        <Typography variant="caption" color="text.secondary">
                          Update time will be recorded automatically.
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
