import { useEffect, useState } from "react";
import { Box, Paper, Button, Snackbar, Alert } from "@mui/material";
import PageHeader from "../../../components/common/PageHeader";
import SettingsSection from "../components/SettingsSection";
import { SettingsSwitch } from "../components/SettingsFields";
import ConfirmationDialog from "../../../components/common/ConfirmationDialog";
import { defaultNotifications } from "../mock/settings";
import { fetchPreferences, updatePreferences } from "../../../services/settingsService";
import { isOffline } from "../../../services/apiClient";

export default function NotificationSettingsPage() {
  const [notifs, setNotifs] = useState({ ...defaultNotifications });
  const [toast, setToast] = useState({ open: false, msg: "", sev: "success" });
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPreferences()
      .then((prefs) => {
        setNotifs((p) => ({
          ...p,
          emailNotifications: prefs.emailNotifications,
          smsNotifications: prefs.smsNotifications,
        }));
      })
      .catch(() => {});
  }, []);

  const set = (key) => (val) => setNotifs((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only email/SMS delivery channels are backed by the API - the rest
      // (per-category toggles, push, summaries) are local-only for now,
      // since the backend model doesn't have fields for them yet.
      await updatePreferences({
        emailNotifications: notifs.emailNotifications,
        smsNotifications: notifs.smsNotifications,
      });
      setToast({ open: true, msg: "Notification preferences saved.", sev: "success" });
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

  const handleDisableAll = () => {
    setNotifs(Object.fromEntries(Object.keys(defaultNotifications).map((k) => [k, false])));
    setConfirmDisable(false);
    setToast({ open: true, msg: "All notifications disabled.", sev: "warning" });
  };

  return (
    <Box>
      <PageHeader
        title="Notification Settings"
        subtitle="Control which notifications you receive and how."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings", href: "/settings" }, { label: "Notifications" }]}
      />

      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, mb: 3 }}>
        <SettingsSection title="Activity Notifications" description="Alerts for key events in the system.">
          <SettingsSwitch label="Payment Reminders"          description="Get notified about upcoming and overdue bills."  checked={notifs.paymentReminders}         onChange={set("paymentReminders")} />
          <SettingsSwitch label="Complaint Updates"          description="Updates when your complaints change status."      checked={notifs.complaintUpdates}         onChange={set("complaintUpdates")} />
          <SettingsSwitch label="Visitor Alerts"             description="Notify when a visitor is registered at the gate." checked={notifs.visitorAlerts}            onChange={set("visitorAlerts")} />
          <SettingsSwitch label="Announcements"              description="Society-wide announcements from management."      checked={notifs.announcements}            onChange={set("announcements")} />
          <SettingsSwitch label="Maintenance Notifications"  description="Scheduled maintenance and service updates."       checked={notifs.maintenanceNotifications} onChange={set("maintenanceNotifications")} />
          <SettingsSwitch label="Community Posts"            description="Posts and updates from the community board."      checked={notifs.communityPosts}           onChange={set("communityPosts")} />
        </SettingsSection>

        <SettingsSection title="Delivery Channels" description="Choose how you receive notifications.">
          <SettingsSwitch label="Email Notifications" description="Receive notifications via email."         checked={notifs.emailNotifications} onChange={set("emailNotifications")} />
          <SettingsSwitch label="SMS Notifications"   description="Receive notifications via SMS."           checked={notifs.smsNotifications}   onChange={set("smsNotifications")} />
          <SettingsSwitch label="Push Notifications"  description="In-app push notifications."               checked={notifs.pushNotifications}  onChange={set("pushNotifications")} />
        </SettingsSection>

        <SettingsSection title="Summary Reports" description="Periodic digest of activity.">
          <SettingsSwitch label="Weekly Summary"  description="Receive a weekly activity summary every Monday."  checked={notifs.weeklySummary}  onChange={set("weeklySummary")} />
          <SettingsSwitch label="Monthly Summary" description="Receive a monthly report on the 1st of each month." checked={notifs.monthlySummary} onChange={set("monthlySummary")} />
        </SettingsSection>

        <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
          <Button variant="outlined" color="error" sx={{ textTransform: "none" }} onClick={() => setConfirmDisable(true)}>
            Disable All
          </Button>
          <Button variant="contained" sx={{ textTransform: "none" }} disabled={saving} onClick={handleSave}>Save Preferences</Button>
        </Box>
      </Paper>

      <ConfirmationDialog
        open={confirmDisable}
        title="Disable All Notifications?"
        message="You will stop receiving all notifications. You can re-enable them at any time."
        confirmLabel="Disable All"
        onConfirm={handleDisableAll}
        onCancel={() => setConfirmDisable(false)}
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

