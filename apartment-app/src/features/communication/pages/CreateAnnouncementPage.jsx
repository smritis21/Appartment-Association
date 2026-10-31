// FE-08: Announcement Creation - President only
import {
  Alert, Box, Button, Card, CardContent, Chip,
  Divider, MenuItem, Paper, Select, Snackbar,
  Step, StepLabel, Stepper, TextField, Typography,
} from "@mui/material";
import CreateOutlinedIcon from "@mui/icons-material/CreateOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import PushPinOutlinedIcon from "@mui/icons-material/PushPinOutlined";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import { createAnnouncement } from "../../../services/announcementService";
import { isOffline } from "../../../services/apiClient";
import { useAuthContext } from "../../../context/AuthContext";

const CATEGORIES = ["Maintenance", "Event", "Safety", "Finance", "General", "Emergency"];
const TARGETS = [
  { value: "all",     label: "All Residents" },
  { value: "owners",  label: "Owners Only" },
  { value: "tenants", label: "Tenants Only" },
  { value: "tower_a", label: "Tower A" },
  { value: "tower_b", label: "Tower B" },
  { value: "tower_c", label: "Tower C" },
];

const STEPS = ["Compose", "Preview", "Published"];

const CATEGORY_COLOR = {
  Maintenance: "default", Event: "primary", Safety: "warning",
  Finance: "success", General: "default", Emergency: "error",
};

const INITIAL_FORM = {
  title: "", body: "", category: "", target: "all",
  scheduleDate: "", scheduleTime: "", pinned: false,
};

