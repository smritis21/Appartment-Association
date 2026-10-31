import { Box, Step, StepLabel, Stepper, Typography } from "@mui/material";

const STEPS = [
  "Registration Type",
  "Personal Details",
  "Documents",
  "KYC Verification",
  "Approval Status",
];

export default function OnboardingStepperHeader({ activeStep = 0 }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Stepper activeStep={activeStep} alternativeLabel>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel
              slotProps={{
                stepIcon: {
                  sx: {
                    "&.Mui-completed": { color: "primary.main" },
                    "&.Mui-active": { color: "primary.main" },
                  },
                },
              }}
            >
              <Typography variant="caption" fontWeight={500}>
                {label}
              </Typography>
            </StepLabel>
          </Step>
        ))}
      </Stepper>
    </Box>
  );
}
