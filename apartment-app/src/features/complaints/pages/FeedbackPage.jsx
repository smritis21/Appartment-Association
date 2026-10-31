import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Grid, Paper,
  Rating, TextField, Tooltip, Typography,
} from "@mui/material";
import CelebrationOutlinedIcon from "@mui/icons-material/CelebrationOutlined";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import LockClockOutlinedIcon from "@mui/icons-material/LockClockOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import EmptyState from "../../../components/common/EmptyState";
import { useAuth } from "../../../hooks/useAuth";
import { useComplaints } from "../../../context/ComplaintContext";
import { fetchResidentComplaints } from "../../../services/complaintService";
import { useComplaintFeedback } from "../../../hooks/useComplaintFeedback";
import { COMPLAINT_STATUS } from "../mock/complaints";
import { FEEDBACK_WINDOW_DAYS, feedbackWindow } from "../../../services/feedbackService";
import { formatDate } from "../../../utils/formatDate";
import ComplaintStatusChip from "../components/ComplaintStatusChip";

// FE-20 - Feedback & Rating Screen, wired to POST /complaints/{id}/feedback
// (BE-20). Star rating + comment on resolved complaints; submit stays
// disabled until a rating is chosen; a thank-you state confirms submission.
//
// The backend only accepts feedback within FEEDBACK_WINDOW_DAYS of the
// resolution date. Rather than hiding expired complaints - which would look
// like they had silently vanished - they stay in the list, greyed out, with
// the date the window closed. Complaints still open show how long is left.
// The client-side check is a courtesy; the backend is the authority and
// returns 410 regardless.
export default function FeedbackPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { user } = useAuth();
  const { complaints: mockComplaints } = useComplaints();
  const { submit, submitting, offline, error, clearError } = useComplaintFeedback();

  // INT-20: the complaints offered for rating are the resident's real ones.
  // They were coming from the in-memory list, whose ids the API does not know,
  // so a rating would have been posted against a complaint that did not exist.
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const rows = await fetchResidentComplaints(user?.residentId);
        if (active) setComplaints(rows);
      } catch {
        // Unreachable or unauthorised: fall back so the screen still shows.
        if (active) setComplaints(mockComplaints);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.residentId, mockComplaints]);


  // Resolved/closed complaints this user could rate, each with its window
  // state attached. Already-rated complaints drop out entirely.
  const rateable = useMemo(
    () =>
      complaints
        .filter((c) => {
          if (![COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED].includes(c.status)) return false;
          if (c.feedback) return false;
          return true;
        })
        .map((c) => ({ ...c, window: feedbackWindow(c) }))
        // Complaints still inside the window first - those are actionable.
        .sort((a, b) => Number(b.window.open) - Number(a.window.open)),
    [complaints]
  );

  const [selectedId, setSelectedId] = useState(state?.complaintId ?? null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [thanks, setThanks] = useState(false);

  const selected = rateable.find((c) => c.id === selectedId) ?? null;
  const windowOpen = selected?.window.open ?? false;

  const handleSubmit = async () => {
    if (!selected || rating === 0) return;
    const saved = await submit(selected.id, { rating, comment });
    if (saved) setThanks(true);
  };

  const reset = () => {
    setThanks(false);
    setSelectedId(null);
    setRating(0);
    setComment("");
    clearError();
  };

  const selectComplaint = (id) => {
    setSelectedId(id);
    setRating(0);
    setComment("");
    clearError();
  };

  // ── Thank-you state ────────────────────────────────────────────────────────
  if (thanks) {
    return (
      <Box>
        <PageHeader
          title="Feedback"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Complaints", href: "/complaints" }, { label: "Feedback" }]}
        />
        <Paper elevation={1} sx={{ borderRadius: 2, p: 4, textAlign: "center", maxWidth: 520, mx: "auto" }}>
          <CelebrationOutlinedIcon sx={{ fontSize: 64, color: "success.main", mb: 1 }} />
          <Typography variant="h6" fontWeight={700}>Thank you for your feedback!</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Your rating helps us improve maintenance quality for everyone.
          </Typography>
          {offline && (
            <Alert severity="warning" icon={<CloudOffOutlinedIcon />} sx={{ mt: 2, textAlign: "left" }}>
              Saved on this device only - the server could not be reached, so
              your rating has not reached the association yet.
            </Alert>
          )}
          <Box sx={{ display: "flex", gap: 2, justifyContent: "center", mt: 3 }}>
            <Button variant="contained" onClick={() => navigate("/complaints")}>My Complaints</Button>
            {rateable.length > 1 && (
              <Button variant="outlined" onClick={reset}>Rate Another</Button>
            )}
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Feedback & Rating"
        subtitle={`Rate your resolved complaints within ${FEEDBACK_WINDOW_DAYS} days of resolution`}
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Complaints", href: "/complaints" }, { label: "Feedback" }]}
      />

      {/* The server refused it - say which rule was hit, keep the draft. */}
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={clearError}>
          <Typography variant="body2" fontWeight={700} gutterBottom>Feedback was not saved</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      )}

      {loading ? (
        <Paper elevation={1} sx={{ borderRadius: 2, p: 6, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">Loading your complaints…</Typography>
        </Paper>
      ) : rateable.length === 0 ? (
        <Paper elevation={1} sx={{ borderRadius: 2 }}>
          <EmptyState
            icon={RateReviewOutlinedIcon}
            title="Nothing to rate right now"
            description="Once a complaint is resolved, you can rate the resolution here."
            action={() => navigate("/complaints")}
            actionLabel="View Complaints"
          />
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {/* Resolved complaint picker */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper elevation={1} sx={{ borderRadius: 2, p: 2 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ px: 1, py: 0.5 }}>
                Resolved Complaints
              </Typography>
              <Divider sx={{ mb: 1 }} />
              {rateable.map((c) => (
                <Box
                  key={c.id}
                  onClick={() => selectComplaint(c.id)}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    cursor: "pointer",
                    mb: 0.5,
                    opacity: c.window.open ? 1 : 0.55,
                    border: "1px solid",
                    borderColor: selectedId === c.id ? "primary.main" : "transparent",
                    bgcolor: selectedId === c.id ? "primary.light" : "transparent",
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Typography variant="body2" fontWeight={700} fontFamily="var(--font-mono)">
                      {c.reference || c.id}
                    </Typography>
                    <ComplaintStatusChip status={c.status} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    {c.description}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1, mt: 0.5, alignItems: "center", flexWrap: "wrap" }}>
                    <Chip label={c.category} size="small" variant="outlined" />
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(c.createdAt)}
                    </Typography>
                    {c.window.open ? (
                      c.window.daysLeft !== null && (
                        <Chip
                          icon={<ScheduleOutlinedIcon />}
                          label={c.window.daysLeft === 1 ? "1 day left" : `${c.window.daysLeft} days left`}
                          size="small"
                          color={c.window.daysLeft <= 3 ? "warning" : "success"}
                          variant="outlined"
                        />
                      )
                    ) : (
                      <Tooltip title={c.window.reason ?? ""} arrow>
                        <Chip
                          icon={<LockClockOutlinedIcon />}
                          label="Window closed"
                          size="small"
                          variant="outlined"
                        />
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              ))}
            </Paper>
          </Grid>

          {/* Rating form */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper elevation={1} sx={{ borderRadius: 2, p: 3, height: "100%" }}>
              {!selected ? (
                <EmptyState
                  icon={RateReviewOutlinedIcon}
                  title="Select a complaint"
                  description="Pick a resolved complaint from the list to rate its resolution."
                />
              ) : (
                <>
                  <Typography variant="subtitle1" fontWeight={700}>
                    How was the resolution of {selected.reference || selected.id}?
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {selected.description}
                  </Typography>
                  <Divider sx={{ my: 2 }} />

                  {!windowOpen ? (
                    <Alert severity="info" icon={<LockClockOutlinedIcon />} sx={{ borderRadius: 2 }}>
                      <Typography variant="body2" fontWeight={700} gutterBottom>
                        This complaint can no longer be rated
                      </Typography>
                      <Typography variant="body2">{selected.window.reason}</Typography>
                    </Alert>
                  ) : (
                    <>
                      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                        Your Rating *
                      </Typography>
                      <Rating
                        size="large"
                        value={rating}
                        disabled={submitting}
                        onChange={(_, value) => setRating(value ?? 0)}
                      />
                      <TextField
                        fullWidth
                        multiline
                        minRows={3}
                        label="Comments (optional)"
                        placeholder="Tell us what went well or what could be better..."
                        value={comment}
                        disabled={submitting}
                        onChange={(e) => setComment(e.target.value)}
                        slotProps={{ htmlInput: { maxLength: 1000 } }}
                        sx={{ mt: 2 }}
                      />
                      <Button
                        variant="contained"
                        disabled={rating === 0 || submitting}
                        startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : null}
                        onClick={handleSubmit}
                        sx={{ mt: 2, fontWeight: 600 }}
                      >
                        {submitting ? "Submitting…" : "Submit Feedback"}
                      </Button>
                      {rating === 0 && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                          Select a star rating to enable submission.
                        </Typography>
                      )}
                      {selected.window.daysLeft !== null && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                          You have {selected.window.daysLeft}{" "}
                          {selected.window.daysLeft === 1 ? "day" : "days"} left to rate this complaint.
                        </Typography>
                      )}
                    </>
                  )}
                </>
              )}
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}