export default function CreateAnnouncementPage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const [step, setStep] = useState(0); // 0=compose, 1=preview, 2=published
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");

  const set = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    // Drop the field's error as soon as it is edited. Without this the
    // messages sat under fields that had already been filled in, because
    // validation only ran again when Preview was pressed.
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Title is required";
    if (!form.body.trim()) e.body = "Message body is required";
    if (!form.category) e.category = "Please select a category";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handlePreview = () => { if (validate()) setStep(1); };

  /**
   * The chosen date and time as an ISO timestamp, or null to send at once.
   * A date with no time is treated as the start of that day.
   */
  const scheduledFor = () => {
    if (!form.scheduleDate) return null;
    const stamp = new Date(`${form.scheduleDate}T${form.scheduleTime || "00:00"}`);
    return Number.isNaN(stamp.getTime()) ? null : stamp.toISOString();
  };

  const payload = (status) => ({
    title: form.title.trim(),
    body: form.body.trim(),
    category: form.category,
    pinned: form.pinned,
    author: user?.name || "Association",
    // The API models reach as a single `visibility` string and has no separate
    // audience field, so the chosen target is carried there.
    visibility: form.target === "all" ? "public" : form.target,
    status,
    scheduledFor: scheduledFor(),
  });

  const describeFailure = (err, action) =>
    isOffline(err)
      ? `The server is unreachable, so the announcement was not ${action}. Check your connection and try again.`
      : err?.message || `The announcement could not be ${action}.`;

  // INT-08: publishing writes through the API. The announcement only reaches
  // step 3 once the server has confirmed it, so a failure leaves the composed
  // text on screen to retry rather than claiming a publish that never happened.
  const handlePublish = async () => {
    setPublishing(true);
    setPublishError("");
    try {
      await createAnnouncement(payload("published"));
      setStep(2);
    } catch (err) {
      setPublishError(describeFailure(err, "published"));
    } finally {
      setPublishing(false);
    }
  };

  // A draft is stored server-side but held back from the resident list, so it
  // can be finished later rather than living only in this browser tab.
  const handleSaveDraft = async () => {
    if (!validate()) return;
    setPublishing(true);
    try {
      await createAnnouncement(payload("draft"));
      setToast({ open: true, message: "Announcement saved as draft.", severity: "success" });
      navigate("/communication");
    } catch (err) {
      setToast({ open: true, message: describeFailure(err, "saved"), severity: "error" });
    } finally {
      setPublishing(false);
    }
  };

  // ── Published state ─────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 2, textAlign: "center" }}>
        <Box sx={{ width: 72, height: 72, borderRadius: 4, bgcolor: "primary.light", display: "flex", alignItems: "center", justifyContent: "center", mb: 1 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 40, color: "success.main" }} />
        </Box>
        <Typography variant="h5" fontWeight={700}>Announcement Published!</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
          <strong>"{form.title}"</strong> has been sent to{" "}
          {TARGETS.find((t) => t.value === form.target)?.label ?? "All Residents"}.
        </Typography>
        <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
          <Button variant="outlined" onClick={() => navigate("/communication")}>
            Back to Communication
          </Button>
          <Button
            variant="contained"
            startIcon={<CampaignOutlinedIcon />}
            onClick={() => { setForm(INITIAL_FORM); setStep(0); }}
          >
            New Announcement
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={step === 1 ? "Preview Announcement" : "Create Announcement"}
        subtitle={step === 1 ? "Review before publishing" : "FE-08 · Compose and schedule a notice for residents"}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Communication", href: "/communication" },
          { label: step === 1 ? "Preview" : "Create Announcement" },
        ]}
      />

      {/* Stepper */}
      <Stepper activeStep={step} sx={{ mb: 4, maxWidth: 480 }}>
        {STEPS.slice(0, 2).map((label) => (
          <Step key={label}><StepLabel>{label}</StepLabel></Step>
        ))}
      </Stepper>

      <Box sx={{ maxWidth: 680 }}>
        {/* ── Compose form ──────────────────────────────── */}
        {step === 0 && (
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
            <Box sx={{ px: 3, py: 2, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
              <CreateOutlinedIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={700}>Compose Announcement</Typography>
            </Box>
            <Box sx={{ px: 3, py: 3, display: "flex", flexDirection: "column", gap: 2.5 }}>
              {/* Title */}
              <Box>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                  Title <span style={{ color: "red" }}>*</span>
                </Typography>
                <TextField
                  fullWidth size="small"
                  placeholder="e.g. Water Supply Maintenance on 20 May"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  error={!!errors.title}
                  helperText={errors.title}
                />
              </Box>

              {/* Category + Target */}
              <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                <Box>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                    Category <span style={{ color: "red" }}>*</span>
                  </Typography>
                  <Select
                    fullWidth size="small"
                    value={form.category}
                    onChange={(e) => set("category", e.target.value)}
                    displayEmpty
                    error={!!errors.category}
                    renderValue={(v) => v || <span style={{ color: "#98a0ac" }}>Select category</span>}
                  >
                    {CATEGORIES.map((c) => (
                      <MenuItem key={c} value={c}>{c}</MenuItem>
                    ))}
                  </Select>
                  {errors.category && <Typography variant="caption" color="error">{errors.category}</Typography>}
                </Box>
                <Box>
                  <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                    Target Audience
                  </Typography>
                  <Select
                    fullWidth size="small"
                    value={form.target}
                    onChange={(e) => set("target", e.target.value)}
                  >
                    {TARGETS.map((t) => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </Select>
                </Box>
              </Box>

              {/* Body */}
              <Box>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                  Message <span style={{ color: "red" }}>*</span>
                </Typography>
                <TextField
                  fullWidth multiline rows={5}
                  placeholder="Write your announcement here…"
                  value={form.body}
                  onChange={(e) => set("body", e.target.value)}
                  error={!!errors.body}
                  helperText={errors.body ? errors.body : `${form.body.length} characters`}
                />
              </Box>

              {/* Schedule */}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
                  <ScheduleOutlinedIcon fontSize="small" color="action" />
                  <Typography variant="caption" fontWeight={700}>Schedule (optional)</Typography>
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
                  <TextField
                    size="small" type="date" label="Date"
                    value={form.scheduleDate}
                    onChange={(e) => set("scheduleDate", e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                  <TextField
                    size="small" type="time" label="Time"
                    value={form.scheduleTime}
                    onChange={(e) => set("scheduleTime", e.target.value)}
                    slotProps={{ inputLabel: { shrink: true } }}
                  />
                </Box>
                {form.scheduleDate && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    Will publish on {form.scheduleDate}{form.scheduleTime ? ` at ${form.scheduleTime}` : ""}
                  </Typography>
                )}
              </Paper>

              {/* Pin toggle */}
              <Box
                component="button"
                onClick={() => set("pinned", !form.pinned)}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.5, p: 1.5, borderRadius: 2,
                  border: "1px solid", borderColor: form.pinned ? "secondary.main" : "divider",
                  bgcolor: form.pinned ? "secondary.light" : "background.paper",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <PushPinOutlinedIcon sx={{ color: form.pinned ? "secondary.main" : "text.secondary" }} />
                <Box>
                  <Typography variant="body2" fontWeight={600} color={form.pinned ? "secondary.main" : "text.primary"}>
                    {form.pinned ? "Pinned" : "Pin to top"}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Pinned announcements appear at the top of the list
                  </Typography>
                </Box>
              </Box>

              {/* Actions */}
              <Divider />
              <Box sx={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 1.5 }}>
                <Button
                  variant="outlined"
                  startIcon={<SaveOutlinedIcon />}
                  onClick={handleSaveDraft}
                  disabled={publishing}
                >
                  Save Draft
                </Button>
                <Button variant="contained" startIcon={<VisibilityOutlinedIcon />} onClick={handlePreview}>
                  Preview
                </Button>
              </Box>
            </Box>
          </Paper>
        )}

        {/* ── Preview ───────────────────────────────────── */}
        {step === 1 && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              This is how residents will see the announcement.
            </Alert>

            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
              <Box sx={{ px: 3, py: 2, bgcolor: "background.paper", borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center", gap: 1.5 }}>
                <CampaignOutlinedIcon color="primary" />
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: 12 }}>
                  Preview - how residents will see this
                </Typography>
              </Box>
              <Box sx={{ px: 3, py: 3 }}>
                <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
                  {form.category && (
                    <Chip label={form.category} size="small" color={CATEGORY_COLOR[form.category] ?? "default"} />
                  )}
                  {form.scheduleDate && (
                    <Chip label="Scheduled" size="small" icon={<ScheduleOutlinedIcon />} variant="outlined" />
                  )}
                  {form.pinned && (
                    <Chip label="Pinned" size="small" icon={<PushPinOutlinedIcon />} color="secondary" />
                  )}
                </Box>
                <Typography variant="h6" fontWeight={700} gutterBottom>{form.title}</Typography>
                <Typography variant="body1" sx={{ lineHeight: 1.8, color: "text.primary", mb: 2 }}>{form.body}</Typography>
                <Divider sx={{ mb: 1.5 }} />
                <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                  <Typography variant="caption" color="text.secondary">By {user?.name || "Association"}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {TARGETS.find((t) => t.value === form.target)?.label} ·{" "}
                    {form.scheduleDate || new Date().toLocaleDateString("en-IN")}
                  </Typography>
                </Box>
              </Box>
            </Paper>

            {publishError && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>{publishError}</Alert>
            )}

            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.5 }}>
              <Button variant="outlined" onClick={() => setStep(0)} disabled={publishing}>
                Back to Edit
              </Button>
              <Button
                variant="contained"
                startIcon={<SendOutlinedIcon />}
                onClick={handlePublish}
                disabled={publishing}
                color={form.scheduleDate ? "secondary" : "primary"}
              >
                {publishing ? "Publishing…" : form.scheduleDate ? "Schedule" : "Publish Now"}
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
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

