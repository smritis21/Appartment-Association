// FE-19: Emergency Alert Broadcast - President only.
//
// Wired to POST /alerts/emergency (BE-19). The confirmation screen reports
// the real per-recipient delivery outcome the backend returns - how many
// residents were reached, and exactly who was missed - rather than an
// optimistic "sent!". Anyone the alert did not reach is listed by name and
// flat so someone can knock on those doors.
//
// If the backend is unreachable the broadcast is reported as unconfirmed
// instead of claiming delivery counts we have no basis for.
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, List, ListItem, ListItemText,
  Paper, Snackbar, TextField, Typography,
} from "@mui/material";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import RadioOutlinedIcon from "@mui/icons-material/RadioOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import { useEmergencyBroadcast } from "../../../hooks/useEmergencyBroadcast";

// `value` maps to a block letter in alertService.TARGET_BLOCKS; "all" omits
// the filter entirely. Counts are intentionally not shown per option any
// more - the real recipient count comes back from the broadcast, and a
// hardcoded "88 residents" would go stale the moment someone moves out.
const TARGETS = [
  { value: "all",     label: "All Residents", desc: "Every active resident" },
  { value: "tower_a", label: "Tower A Only",  desc: "Block A residents" },
  { value: "tower_b", label: "Tower B Only",  desc: "Block B residents" },
  { value: "tower_c", label: "Tower C Only",  desc: "Block C residents" },
];

const MIN_MESSAGE_LENGTH = 10;   // mirrors the API's validation floor

