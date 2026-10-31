import { useState } from "react";
import {
  Box, Paper, Button, Snackbar, Alert, Typography, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Chip, Divider,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import PageHeader from "../../../components/common/PageHeader";
import SettingsSection from "../components/SettingsSection";
import { SettingsTextField, SettingsSwitch } from "../components/SettingsFields";
import { mockActiveSessions, mockLoginHistory, mockTrustedDevices } from "../mock/settings";
import { formatDateTime } from "../../../utils/formatDate";

export default function SecuritySettingsPage() {
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [twoFA, setTwoFA] = useState(false);
  const [toast, setToast] = useState({ open: false, msg: "", sev: "success" });
  const [sessions, setSessions] = useState(mockActiveSessions);

  const handleUpdatePassword = () => {
    if (!pw.current || !pw.next || !pw.confirm) {
      return setToast({ open: true, msg: "Please fill in all password fields.", sev: "error" });
    }
    if (pw.next !== pw.confirm) {
      return setToast({ open: true, msg: "New passwords do not match.", sev: "error" });
    }
    if (pw.next.length < 8) {
      return setToast({ open: true, msg: "Password must be at least 8 characters.", sev: "error" });
    }
    setPw({ current: "", next: "", confirm: "" });
    setToast({ open: true, msg: "Password updated successfully.", sev: "success" });
  };

  const revokeSession = (id) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
    setToast({ open: true, msg: "Session revoked.", sev: "info" });
  };

  return (
    <Box>
      <PageHeader
        title="Security Settings"
        subtitle="Manage your password, sessions, and account security."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings", href: "/settings" }, { label: "Security" }]}
      />

      {/* Change Password */}
      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, mb: 3 }}>
        <SettingsSection title="Change Password" description="Use a strong password of at least 8 characters.">
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, maxWidth: 420 }}>
            <SettingsTextField label="Current Password"  value={pw.current}  onChange={(v) => setPw((p) => ({ ...p, current: v }))}  type="password" />
            <SettingsTextField label="New Password"      value={pw.next}     onChange={(v) => setPw((p) => ({ ...p, next: v }))}     type="password" />
            <SettingsTextField label="Confirm Password"  value={pw.confirm}  onChange={(v) => setPw((p) => ({ ...p, confirm: v }))}  type="password" />
          </Box>
          <Box sx={{ mt: 2 }}>
            <Button variant="contained" sx={{ textTransform: "none" }} onClick={handleUpdatePassword}>
              Update Password
            </Button>
          </Box>
        </SettingsSection>

        <Divider sx={{ my: 3 }} />

        <SettingsSection title="Two-Factor Authentication" description="Add an extra layer of security to your account.">
          <SettingsSwitch
            label="Enable Two-Factor Authentication"
            description="Require a verification code on each login."
            checked={twoFA}
            onChange={(v) => { setTwoFA(v); setToast({ open: true, msg: v ? "2FA enabled." : "2FA disabled.", sev: v ? "success" : "warning" }); }}
          />
        </SettingsSection>
      </Paper>

      {/* Active Sessions */}
      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, mb: 3 }}>
        <SettingsSection title="Active Sessions" description="Devices currently logged into your account.">
          {sessions.map((s) => (
            <Box key={s.id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Typography variant="body2" fontWeight={600}>{s.device} · {s.browser}</Typography>
                  {s.current && <Chip label="Current" size="small" color="success" />}
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {s.ip} · {s.location} · Last active: {formatDateTime(s.lastActive)}
                </Typography>
              </Box>
              {!s.current && (
                <Button size="small" color="error" sx={{ textTransform: "none" }} onClick={() => revokeSession(s.id)}>
                  Revoke
                </Button>
              )}
            </Box>
          ))}
        </SettingsSection>
      </Paper>

      {/* Trusted Devices */}
      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, mb: 3 }}>
        <SettingsSection title="Trusted Devices" description="Devices you have marked as trusted.">
          {mockTrustedDevices.map((d) => (
            <Box key={d.id} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
              <CheckCircleOutlinedIcon sx={{ color: "success.main", fontSize: 18 }} />
              <Box>
                <Typography variant="body2" fontWeight={500}>{d.device} · {d.browser}</Typography>
                <Typography variant="caption" color="text.secondary">Added on {d.addedOn}</Typography>
              </Box>
            </Box>
          ))}
        </SettingsSection>
      </Paper>

      {/* Login History */}
      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, mb: 3 }}>
        <SettingsSection title="Login History" description="Recent login activity on your account.">
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: "background.default" }}>
                  {["Action", "Device", "Browser", "IP Address", "Time", "Status"].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12 }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {mockLoginHistory.map((l) => (
                  <TableRow key={l.id} hover>
                    <TableCell sx={{ fontSize: 12 }}>{l.action}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{l.device}</TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{l.browser}</TableCell>
                    <TableCell sx={{ fontSize: 12, fontFamily: "monospace" }}>{l.ip}</TableCell>
                    <TableCell sx={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatDateTime(l.timestamp)}</TableCell>
                    <TableCell>
                      <Chip label={l.status} size="small" color={l.status === "Success" ? "success" : "error"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </SettingsSection>
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
