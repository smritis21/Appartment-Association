import { Box, Button, Grid, Typography } from "@mui/material";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DocumentUploadCard from "../components/DocumentUploadCard";
import OnboardingStepperHeader from "../components/OnboardingStepperHeader";
import PageHeader from "../../../components/common/PageHeader";
import { DOCUMENT_TYPES } from "../mock/onboarding";

export default function DocumentUploadPage() {
  const navigate = useNavigate();
  const [uploads, setUploads] = useState({});

  const handleUpload = (key, file) => setUploads((p) => ({ ...p, [key]: file }));
  const handleRemove = (key) => setUploads((p) => { const n = { ...p }; delete n[key]; return n; });

  const requiredUploaded = DOCUMENT_TYPES.filter((d) => d.required).every((d) => uploads[d.key]);

  return (
    <Box>
      <PageHeader
        title="Document Upload"
        subtitle="Upload the required documents for verification"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Onboarding", href: "/onboarding" },
          { label: "Documents" },
        ]}
      />

      <OnboardingStepperHeader activeStep={2} />

      <Box sx={{ maxWidth: 720 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Upload clear, legible copies of your documents. Supported formats: PDF, JPG, PNG.
          Maximum file size: 5 MB per document.
        </Typography>

        <Grid container spacing={2} sx={{ mb: 4 }}>
          {DOCUMENT_TYPES.map((doc) => (
            <Grid size={{ xs: 12, sm: 6 }} key={doc.key}>
              <DocumentUploadCard
                docKey={doc.key}
                label={doc.label}
                required={doc.required}
                accept={doc.accept}
                uploadedFile={uploads[doc.key]}
                onUpload={handleUpload}
                onRemove={handleRemove}
              />
            </Grid>
          ))}
        </Grid>

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button variant="outlined" color="inherit" onClick={() => navigate(-1)} sx={{ flex: 1 }}>
            Back
          </Button>
          <Button
            variant="contained"
            disabled={!requiredUploaded}
            onClick={() => navigate("/onboarding/kyc")}
            sx={{ flex: 2, fontWeight: 600 }}
          >
            Continue to KYC Verification
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
