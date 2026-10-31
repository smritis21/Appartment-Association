import {
  Alert, Box, Button, Chip, Grid, MenuItem, Paper, Snackbar, TextField,
} from "@mui/material";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { useEffect, useMemo, useState } from "react";
import { useResidents } from "../../../context/ResidentContext";
import { ROLES } from "../../../constants/roles";
import { RESIDENT_STATUS, TOTAL_FLATS } from "../mock/residents";
import {
  fetchResidents,
  createResident as createResidentApi,
  updateResident as updateResidentApi,
  deleteResident as deleteResidentApi,
  findOrCreateFlat,
} from "../../../services/residentService";
import { isOffline } from "../../../services/apiClient";
import PageHeader from "../../../components/common/PageHeader";
import SearchBar from "../../../components/common/SearchBar";
import DashboardCard from "../../../components/cards/DashboardCard";
import ResidentTable from "../components/ResidentTable";
import ResidentForm from "../components/ResidentForm";
import DeactivateResidentDialog from "../components/DeactivateResidentDialog";
import ConfirmationDialog from "../../../components/common/ConfirmationDialog";
import "../styles/ResidentManagementPage.css";

export default function ResidentManagementPage() {
  const { residents: ctxResidents, addResident, updateResident, deactivateResident, deleteResident } = useResidents();

  const [apiResidents, setApiResidents] = useState(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    fetchResidents()
      .then((data) => { setApiResidents(data); setOffline(false); })
      .catch((err) => {
        if (isOffline(err)) setOffline(true);
      });
  }, []);

  // Use API data when available (even if genuinely empty), fall back to
  // context (mock) data only when the backend is unreachable.
  const residents = apiResidents ?? ctxResidents;

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const stats = useMemo(() => ({
    total:   residents.length,
    owners:  residents.filter((r) => r.role === ROLES.OWNER).length,
    tenants: residents.filter((r) => r.role === ROLES.TENANT).length,
    active:  residents.filter((r) => r.status === RESIDENT_STATUS.ACTIVE).length,
    vacant:  Math.max(0, TOTAL_FLATS - residents.filter((r) => r.status === RESIDENT_STATUS.ACTIVE).length),
  }), [residents]);

  const filtered = useMemo(() => residents.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = r.name.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      `${r.wing}-${r.flat}`.toLowerCase().includes(q);
    const matchRole   = roleFilter   === "all" || r.role   === roleFilter;
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchRole && matchStatus;
  }), [residents, search, roleFilter, statusFilter]);

  const showSnackbar = (message, severity = "success") =>
    setSnackbar({ open: true, message, severity });

  const showError = (err) =>
    showSnackbar(isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message, "error");

  /** UI form fields -> backend ResidentCreate/ResidentUpdate payload. */
  const toApiPayload = (data) => ({
    name: data.name,
    phone: data.phone,
    occupation: data.occupation,
    move_in_date: data.moveInDate || null,
    status: RESIDENT_STATUS.ACTIVE,
    family_members: [],
    emergency_contacts:
      data.emergencyContact?.name && data.emergencyContact?.phone
        ? [{
            name: data.emergencyContact.name,
            relationship: data.emergencyContact.relation,
            phone: data.emergencyContact.phone,
          }]
        : [],
  });

  const handleFormSubmit = async (data) => {
    setFormLoading(true);
    try {
      if (apiResidents) {
        if (editTarget) {
          const payload = toApiPayload(data);
          if (data.wing !== editTarget.wing || data.flat !== editTarget.flat) {
            const flat = await findOrCreateFlat({
              block: data.wing,
              flatNumber: data.flat,
              ownershipType: data.role === ROLES.OWNER ? "owned" : "rented",
            });
            payload.flat_id = flat.id;
          }
          const updated = await updateResidentApi(editTarget.id, payload);
          setApiResidents((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          showSnackbar("Resident updated successfully.");
        } else {
          const flat = await findOrCreateFlat({
            block: data.wing,
            flatNumber: data.flat,
            ownershipType: data.role === ROLES.OWNER ? "owned" : "rented",
          });
          const created = await createResidentApi({ ...toApiPayload(data), flat_id: flat.id });
          setApiResidents((prev) => [created, ...prev]);
          showSnackbar("Resident added successfully.");
        }
      } else if (editTarget) {
        // Backend unreachable - fall back to the local demo dataset.
        updateResident(editTarget.id, data);
        showSnackbar("Resident updated successfully.");
      } else {
        addResident({
          ...data,
          id: `RES-${String(Date.now()).slice(-5)}`,
          appId: null,
          status: RESIDENT_STATUS.ACTIVE,
          documents: [],
          emergencyContact: data.emergencyContact,
        });
        showSnackbar("Resident added successfully.");
      }
    } catch (err) {
      showError(err);
    } finally {
      setFormLoading(false);
      setFormOpen(false);
      setEditTarget(null);
    }
  };

  const handleDeactivate = async (reason) => {
    try {
      if (apiResidents) {
        const updated = await updateResidentApi(deactivateTarget.id, { status: RESIDENT_STATUS.INACTIVE });
        setApiResidents((prev) => prev.map((r) => (r.id === updated.id ? { ...updated, deactivationReason: reason } : r)));
      } else {
        deactivateResident(deactivateTarget.id, reason);
      }
      showSnackbar(`${deactivateTarget.name} has been deactivated.`, "warning");
    } catch (err) {
      showError(err);
    } finally {
      setDeactivateTarget(null);
    }
  };

  const handleDelete = async () => {
    try {
      if (apiResidents) {
        // The API only ever soft-deletes (sets status=inactive) - the row
        // itself is retained for audit/billing history, never removed.
        await deleteResidentApi(deleteTarget.id);
        setApiResidents((prev) => prev.map((r) => (r.id === deleteTarget.id ? { ...r, status: RESIDENT_STATUS.INACTIVE } : r)));
      } else {
        deleteResident(deleteTarget.id);
      }
      showSnackbar(`${deleteTarget.name} has been removed.`, "error");
    } catch (err) {
      showError(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Resident Management"
        subtitle="Manage all residents of Jains Kences Retreat"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Residents" }]}
        action={
          <Button variant="contained" startIcon={<PersonAddOutlinedIcon />}
            onClick={() => { setEditTarget(null); setFormOpen(true); }}
            sx={{ fontWeight: 600 }}>
            Add Resident
          </Button>
        }
      />

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { title: "Total Residents", value: stats.total,   icon: PeopleOutlinedIcon,       color: "primary.main" },
          { title: "Owners",          value: stats.owners,  icon: HomeOutlinedIcon,          color: "success.main" },
          { title: "Tenants",         value: stats.tenants, icon: PersonOutlinedIcon,        color: "info.main"    },
          { title: "Active",          value: stats.active,  icon: CheckCircleOutlinedIcon,   color: "success.main" },
          { title: "Vacant Flats",    value: stats.vacant,  icon: MeetingRoomOutlinedIcon,   color: "warning.main" },
        ].map((c) => (
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={c.title}>
            <DashboardCard title={c.title} value={c.value} icon={c.icon} color={c.color} />
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <SearchBar value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, email or flat..." sx={{ flex: 1, minWidth: 220 }} />
          <TextField select size="small" label="Role" value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)} sx={{ minWidth: 130 }}>
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value={ROLES.OWNER}>Owner</MenuItem>
            <MenuItem value={ROLES.TENANT}>Tenant</MenuItem>
          </TextField>
          <TextField select size="small" label="Status" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value={RESIDENT_STATUS.ACTIVE}>Active</MenuItem>
            <MenuItem value={RESIDENT_STATUS.INACTIVE}>Inactive</MenuItem>
            <MenuItem value={RESIDENT_STATUS.MOVED_OUT}>Moved Out</MenuItem>
          </TextField>
        </Box>
      </Paper>

      <ResidentTable
        residents={filtered}
        onEdit={(r) => { setEditTarget(r); setFormOpen(true); }}
        onDeactivate={(r) => setDeactivateTarget(r)}
        onDelete={(r) => setDeleteTarget(r)}
      />

      <ResidentForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditTarget(null); }}
        onSubmit={handleFormSubmit}
        initialData={editTarget}
        loading={formLoading}
      />

      <DeactivateResidentDialog
        open={!!deactivateTarget}
        resident={deactivateTarget}
        onConfirm={handleDeactivate}
        onCancel={() => setDeactivateTarget(null)}
      />

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Resident?"
        message={`This will remove ${deleteTarget?.name} from active listings. The record is retained for audit and billing history and can be reactivated later.`}
        confirmLabel="Delete"
        severity="error"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
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

