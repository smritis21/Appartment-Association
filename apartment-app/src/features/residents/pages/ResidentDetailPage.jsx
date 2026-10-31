import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Grid, Paper, Snackbar, Typography,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useResidents } from "../../../context/ResidentContext";
import { ROLE_LABELS, ROLE_COLORS } from "../../auth/mock/roles";
import { formatDate } from "../../../utils/formatDate";
import PageHeader from "../../../components/common/PageHeader";
import ResidentStatusChip from "../components/ResidentStatusChip";
import ResidentDetailTabs from "../components/ResidentDetailTabs";
import ResidentForm from "../components/ResidentForm";
import DeactivateResidentDialog from "../components/DeactivateResidentDialog";
import { RESIDENT_STATUS } from "../mock/residents";
import {
  fetchResident,
  updateResident as updateResidentApi,
  findOrCreateFlat,
} from "../../../services/residentService";
import { isOffline } from "../../../services/apiClient";
import { ROLES } from "../../../constants/roles";

export default function ResidentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getResidentById, updateResident, deactivateResident } = useResidents();

  const [apiResident, setApiResident] = useState(null);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchResident(id)
      .then((r) => {
        if (cancelled) return;
        setApiResident(r);
        setOffline(false);
      })
      .catch((err) => {
        if (!cancelled && isOffline(err)) setOffline(true);
        // A real (non-network) error, e.g. 404, leaves apiResident null and
        // is treated as "not found" below rather than silently masked.
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  // Use live data when available; fall back to the demo dataset only when
  // the backend is unreachable, matching the pattern used elsewhere (e.g.
  // VisitorApprovalPage) for standalone/offline usability.
  const resident = apiResident ?? (offline ? getResidentById(id) : null);

  const [editOpen, setEditOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const showError = (err) =>
    setSnackbar({
      open: true,
      message: isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message,
      severity: "error",
    });

  if (loading) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!resident) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="h6" color="text.secondary">Resident not found.</Typography>
        <Button sx={{ mt: 2 }} onClick={() => navigate("/residents")}>Back to Residents</Button>
      </Box>
    );
  }

  const handleEditSubmit = async (data) => {
    setFormLoading(true);
    try {
      if (apiResident) {
        const payload = {
          name: data.name,
          phone: data.phone,
          occupation: data.occupation,
          move_in_date: data.moveInDate || null,
        };
        if (data.wing !== apiResident.wing || data.flat !== apiResident.flat) {
          const flat = await findOrCreateFlat({
            block: data.wing,
            flatNumber: data.flat,
            ownershipType: data.role === ROLES.OWNER ? "owned" : "rented",
          });
          payload.flat_id = flat.id;
        }
        const updated = await updateResidentApi(id, payload);
        setApiResident(updated);
      } else {
        updateResident(id, data);
      }
      setEditOpen(false);
      setSnackbar({ open: true, message: "Resident updated successfully.", severity: "success" });
    } catch (err) {
      showError(err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeactivate = async (reason) => {
    try {
      if (apiResident) {
        const updated = await updateResidentApi(id, { status: RESIDENT_STATUS.INACTIVE });
        setApiResident({ ...updated, deactivationReason: reason });
      } else {
        deactivateResident(id, reason);
      }
      setSnackbar({ open: true, message: `${resident.name} has been deactivated.`, severity: "warning" });
    } catch (err) {
      showError(err);
    } finally {
      setDeactivateOpen(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Resident Details"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Residents", href: "/residents" },
          { label: resident.name },
        ]}
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" color="inherit" startIcon={<ArrowBackIcon />}
              onClick={() => navigate("/residents")}>
              Back
            </Button>
            <Button variant="outlined" startIcon={<EditOutlinedIcon />}
              onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="outlined" color="warning" startIcon={<BlockOutlinedIcon />}
              disabled={resident.status !== RESIDENT_STATUS.ACTIVE}
              onClick={() => setDeactivateOpen(true)}>
              Deactivate
            </Button>
          </Box>
        }
      />

      <Grid container spacing={3}>
        {/* Profile card */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Paper elevation={1} sx={{ borderRadius: 3, p: 3, textAlign: "center" }}>
            <Avatar sx={{ width: 80, height: 80, bgcolor: "primary.main", fontSize: 28,
              fontWeight: 700, mx: "auto", mb: 2 }}>
              {resident.name?.[0]?.toUpperCase()}
            </Avatar>
            <Typography variant="h6" fontWeight={700}>{resident.name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{resident.email}</Typography>
            <Chip label={ROLE_LABELS[resident.role] ?? resident.role}
              color={ROLE_COLORS[resident.role] ?? "default"} size="small" sx={{ mb: 1 }} />
            <Box sx={{ mt: 1 }}>
              <ResidentStatusChip status={resident.status} />
            </Box>
            <Box sx={{ mt: 2.5, textAlign: "left" }}>
              {[
                ["Resident ID", resident.id],
                ["Flat",        `Wing ${resident.wing} • ${resident.flat}`],
                ["Phone",       resident.phone],
                ["Move-in",     formatDate(resident.moveInDate)],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="caption" fontWeight={600}>{value}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Tabs */}
        <Grid size={{ xs: 12, md: 9 }}>
          <ResidentDetailTabs resident={resident} />
        </Grid>
      </Grid>

      <ResidentForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSubmit={handleEditSubmit}
        initialData={resident}
        loading={formLoading}
      />

      <DeactivateResidentDialog
        open={deactivateOpen}
        resident={resident}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateOpen(false)}
      />

      <Snackbar open={snackbar.open} autoHideDuration={3500}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity={snackbar.severity} variant="filled"
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
