import { useEffect, useState } from "react";
import { Box, Button, CircularProgress, TextField, Typography } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";
import ApprovalCard from "../components/ApprovalCard";
import OnboardingStepperHeader from "../components/OnboardingStepperHeader";
import PageHeader from "../../../components/common/PageHeader";
import { APPLICATION_STATUS } from "../mock/onboarding";
import { useOnboarding } from "../../../context/OnboardingContext";
import { fetchStatus, toUiApplicationRow } from "../../../services/onboardingService";
import { isOffline } from "../../../services/apiClient";

export default function ApprovalStatusPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { applications } = useOnboarding();

  const passedId = location.state?.application?.id ?? location.state?.applicationId ?? "";
  const [lookupId, setLookupId] = useState(passedId);
  const [apiApplication, setApiApplication] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadStatus = (id) => {
    if (!id) return;
    setLoading(true);
    setError("");
    fetchStatus(id)
      .then((app) => setApiApplication(toUiApplicationRow(app)))
      .catch((err) => {
        setApiApplication(null);
        setError(isOffline(err) ? "Could not reach the server." : err.detail || err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (passedId) loadStatus(passedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passedId]);

  // Live lookup takes priority; fall back to the demo dataset only if no
  // application number has been looked up yet (nothing to be "wrong" about).
  const application =
    apiApplication ??
    (!passedId && !lookupId
      ? (location.state?.application ?? applications.find((a) => a.status === APPLICATION_STATUS.PENDING) ?? null)
      : null);

  return (
    <Box>
      <PageHeader
        title="Application Status"
        subtitle="Track the status of your registration application"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Onboarding", href: "/onboarding" },
          { label: "Status" },
        ]}
      />

      <OnboardingStepperHeader activeStep={4} />

      <Box sx={{ maxWidth: 640 }}>
        <Box sx={{ display: "flex", gap: 1, mb: 3 }}>
          <TextField
            label="Application Number"
            size="small"
            fullWidth
            value={lookupId}
            onChange={(e) => setLookupId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadStatus(lookupId.trim())}
            placeholder="e.g. an application ID from your confirmation"
          />
          <Button variant="contained" disabled={loading || !lookupId.trim()} onClick={() => loadStatus(lookupId.trim())}>
            {loading ? <CircularProgress size={20} color="inherit" /> : "Check Status"}
          </Button>
        </Box>

        {error && (
          <Typography color="error.main" variant="body2" sx={{ mb: 2 }}>
            {error}
          </Typography>
        )}

        {application ? (
          <>
            <ApprovalCard application={application} />
            <Box sx={{ mt: 3, display: "flex", gap: 2 }}>
              <Button variant="outlined" onClick={() => navigate("/onboarding/kyc")}>
                View KYC Status
              </Button>
              <Button variant="contained" onClick={() => navigate("/dashboard")} sx={{ fontWeight: 600 }}>
                Go to Dashboard
              </Button>
            </Box>
          </>
        ) : (
          !loading && <Typography color="text.secondary">No application found.</Typography>
        )}
      </Box>
    </Box>
  );
}
