import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Typography,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import { APPLICATION_STATUS } from "../mock/onboarding";
import { ROLE_LABELS } from "../../auth/mock/roles";
import { formatDate } from "../../../utils/formatDate";

const STATUS_CONFIG = {
  [APPLICATION_STATUS.PENDING]: {
    icon: HourglassEmptyOutlinedIcon,
    color: "warning",
    bgColor: "#fffbf0",
    borderColor: "#f5c842",
    label: "Pending Approval",
    message: "Your application is under review by the Association Secretary.",
  },
  [APPLICATION_STATUS.APPROVED]: {
    icon: CheckCircleOutlinedIcon,
    color: "success",
    bgColor: "#f0faf2",
    borderColor: "#2f7a3f",
    label: "Approved",
    message: "Congratulations! Your application has been approved. Welcome to the community.",
  },
  [APPLICATION_STATUS.REJECTED]: {
    icon: CancelOutlinedIcon,
    color: "error",
    bgColor: "#fff5f5",
    borderColor: "#a83b3b",
    label: "Rejected",
    message: "Your application was not approved. Please contact the Association for details.",
  },
};

export default function ApprovalCard({ application }) {
  const config = STATUS_CONFIG[application.status] ?? STATUS_CONFIG[APPLICATION_STATUS.PENDING];
  const Icon = config.icon;

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: "1.5px solid",
        borderColor: config.borderColor,
        bgcolor: config.bgColor,
        boxShadow: 2,
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2.5 }}>
          <Icon sx={{ fontSize: 48, color: `${config.color}.main` }} />
          <Box>
            <Chip label={config.label} color={config.color} size="small" sx={{ mb: 0.5 }} />
            <Typography variant="body2" color="text.secondary">
              {config.message}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={2}>
          {[
            { label: "Application No.", value: application.id },
            { label: "Applicant Name", value: application.name },
            { label: "Role", value: ROLE_LABELS[application.role] ?? application.role },
            { label: "Flat", value: `${application.wing}-${application.flat}` },
            { label: "Submitted On", value: formatDate(application.submittedAt) },
            ...(application.remarks ? [{ label: "Remarks", value: application.remarks }] : []),
          ].map(({ label, value }) => (
            <Grid size={{ xs: 12, sm: 6 }} key={label}>
              <Typography variant="caption" color="text.secondary" display="block">
                {label}
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                {value}
              </Typography>
            </Grid>
          ))}
        </Grid>
      </CardContent>
    </Card>
  );
}
