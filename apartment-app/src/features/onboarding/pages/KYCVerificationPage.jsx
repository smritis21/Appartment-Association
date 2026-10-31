import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Typography,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { useNavigate } from "react-router-dom";
import OnboardingStepperHeader from "../components/OnboardingStepperHeader";
import PageHeader from "../../../components/common/PageHeader";
import { DOCUMENT_TYPES } from "../mock/onboarding";

const MOCK_DOC_STATUSES = {
  aadhaar:           { status: "verified", date: "11 Jul 2026" },
  pan:               { status: "verified", date: "11 Jul 2026" },
  sale_deed:         { status: "pending",  date: "11 Jul 2026" },
  rental_agreement:  { status: "pending",  date: "11 Jul 2026" },
  photo:             { status: "verified", date: "11 Jul 2026" },
};

const DOC_STATUS_CONFIG = {
  verified: { label: "Verified",      color: "success", icon: CheckCircleOutlinedIcon },
  pending:  { label: "Under Review",  color: "warning", icon: HourglassEmptyOutlinedIcon },
  rejected: { label: "Rejected",      color: "error",   icon: CancelOutlinedIcon },
};

const TIMELINE_STEPS = [
  { label: "Documents Submitted",  description: "Your documents have been received.",                        date: "11 Jul 2026", done: true  },
  { label: "Under Review",         description: "The Association Secretary is reviewing your documents.",    date: "12 Jul 2026", done: true  },
  { label: "KYC Verification",     description: "Identity verification in progress.",                       date: "13 Jul 2026", done: false },
  { label: "Approval Decision",    description: "Final approval by the Association.",                       date: "Pending",     done: false },
];

export default function KYCVerificationPage() {
  const navigate = useNavigate();

  return (
    <Box>
      <PageHeader
        title="KYC Verification"
        subtitle="Track the verification status of your submitted documents"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Onboarding", href: "/onboarding" },
          { label: "KYC Verification" },
        ]}
      />

      <OnboardingStepperHeader activeStep={3} />

      <Box sx={{ maxWidth: 720, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 3 }}>
        {/* Document Status */}
        <Paper elevation={1} sx={{ borderRadius: 3, p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Document Verification Status
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {DOCUMENT_TYPES.map((doc) => {
              const { status, date } = MOCK_DOC_STATUSES[doc.key] ?? { status: "pending", date: "-" };
              const config = DOC_STATUS_CONFIG[status];
              const Icon = config.icon;
              return (
                <Box key={doc.key}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <UploadFileOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                      <Typography variant="body2">{doc.label}</Typography>
                    </Box>
                    <Chip
                      icon={<Icon style={{ fontSize: 14 }} />}
                      label={config.label}
                      color={config.color}
                      size="small"
                      variant="outlined"
                    />
                  </Box>
                  <Typography variant="caption" color="text.disabled" sx={{ ml: 3.5 }}>
                    Submitted: {date}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Paper>

        {/* Timeline */}
        <Paper elevation={1} sx={{ borderRadius: 3, p: 3 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
            Application Timeline
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Stepper orientation="vertical" nonLinear>
            {TIMELINE_STEPS.map((step, i) => (
              <Step key={i} active={!step.done} completed={step.done}>
                <StepLabel
                  slotProps={{
                    stepIcon: {
                      sx: {
                        "&.Mui-completed": { color: "primary.main" },
                        "&.Mui-active":    { color: "warning.main" },
                      },
                    },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
                    <Typography variant="body2" fontWeight={step.done ? 600 : 400}>
                      {step.label}
                    </Typography>
                    <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
                      {step.date}
                    </Typography>
                  </Box>
                </StepLabel>
                <StepContent>
                  <Typography variant="caption" color="text.secondary">
                    {step.description}
                  </Typography>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </Paper>
      </Box>

      <Box sx={{ mt: 3, maxWidth: 720 }}>
        <Button variant="contained" onClick={() => navigate("/onboarding/status")} sx={{ fontWeight: 600 }}>
          View Approval Status
        </Button>
      </Box>
    </Box>
  );
}

