import { Box, Paper, Typography, Divider } from "@mui/material";
import PublicNavbar from "../../../components/layout/PublicNavbar";
import appConfig from "../../../config/appConfig";

// Placeholder legal copy for an apartment-management system - reasonable
// starting point, not a substitute for real legal review.
export default function TermsPage() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <PublicNavbar />
      <Box sx={{ maxWidth: 820, mx: "auto", px: 3, py: 6 }}>
        <Paper sx={{ p: { xs: 3, md: 5 }, borderRadius: 2, boxShadow: 1 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Terms of Service
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Last updated: August 2026
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Typography variant="h6" fontWeight={700} gutterBottom>
            1. Acceptance of Terms
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ lineHeight: 1.8, mb: 2 }}>
            By creating an account or otherwise using {appConfig.appName} (the &quot;Platform&quot;),
            you agree to be bound by these Terms of Service. The Platform is provided to residents,
            owners, tenants, and staff of the apartment community for the purpose of managing
            association business - including billing, complaints, visitor access, bookings, and
            communication. If you do not agree to these terms, please do not use the Platform.
          </Typography>

          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 3 }}>
            2. Accounts and Eligibility
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ lineHeight: 1.8, mb: 2 }}>
            Accounts are issued to verified owners, tenants, and association staff following
            approval by the management committee. You are responsible for maintaining the
            confidentiality of your login credentials and for all activity that occurs under your
            account. Notify the association office immediately if you suspect unauthorized use of
            your account.
          </Typography>

          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 3 }}>
            3. Resident Responsibilities
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ lineHeight: 1.8, mb: 2 }}>
            Residents agree to provide accurate information when registering, updating profile
            details, or submitting requests (maintenance dues, complaints, visitor passes, facility
            bookings, etc.). Misuse of the Platform - including submitting false complaints,
            fraudulent payment claims, or impersonating another resident - may result in suspension
            of your account and referral to the management committee for further action.
          </Typography>

          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 3 }}>
            4. Payments and Dues
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ lineHeight: 1.8, mb: 2 }}>
            Maintenance bills, late fees, and other dues generated through the Platform reflect the
            association&apos;s official records. Disputes over billed amounts should be raised
            through the in-app complaint or support channel within a reasonable time of the bill
            being issued. The association reserves the right to apply late fees as configured in
            the apartment&apos;s billing policy.
          </Typography>

          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 3 }}>
            5. Acceptable Use
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ lineHeight: 1.8, mb: 2 }}>
            You agree not to use the Platform to upload unlawful, defamatory, or abusive content, to
            attempt unauthorized access to other residents&apos; data, or to interfere with the
            proper functioning of the service. The association may remove content or restrict
            access that violates community guidelines.
          </Typography>

          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 3 }}>
            6. Changes to These Terms
          </Typography>
          <Typography variant="body2" color="text.secondary" component="p" sx={{ lineHeight: 1.8, mb: 2 }}>
            These terms may be updated from time to time to reflect changes in association policy
            or applicable law. Continued use of the Platform after changes are posted constitutes
            acceptance of the revised terms.
          </Typography>

          <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mt: 3 }}>
            7. Contact
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
            Questions about these terms can be directed to the association office or the {" "}
            {appConfig.appShortName} administrator through the Support section of the Platform.
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