export default function EmergencyAlertPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: "", message: "", target: "all" });
  const [errors, setErrors] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  const { send, reset, result, sending, offline, error } = useEmergencyBroadcast();

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Alert title is required";
    if (!form.message.trim()) e.message = "Alert message is required";
    else if (form.message.trim().length < MIN_MESSAGE_LENGTH) {
      e.message = `Message must be at least ${MIN_MESSAGE_LENGTH} characters`;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSend = () => { if (validate()) setConfirmOpen(true); };

  const handleConfirmSend = async () => {
    setConfirmOpen(false);
    const broadcast = await send({
      title: form.title.trim(),
      message: form.message.trim(),
      target: form.target,
    });
    if (!broadcast) {
      // The backend refused it - the error banner explains why, and the
      // compose form stays filled in so the President can correct and resend.
      setToast({ open: true, message: "Alert was not sent", severity: "error" });
    }
  };

  const startNewAlert = () => {
    setForm({ title: "", message: "", target: "all" });
    setErrors({});
    reset();
  };

  const targetLabel = TARGETS.find((t) => t.value === form.target)?.label ?? "All Residents";
  const targetDesc  = TARGETS.find((t) => t.value === form.target)?.desc ?? "";

  // ── Sent confirmation ──────────────────────────────────────────────────────
  if (result) {
    const failed = result.deliveries.filter((d) => d.status === "failed");

    return (
      <Box sx={{ maxWidth: 560, mx: "auto", py: 4 }}>
        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textAlign: "center" }}>
          <Box sx={{ position: "relative", width: 72, height: 72, mb: 1 }}>
            <Box sx={{ width: 72, height: 72, borderRadius: 4, bgcolor: "error.light", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 40, color: "error.main" }} />
            </Box>
            <Box sx={{ position: "absolute", top: -4, right: -4, width: 20, height: 20, borderRadius: "50%", bgcolor: "error.main", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RadioOutlinedIcon sx={{ fontSize: 12, color: "white" }} />
            </Box>
          </Box>

          <Typography variant="h5" fontWeight={700}>
            {offline ? "Alert Composed" : "Emergency Alert Sent"}
          </Typography>

          {offline ? (
            <Alert severity="warning" icon={<CloudOffOutlinedIcon />} sx={{ width: "100%", textAlign: "left" }}>
              The server could not be reached, so <strong>"{result.title}"</strong> was
              not delivered and no residents were notified. Reconnect and send it again.
            </Alert>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                <strong>"{result.title}"</strong> was broadcast to{" "}
                <strong>{result.recipientCount}</strong>{" "}
                {result.recipientCount === 1 ? "resident" : "residents"}
                {result.targetBlock ? ` in Block ${result.targetBlock}` : " across the society"}.
              </Typography>

              <Box sx={{ display: "flex", gap: 1.5, mt: 0.5 }}>
                <Chip
                  label={`${result.sentCount} delivered`}
                  color="success"
                  variant="outlined"
                  size="small"
                />
                <Chip
                  label={`${result.failedCount} not reached`}
                  color={result.failedCount > 0 ? "error" : "default"}
                  variant="outlined"
                  size="small"
                />
              </Box>
            </>
          )}
        </Box>

        {/* Who was missed - the list someone has to follow up in person */}
        {failed.length > 0 && (
          <Paper variant="outlined" sx={{ borderRadius: 2, mt: 3, borderColor: "error.light" }}>
            <Box sx={{ px: 2.5, py: 1.5, bgcolor: "error.light" }}>
              <Typography variant="subtitle2" fontWeight={700} color="error.main">
                Not reached - follow up in person
              </Typography>
              <Typography variant="caption" color="text.secondary">
                These residents did not receive the alert
              </Typography>
            </Box>
            <Divider />
            <List dense disablePadding>
              {failed.map((d) => (
                <ListItem key={d.id} divider>
                  <ListItemText
                    primary={`${d.name} · ${d.flat}`}
                    secondary={d.failureReason}
                    slotProps={{ primary: { fontWeight: 600, variant: "body2" } }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        )}

        <Box sx={{ display: "flex", gap: 2, mt: 3, justifyContent: "center" }}>
          <Button variant="outlined" onClick={() => navigate("/communication")}>
            Back to Communication
          </Button>
          <Button
            variant="contained" color="error"
            startIcon={<ReportProblemOutlinedIcon />}
            onClick={startNewAlert}
          >
            New Alert
          </Button>
        </Box>
      </Box>
    );
  }

  // ── Compose ────────────────────────────────────────────────────────────────
  return (
    <Box>
      <PageHeader
        title="Emergency Alert Broadcast"
        subtitle="FE-19 · Instantly notify all selected residents of a critical situation"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Communication", href: "/communication" },
          { label: "Emergency Alert" },
        ]}
      />

      {/* Warning banner */}
      <Alert
        severity="error"
        icon={<ReportProblemOutlinedIcon />}
        sx={{ mb: 3, borderRadius: 2, fontWeight: 500 }}
      >
        <Typography variant="body2" fontWeight={700} gutterBottom>Use only for genuine emergencies</Typography>
        <Typography variant="body2">
          Fire, flood, security breach, or public health crises. Misuse may cause resident panic.
        </Typography>
      </Alert>

      {/* Server rejected the broadcast - say so plainly, keep the draft */}
      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          <Typography variant="body2" fontWeight={700} gutterBottom>Alert was not sent</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      )}

      <Box sx={{ maxWidth: 580 }}>
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ px: 3, py: 2, bgcolor: "error.light", borderBottom: "1px solid", borderColor: "error.light", display: "flex", alignItems: "center", gap: 1.5 }}>
            <ReportProblemOutlinedIcon color="error" />
            <Typography variant="subtitle1" fontWeight={700} color="error.main">Compose Emergency Alert</Typography>
          </Box>

          <Box sx={{ px: 3, py: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
            {/* Alert title */}
            <Box>
              <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                Alert Title <span style={{ color: "red" }}>*</span>
              </Typography>
              <TextField
                fullWidth size="small"
                placeholder="e.g. Fire Drill - Evacuate Now"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                error={!!errors.title}
                helperText={errors.title}
                disabled={sending}
                slotProps={{ htmlInput: { maxLength: 120, style: { fontWeight: 600 } } }}
              />
            </Box>

            {/* Message */}
            <Box>
              <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                Alert Message <span style={{ color: "red" }}>*</span>
              </Typography>
              <TextField
                fullWidth multiline rows={4}
                placeholder="Describe the situation clearly. Include instructions for residents."
                value={form.message}
                onChange={(e) => set("message", e.target.value)}
                error={!!errors.message}
                helperText={errors.message}
                disabled={sending}
                slotProps={{ htmlInput: { maxLength: 2000 } }}
              />
            </Box>

            {/* Target */}
            <Box>
              <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                Send To
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
                {TARGETS.map((t) => (
                  <Box
                    key={t.value}
                    component="button"
                    type="button"
                    disabled={sending}
                    onClick={() => set("target", t.value)}
                    sx={{
                      p: 1.5, borderRadius: 2, border: "1px solid", textAlign: "left", cursor: "pointer",
                      borderColor: form.target === t.value ? "error.main" : "divider",
                      bgcolor: form.target === t.value ? "error.light" : "background.paper",
                      "&:hover": { borderColor: "error.main" },
                      "&:disabled": { cursor: "not-allowed", opacity: 0.6 },
                      transition: "all 0.15s",
                    }}
                  >
                    <Typography variant="body2" fontWeight={700} color={form.target === t.value ? "error.main" : "text.primary"}>
                      {t.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{t.desc}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Send button */}
            <Button
              fullWidth
              variant="contained"
              color="error"
              size="large"
              disabled={sending}
              startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <SendOutlinedIcon />}
              onClick={handleSend}
              sx={{ py: 1.5, fontWeight: 700 }}
            >
              {sending ? "Broadcasting…" : "Send Alert Now"}
            </Button>
          </Box>
        </Paper>
      </Box>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "error.light", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ReportProblemOutlinedIcon color="error" />
          </Box>
          Confirm Emergency Broadcast
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            This will immediately notify <strong>{targetLabel}</strong> ({targetDesc}). This action cannot be undone.
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mt: 1.5, borderColor: "error.light", bgcolor: "error.light" }}>
            <Typography variant="body2" fontWeight={700} color="error.main" gutterBottom>{form.title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {form.message}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="contained" color="error"
            startIcon={<SendOutlinedIcon />}
            onClick={handleConfirmSend}
          >
            Confirm &amp; Send
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

