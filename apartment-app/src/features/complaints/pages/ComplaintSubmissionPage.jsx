import {
  Alert, Box, Button, Grid, MenuItem, Paper, TextField, Typography,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import { useAuth } from "../../../hooks/useAuth";
import { useComplaints } from "../../../context/ComplaintContext";
import { createComplaint, fetchComplaintCategories } from "../../../services/complaintService";
import { isOffline } from "../../../services/apiClient";
import { COMPLAINT_CATEGORIES } from "../mock/complaints";

// FE-01 - Complaint Submission Screen
// FE-13 - Complaint Category Selector (fixed list, exactly one, required)
export default function ComplaintSubmissionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addComplaint } = useComplaints();

  // Pre-filled from the resident's own flat (Bug 37) - most complaints are
  // about the resident's own home, so asking them to retype what the app
  // already knows was needless friction. Still fully editable for a
  // common-area issue (e.g. "B Block Lift") that isn't about their flat.
  const [form, setForm] = useState({ category: "", description: "", location: "" });
  const [imageName, setImageName] = useState(null);
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(null); // holds the created complaint
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // INT-13: the selector is driven by the API's canonical category list, so a
  // resident can only pick a value the backend will accept and store. The
  // bundled list is the initial value and the offline fallback, which keeps the
  // form usable when the backend is unreachable.
  const [categories, setCategories] = useState(COMPLAINT_CATEGORIES);

  useEffect(() => {
    let cancelled = false;
    fetchComplaintCategories()
      .then((list) => {
        if (!cancelled && list.length) setCategories(list);
      })
      .catch(() => {
        // Offline or a backend error - the bundled list already stands in.
      });
    return () => { cancelled = true; };
  }, []);

  // Pre-fill location from the resident's own flat once it's known, but only
  // while the field is still untouched - never overwrite something the
  // resident already typed (e.g. a common-area location).
  useEffect(() => {
    if (user?.flat && !touched.location) {
      setForm((prev) => (prev.location ? prev : { ...prev, location: user.flat }));
    }
  }, [user?.flat, touched.location]);

  const errors = {
    category: form.category ? "" : "Please select a complaint category",
    description:
      form.description.trim().length >= 10
        ? ""
        : "Description is required (minimum 10 characters)",
    location: form.location.trim() ? "" : "Location is required",
  };
  const isValid = !errors.category && !errors.description && !errors.location;

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleImage = (e) => {
    const file = e.target.files?.[0];
    setImageName(file ? file.name : null);
  };

  // INT-01: the complaint is stored by the API, and the id shown to the
  // resident is the one it returns - not a number invented on the client.
  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ category: true, description: true, location: true });
    if (!isValid) return;
    setSaving(true);
    setSubmitError("");
    try {
      const complaint = await createComplaint({
        ...form,
        imageReference: imageName,
        residentId: user?.residentId,
      });
      // Mirror it into the in-memory list so the other complaint screens that
      // still read from context show it straight away.
      addComplaint({ ...form, image: imageName, user });
      setSubmitted(complaint);
    } catch (err) {
      setSubmitError(
        isOffline(err)
          ? "The server is unreachable, so your complaint was not registered. Please try again."
          : err?.message || "Your complaint could not be registered."
      );
    } finally {
      setSaving(false);
    }
  };

  if (submitted) {
    return (
      <Box>
        <PageHeader
          title="Complaint Submitted"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Complaints", href: "/complaints" }, { label: "New" }]}
        />
        <Paper elevation={1} sx={{ borderRadius: 2, p: 4, textAlign: "center", maxWidth: 520, mx: "auto" }}>
          <CheckCircleOutlinedIcon sx={{ fontSize: 64, color: "success.main", mb: 1 }} />
          <Typography variant="h6" fontWeight={700}>Complaint registered successfully</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Your complaint ID is
          </Typography>
          {/* The reference is the readable one residents quote; the UUID is
              the internal key and is not put in front of them. */}
          <Typography variant="h5" fontWeight={700} color="primary.main" fontFamily="var(--font-mono)" sx={{ my: 1 }}>
            {submitted.reference || submitted.id}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Use this ID to track your complaint. You will be notified as the status changes.
          </Typography>
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center", mt: 3 }}>
            <Button variant="contained" onClick={() => navigate(`/complaints/${submitted.id}`)}>
              Track Complaint
            </Button>
            <Button variant="outlined" onClick={() => { setSubmitted(null); setForm({ category: "", description: "", location: "" }); setImageName(null); setTouched({}); }}>
              Raise Another
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Raise a Complaint"
        subtitle="Report a maintenance issue with category, description, location and an optional photo"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Complaints", href: "/complaints" }, { label: "New" }]}
      />
      <Paper elevation={1} component="form" onSubmit={handleSubmit} noValidate sx={{ borderRadius: 2, p: 3, maxWidth: 640 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <TextField
              select
              fullWidth
              required
              label="Category"
              value={form.category}
              onChange={handleChange("category")}
              error={touched.category && !!errors.category}
              helperText={
                touched.category && errors.category
                  ? errors.category
                  : form.category === "Other"
                    // Nothing about "Other" tells an admin which trade to send,
                    // so the description is the only thing that can - say so
                    // here rather than letting the complaint sit unassignable.
                    ? "Please describe the issue clearly below so it can be routed to the right staff"
                    : "Select the category that best matches your issue - pick Other if none fit"
              }
            >
              {categories.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              required
              multiline
              minRows={4}
              label="Description"
              placeholder="Describe the issue in detail..."
              value={form.description}
              onChange={handleChange("description")}
              error={touched.description && !!errors.description}
              helperText={touched.description ? errors.description : ""}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              required
              label="Location"
              placeholder="e.g. B Block - Flat 204 - Kitchen"
              value={form.location}
              onChange={handleChange("location")}
              error={touched.location && !!errors.location}
              helperText={touched.location ? errors.location : ""}
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Button component="label" variant="outlined" startIcon={<PhotoCameraOutlinedIcon />}>
              {imageName ? "Change Photo" : "Upload Photo (optional)"}
              <input type="file" accept="image/*" hidden onChange={handleImage} />
            </Button>
            {imageName && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1.5 }}>
                {imageName}
              </Typography>
            )}
          </Grid>
          <Grid size={{ xs: 12 }}>
            {!isValid && Object.keys(touched).length > 0 && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Please fill all required fields before submitting.
              </Alert>
            )}
            {submitError && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSubmitError("")}>
                {submitError}
              </Alert>
            )}
            <Box sx={{ display: "flex", gap: 2 }}>
              <Button type="submit" variant="contained" disabled={!isValid || saving} sx={{ fontWeight: 600 }}>
                {saving ? "Submitting…" : "Submit Complaint"}
              </Button>
              <Button variant="text" onClick={() => navigate("/complaints")}>Cancel</Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
}

