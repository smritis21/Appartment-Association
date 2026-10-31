import { Box, Paper, Typography, Link } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import SettingsSection from "../components/SettingsSection";
import appConfig from "../../../config/appConfig";

function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={500}>{value}</Typography>
    </Box>
  );
}

export default function AboutPage() {
  return (
    <Box>
      <PageHeader
        title="About"
        subtitle="Application information, version details, and legal."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings", href: "/settings" }, { label: "About" }]}
      />

      {/* App identity */}
      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
          <Box sx={{ width: 56, height: 56, borderRadius: 2, bgcolor: "primary.main", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Typography variant="h6" fontWeight={800} color="white">{appConfig.appShortName}</Typography>
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={700}>{appConfig.appName}</Typography>
            <Typography variant="body2" color="text.secondary">Apartment Association Management System</Typography>
          </Box>
        </Box>

        <SettingsSection title="Application Details">
          <InfoRow label="Application Name" value={appConfig.appName} />
          <InfoRow label="Short Name"       value={appConfig.appShortName} />
          <InfoRow label="Version"          value={appConfig.version} />
        </SettingsSection>

        <SettingsSection title="Description" sx={{ mb: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            {appConfig.appName} is a comprehensive apartment association management platform designed to
            streamline resident onboarding, billing, payments, document management, complaint tracking,
            and administrative operations for modern residential communities.
          </Typography>
        </SettingsSection>
      </Paper>

      {/* Legal */}
      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1 }}>
        <SettingsSection title="Legal" sx={{ mb: 0 }}>
          <Box sx={{ py: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="body2" color="text.secondary">Copyright</Typography>
            <Typography variant="body2" fontWeight={500} sx={{ mt: 0.25 }}>
              © 2026 {appConfig.appName}. All rights reserved.
            </Typography>
          </Box>
          <Box sx={{ py: 1.25, borderBottom: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">Terms &amp; Conditions</Typography>
            <Link component={RouterLink} to="/terms" underline="hover" variant="body2" color="primary.main">View Terms</Link>
          </Box>
          <Box sx={{ py: 1.25, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary">Privacy Policy</Typography>
            <Link component={RouterLink} to="/privacy-policy" underline="hover" variant="body2" color="primary.main">View Policy</Link>
          </Box>
        </SettingsSection>
      </Paper>
    </Box>
  );
}
