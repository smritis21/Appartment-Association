import { useState } from "react";
import { Box, Paper, Button, Snackbar, Alert, Grid } from "@mui/material";
import PageHeader from "../../../components/common/PageHeader";
import SettingsSection from "../components/SettingsSection";
import { SettingsTextField, SettingsSwitch, SettingsSelect } from "../components/SettingsFields";
import ConfirmationDialog from "../../../components/common/ConfirmationDialog";
import { defaultSystem } from "../mock/settings";

const BACKUP_OPTIONS   = [{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }];
const TIMEZONE_OPTIONS = [{ value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" }, { value: "UTC", label: "UTC" }, { value: "Asia/Dubai", label: "Asia/Dubai (GST)" }];
const CURRENCY_OPTIONS = [{ value: "INR", label: "INR - Indian Rupee (₹)" }, { value: "USD", label: "USD - US Dollar ($)" }];
const DATE_OPTIONS     = [{ value: "DD MMM YYYY", label: "DD MMM YYYY" }, { value: "DD/MM/YYYY", label: "DD/MM/YYYY" }, { value: "MM/DD/YYYY", label: "MM/DD/YYYY" }];

export default function SystemSettingsPage() {
  const [sys, setSys] = useState({ ...defaultSystem });
  const [toast, setToast] = useState({ open: false, msg: "", sev: "success" });
  const [confirmAudit, setConfirmAudit] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const set = (key) => (val) => setSys((p) => ({ ...p, [key]: val }));

  const handleSave = () => setToast({ open: true, msg: "System settings saved.", sev: "success" });

  const handleAuditToggle = (val) => {
    if (val) { setSys((p) => ({ ...p, enableAuditLogging: true })); setToast({ open: true, msg: "Audit logging enabled.", sev: "success" }); }
    else setConfirmAudit(true);
  };

  const handleRestore = () => {
    setSys({ ...defaultSystem });
    setConfirmRestore(false);
    setToast({ open: true, msg: "System settings restored to defaults.", sev: "info" });
  };

  return (
    <Box>
      <PageHeader
        title="System Settings"
        subtitle="Configure application-wide preferences and service integrations."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings", href: "/settings" }, { label: "System" }]}
      />

      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, mb: 3 }}>
        <SettingsSection title="Application" description="Core application configuration.">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsTextField label="Application Name" value={sys.appName}  onChange={set("appName")} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsTextField label="Version"          value={sys.version}  onChange={set("version")} disabled /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsSelect    label="Timezone"         value={sys.timezone} options={TIMEZONE_OPTIONS} onChange={set("timezone")} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsSelect    label="Currency"         value={sys.currency} options={CURRENCY_OPTIONS} onChange={set("currency")} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsSelect    label="Date Format"      value={sys.dateFormat} options={DATE_OPTIONS}   onChange={set("dateFormat")} /></Grid>
            <Grid size={{ xs: 12, sm: 6 }}><SettingsSelect    label="Backup Frequency" value={sys.backupFrequency} options={BACKUP_OPTIONS} onChange={set("backupFrequency")} /></Grid>
          </Grid>
        </SettingsSection>

        <SettingsSection title="Logging & Audit" description="Control audit trail and log archiving.">
          <SettingsSwitch label="Enable Audit Logging" description="Record all administrative actions in the audit log." checked={sys.enableAuditLogging} onChange={handleAuditToggle} />
          <SettingsSwitch label="Auto Archive Logs"    description="Automatically archive logs older than 90 days."     checked={sys.autoArchiveLogs}    onChange={set("autoArchiveLogs")} />
        </SettingsSection>

        <SettingsSection title="Services" description="Enable or disable external service integrations.">
          <SettingsSwitch label="Email Service" description="Send notifications and reports via email." checked={sys.enableEmailService} onChange={set("enableEmailService")} />
          <SettingsSwitch label="SMS Service"   description="Send SMS alerts to residents."             checked={sys.enableSmsService}   onChange={set("enableSmsService")} />
        </SettingsSection>

        <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
          <Button variant="outlined" color="inherit" sx={{ textTransform: "none" }} onClick={() => setConfirmRestore(true)}>Restore Defaults</Button>
          <Button variant="contained" sx={{ textTransform: "none" }} onClick={handleSave}>Save Settings</Button>
        </Box>
      </Paper>

      <ConfirmationDialog
        open={confirmAudit}
        title="Disable Audit Logging?"
        message="Disabling audit logging means administrative actions will no longer be recorded. This is not recommended."
        confirmLabel="Disable"
        onConfirm={() => { setSys((p) => ({ ...p, enableAuditLogging: false })); setConfirmAudit(false); setToast({ open: true, msg: "Audit logging disabled.", sev: "warning" }); }}
        onCancel={() => setConfirmAudit(false)}
      />

      <ConfirmationDialog
        open={confirmRestore}
        title="Restore Default Settings?"
        message="All system settings will be reset to their factory defaults. This cannot be undone."
        confirmLabel="Restore"
        onConfirm={handleRestore}
        onCancel={() => setConfirmRestore(false)}
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

