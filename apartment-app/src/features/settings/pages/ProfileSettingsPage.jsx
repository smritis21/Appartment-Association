import { useEffect, useState } from "react";
import {
  Box, Grid, Button, Avatar, Typography, Snackbar, Alert, Paper,
} from "@mui/material";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import PageHeader from "../../../components/common/PageHeader";
import SettingsSection from "../components/SettingsSection";
import { SettingsTextField } from "../components/SettingsFields";
import ConfirmationDialog from "../../../components/common/ConfirmationDialog";
import { useAuth } from "../../../hooks/useAuth";
import { fetchResident } from "../../../services/residentService";
import { ROLE_LABELS } from "../../../constants/roles";

// Resolves the current user's resident record via user.residentId, fetched
// from the backend (see authService.toUiUser()). A falsy residentId (e.g.
// staff/admin with no linked resident) is a legitimate case - the "-"
// fallback covers it.
export default function ProfileSettingsPage() {
  const { user } = useAuth();
  const [resident, setResident] = useState(null);
  const [loading, setLoading] = useState(!!user?.residentId);

  useEffect(() => {
    let cancelled = false;
    if (!user?.residentId) {
      setResident(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    fetchResident(user.residentId)
      .then((res) => { if (!cancelled) setResident(res); })
      .catch(() => { if (!cancelled) setResident(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user?.residentId]);

  const buildInit = (res) => ({
    name:             user?.name  ?? res?.name  ?? "",
    email:            user?.email ?? res?.email ?? "",
    phone:            user?.phone ?? res?.phone ?? "",
    role:             ROLE_LABELS[user?.role ?? res?.role] ?? "",
    wing:             res?.wing  ?? "",
    flat:             res?.flat  ?? "",
    emergencyName:    res?.emergencyContact?.name     ?? "",
    emergencyPhone:   res?.emergencyContact?.phone    ?? "",
    emergencyRelation:res?.emergencyContact?.relation ?? "",
  });

  const [form, setForm] = useState(() => buildInit(null));
  const [toast, setToast] = useState({ open: false, msg: "", sev: "success" });
  const [confirmReset, setConfirmReset] = useState(false);

  // Re-seed the form once the real resident record (if any) has loaded.
  useEffect(() => {
    if (!loading) setForm(buildInit(resident));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, resident]);

  const set = (field) => (val) => setForm((p) => ({ ...p, [field]: val }));

  const handleSave = () => setToast({ open: true, msg: "Profile saved successfully.", sev: "success" });
  const handleReset = () => { setForm(buildInit(resident)); setConfirmReset(false); setToast({ open: true, msg: "Profile reset to original values.", sev: "info" }); };

  return (
    <Box>
      <PageHeader
        title="Profile Settings"
        subtitle="Update your personal information and emergency contact."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings", href: "/settings" }, { label: "Profile" }]}
      />

      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <Avatar sx={{ width: 64, height: 64, bgcolor: "primary.main", fontSize: 26 }}>
            {form.name ? form.name[0].toUpperCase() : <PersonOutlinedIcon />}
          </Avatar>
          <Box>
            <Typography variant="h6" fontWeight={700}>{form.name || "-"}</Typography>
            <Typography variant="body2" color="text.secondary">{form.role} · {form.wing && form.flat ? `Wing ${form.wing}, Flat ${form.flat}` : "-"}</Typography>
          </Box>
        </Box>

        <SettingsSection title="Personal Information">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsTextField label="Full Name"    value={form.name}  onChange={set("name")} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsTextField label="Email"        value={form.email} onChange={set("email")} type="email" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsTextField label="Phone Number" value={form.phone} onChange={set("phone")} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsTextField label="Role"         value={form.role}  onChange={set("role")} disabled /></Grid>
            <Grid size={{ xs: 12, sm: 3 }}><SettingsTextField label="Wing"         value={form.wing}  onChange={set("wing")} /></Grid>
            <Grid size={{ xs: 12, sm: 3 }}><SettingsTextField label="Flat Number"  value={form.flat}  onChange={set("flat")} /></Grid>
          </Grid>
        </SettingsSection>

        <SettingsSection title="Emergency Contact">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}><SettingsTextField label="Contact Name"     value={form.emergencyName}     onChange={set("emergencyName")} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><SettingsTextField label="Relation"         value={form.emergencyRelation} onChange={set("emergencyRelation")} /></Grid>
            <Grid size={{ xs: 12, sm: 4 }}><SettingsTextField label="Contact Phone"    value={form.emergencyPhone}    onChange={set("emergencyPhone")} /></Grid>
          </Grid>
        </SettingsSection>

        <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
          <Button variant="outlined" color="inherit" sx={{ textTransform: "none" }} onClick={() => setConfirmReset(true)}>Reset</Button>
          <Button variant="contained" sx={{ textTransform: "none" }} onClick={handleSave}>Save Changes</Button>
        </Box>
      </Paper>

      <ConfirmationDialog
        open={confirmReset}
        title="Reset Profile?"
        message="This will discard all unsaved changes and restore original values."
        confirmLabel="Reset"
        onConfirm={handleReset}
        onCancel={() => setConfirmReset(false)}
      />

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast.sev} onClose={() => setToast((p) => ({ ...p, open: false }))} sx={{ width: "100%" }}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
