import { useEffect, useState } from "react";
import { Box, Paper, Button, Snackbar, Alert, Grid } from "@mui/material";
import PageHeader from "../../../components/common/PageHeader";
import SettingsSection from "../components/SettingsSection";
import { SettingsTextField, SettingsSwitch } from "../components/SettingsFields";
import { defaultApartment } from "../mock/settings";
import { fetchAllConfig, setConfig } from "../../../services/settingsService";
import { isOffline } from "../../../services/apiClient";

// Only these four fields have a matching backend config key (see
// settings_service.py::ALLOWED_CONFIG_KEYS) - the rest (wings, floors,
// totalFlats, feature toggles, address, etc.) have no server-side field yet.
const CONFIG_KEY_MAP = {
  name: "society_name",
  contactPhone: "emergency_contact_number",
  maintenanceDueDay: "maintenance_due_day",
  lateFeePercentage: "late_fee_rate_percent",
};

export default function ApartmentSettingsPage() {
  const [apt, setApt] = useState({ ...defaultApartment });
  const [toast, setToast] = useState({ open: false, msg: "", sev: "success" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAllConfig()
      .then((rows) => {
        const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
        setApt((p) => ({
          ...p,
          ...(byKey.society_name !== undefined ? { name: byKey.society_name } : {}),
          ...(byKey.emergency_contact_number !== undefined ? { contactPhone: byKey.emergency_contact_number } : {}),
          ...(byKey.maintenance_due_day !== undefined ? { maintenanceDueDay: Number(byKey.maintenance_due_day) } : {}),
          ...(byKey.late_fee_rate_percent !== undefined ? { lateFeePercentage: Number(byKey.late_fee_rate_percent) } : {}),
        }));
      })
      .catch(() => {});
  }, []);

  const set = (key) => (val) => setApt((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const results = await Promise.allSettled(
        Object.entries(CONFIG_KEY_MAP).map(([field, key]) => setConfig(key, apt[field]))
      );
      const failure = results.find((r) => r.status === "rejected");
      if (failure) {
        const err = failure.reason;
        throw err;
      }
      setToast({ open: true, msg: "Apartment configuration saved.", sev: "success" });
    } catch (err) {
      setToast({
        open: true,
        msg: isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message,
        sev: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Apartment Configuration"
        subtitle="Manage apartment details, billing rules, and feature toggles."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings", href: "/settings" }, { label: "Apartment" }]}
      />

      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, mb: 3 }}>
        <SettingsSection title="Apartment Details" description="Basic information about the apartment complex.">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsTextField label="Apartment Name"  value={apt.name}       onChange={set("name")} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsTextField label="Short Name"      value={apt.shortName}  onChange={set("shortName")} /></Grid>
            <Grid size={12}><SettingsTextField label="Address"                value={apt.address}    onChange={set("address")} multiline rows={2} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsTextField label="Contact Email"   value={apt.contactEmail}  onChange={set("contactEmail")} type="email" /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsTextField label="Contact Phone"   value={apt.contactPhone}  onChange={set("contactPhone")} /></Grid>
          </Grid>
        </SettingsSection>

        <SettingsSection title="Structure" description="Physical layout of the apartment complex.">
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}><SettingsTextField label="Number of Wings"  value={String(apt.wings)}      onChange={(v) => set("wings")(Number(v))} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><SettingsTextField label="Number of Floors" value={String(apt.floors)}     onChange={(v) => set("floors")(Number(v))} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><SettingsTextField label="Total Flats"      value={String(apt.totalFlats)} onChange={(v) => set("totalFlats")(Number(v))} /></Grid>
          </Grid>
        </SettingsSection>

        <SettingsSection title="Maintenance Configuration" description="Billing and fee settings.">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <SettingsTextField label="Maintenance Due Day (of month)" value={String(apt.maintenanceDueDay)} onChange={(v) => set("maintenanceDueDay")(Number(v))} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <SettingsTextField label="Late Fee (%)" value={String(apt.lateFeePercentage)} onChange={(v) => set("lateFeePercentage")(Number(v))} />
            </Grid>
          </Grid>
        </SettingsSection>

        <SettingsSection title="Features" description="Enable or disable apartment features.">
          <SettingsSwitch label="Visitor Parking"            description="Allow visitor parking management."          checked={apt.visitorParkingEnabled} onChange={set("visitorParkingEnabled")} />
          <SettingsSwitch label="Community Hall Booking"     description="Enable community hall reservation system."   checked={apt.communityHallBooking}  onChange={set("communityHallBooking")} />
          <SettingsSwitch label="Complaint Escalation"       description="Auto-escalate unresolved complaints."        checked={apt.complaintEscalation}   onChange={set("complaintEscalation")} />
        </SettingsSection>

        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button variant="contained" sx={{ textTransform: "none" }} disabled={saving} onClick={handleSave}>Save Configuration</Button>
        </Box>
      </Paper>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast.sev} onClose={() => setToast((p) => ({ ...p, open: false }))} sx={{ width: "100%" }}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}

