import { Box, Paper, Typography, Divider } from "@mui/material";
import PublicNavbar from "../../../components/layout/PublicNavbar";
import appConfig from "../../../config/appConfig";

// Placeholder legal copy for an apartment-management system - reasonable
// starting point, not a substitute for real legal review.
export default function PrivacyPolicyPage() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <PublicNavbar />
      <Box sx={{ maxWidth: 820, mx: "auto", px: 3, py: 6 }}>
        <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 2, boxShadow: 1 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Privacy Policy
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Last updated: August 2026
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Typography variant="h6" fontWeight={700} gutterBottom>
            1. Information We Collect
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ lineHeight: 1.8, mb: 2 }}>
            {appConfig.appName} collects information you provide directly - such as your name,
            email address, phone number, flat/wing details, emergency contacts, and family member
            details - as well as information generated through your use of the Platform, including
            complaint history, payment records, visitor passes, and facility bookings.
          </Typography>

          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 3 }}>
            2. How We Use Your Information
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ lineHeight: 1.8, mb: 2 }}>
            Resident data is used solely to operate the community: generating and collecting
            maintenance bills, processing complaints and service requests, approving visitors,
            managing facility bookings, and sending notices, reminders, and emergency alerts. We do
            not sell resident data to third parties.
          </Typography>

          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 3 }}>
            3. Who Can See Your Data
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ lineHeight: 1.8, mb: 2 }}>
            Access to resident records is role-based. Committee members (president, secretary) and
            administrators can view resident and billing information necessary to run the
            association. Security staff can view visitor-pass and gate-log data required for
            premises safety. Maintenance staff can view work orders and complaint details assigned
            to them. Other residents cannot see your personal contact details or billing history
            beyond the public directory information you choose to share.
          </Typography>

          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 3 }}>
            4. Data Retention
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ lineHeight: 1.8, mb: 2 }}>
            Resident and billing records are retained for as long as required for audit, financial,
            and legal purposes, even after a resident moves out or an account is deactivated.
            Deactivation is a soft delete - records are marked inactive rather than permanently
            erased, so that historical billing and complaint history remains available to the
            association for compliance purposes.
          </Typography>

          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 3 }}>
            5. Security
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ lineHeight: 1.8, mb: 2 }}>
            We use industry-standard measures - including password hashing, role-based access
            control, and audit logging of sensitive actions - to protect your data. No method of
            transmission or storage is completely secure, and we encourage you to use a strong,
            unique password for your account.
          </Typography>

          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 3 }}>
            6. Your Choices
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ lineHeight: 1.8, mb: 2 }}>
            You can review and update most of your personal information from the Profile Settings
            page. Requests to correct or remove data beyond what is self-service (e.g. historical
            billing records) can be made to the association office.
          </Typography>

          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 3 }}>
            7. Contact
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            Questions about this policy or your data can be directed to the association office or
            the {appConfig.appShortName} administrator through the Support section of the Platform.
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
