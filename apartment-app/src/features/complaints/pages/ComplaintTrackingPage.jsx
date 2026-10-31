import {
  Alert, Box, Button, Chip, Divider, Grid, Paper, Rating, Typography,
} from "@mui/material";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import EmptyState from "../../../components/common/EmptyState";
import { useComplaints } from "../../../context/ComplaintContext";
import { useAuthContext } from "../../../context/AuthContext";
import { fetchComplaint } from "../../../services/complaintService";
import { isOffline } from "../../../services/apiClient";
import { COMPLAINT_STATUS, getStaffById } from "../mock/complaints";
import { formatDateTime } from "../../../utils/formatDate";
import ComplaintStatusChip from "../components/ComplaintStatusChip";
import ComplaintStepper from "../components/ComplaintStepper";

// FE-02 - Complaint Status Tracking Screen (also the detail view for FE-10)
export default function ComplaintTrackingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getComplaintById } = useComplaints();
  const { user } = useAuthContext();

  // INT-02: the stage and its timestamps come from the API, so the screen
  // shows where the complaint actually is rather than what this browser
  // last remembered.
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const live = await fetchComplaint(id, user?.residentId);
        if (active) { setComplaint(live); setOffline(false); }
      } catch (err) {
        if (!active) return;
        if (isOffline(err)) {
          setComplaint(getComplaintById(id) ?? null);
          setOffline(true);
        } else {
          // A 404 is a genuine "no such complaint", which the empty state
          // below already handles.
          setComplaint(null);
          setOffline(false);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id, getComplaintById, user?.residentId]);

  if (loading) {
    return (
      <Box>
        <PageHeader
          title="Complaint"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Complaints", href: "/complaints" }]}
        />
        <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
          Loading complaint…
        </Typography>
      </Box>
    );
  }

  if (!complaint) {
    return (
      <Box>
        <PageHeader
          title="Complaint Not Found"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Complaints", href: "/complaints" }]}
        />
        <EmptyState
          icon={ReportProblemOutlinedIcon}
          title="We couldn't find that complaint"
          description={`No complaint exists with ID "${id}".`}
          action={() => navigate("/complaints")}
          actionLabel="Back to Complaints"
        />
      </Box>
    );
  }

  const staff = getStaffById(complaint.assignedTo);
  const canGiveFeedback =
    [COMPLAINT_STATUS.RESOLVED, COMPLAINT_STATUS.CLOSED].includes(complaint.status) &&
    !complaint.feedback;

  return (
    <Box>
      <PageHeader
        title={`Complaint ${complaint.reference || complaint.id}`}
        subtitle="Track your complaint as it moves through each stage"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Complaints", href: "/complaints" },
          { label: complaint.reference || complaint.id },
        ]}
        action={
          canGiveFeedback && (
            <Button
              variant="contained"
              startIcon={<RateReviewOutlinedIcon />}
              onClick={() => navigate("/complaints/feedback", { state: { complaintId: complaint.id } })}
            >
              Rate Resolution
            </Button>
          )
        }
      />

      {offline && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Showing the last known details - the server is unreachable, so the stage may have moved on.
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* Details */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 3, height: "100%" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Details</Typography>
              <ComplaintStatusChip status={complaint.status} />
            </Box>
            <Divider sx={{ mb: 2 }} />
            {[
              ["Category", <Chip key="cat" label={complaint.category} size="small" variant="outlined" />],
              ["Description", complaint.description],
              ["Location", complaint.location],
              ["Raised By", `${complaint.residentName} (${complaint.flat})`],
              ["Raised On", formatDateTime(complaint.createdAt)],
              ["Assigned To", staff ? `${staff.name} - ${staff.specialization}` : "Not yet assigned"],
              ["Photo", complaint.image ?? "No photo attached"],
            ].map(([label, value]) => (
              <Box key={label} sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body2" component="div">{value}</Typography>
              </Box>
            ))}

            {complaint.feedback && (
              <>
                <Divider sx={{ my: 2 }} />
                <Typography variant="caption" color="text.secondary">Your Feedback</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                  <Rating value={complaint.feedback.rating} readOnly size="small" />
                  <Typography variant="caption" color="text.secondary">
                    {formatDateTime(complaint.feedback.submittedAt)}
                  </Typography>
                </Box>
                {complaint.feedback.comment && (
                  <Typography variant="body2" sx={{ mt: 0.5 }}>
                    “{complaint.feedback.comment}”
                  </Typography>
                )}
              </>
            )}
          </Paper>
        </Grid>

        {/* Stage stepper - FE-02 */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 3, height: "100%" }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Progress</Typography>
            <Divider sx={{ mb: 1 }} />
            <ComplaintStepper complaint={complaint} />

            <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 3, mb: 1 }}>Activity Log</Typography>
            {complaint.timeline.map((entry, i) => (
              <Box key={i} sx={{ display: "flex", gap: 1.5, py: 0.75, borderBottom: i < complaint.timeline.length - 1 ? "1px dashed" : "none", borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 140, fontFamily: "var(--font-mono)" }}>
                  {formatDateTime(entry.at)}
                </Typography>
                <Typography variant="body2">
                  <b>{entry.by}</b> - {entry.notes}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

