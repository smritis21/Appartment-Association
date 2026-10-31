import { Step, StepLabel, Stepper, Typography } from "@mui/material";
import { STATUS_ORDER, STATUS_LABELS } from "../mock/complaints";
import { formatDateTime } from "../../../utils/formatDate";

// FE-02 - vertical timeline of Submitted → Assigned → In Progress →
// Resolved → Closed with the reached stages timestamped and the current
// stage highlighted.
export default function ComplaintStepper({ complaint, orientation = "vertical" }) {
  const activeStep = STATUS_ORDER.indexOf(complaint.status);

  const timestampFor = (status) => {
    const entry = [...complaint.timeline].reverse().find((t) => t.status === status);
    return entry ? formatDateTime(entry.at) : "Pending";
  };

  return (
    <Stepper activeStep={activeStep} orientation={orientation} sx={{ mt: 1 }}>
      {STATUS_ORDER.map((status, idx) => (
        <Step key={status} completed={idx < activeStep}>
          <StepLabel
            optional={
              <Typography variant="caption" color={idx <= activeStep ? "text.secondary" : "text.disabled"}>
                {idx <= activeStep ? timestampFor(status) : "Pending"}
              </Typography>
            }
          >
            <Typography fontWeight={idx === activeStep ? 700 : 500} color={idx === activeStep ? "primary.main" : "text.primary"}>
              {STATUS_LABELS[status]}
            </Typography>
          </StepLabel>
        </Step>
      ))}
    </Stepper>
  );
}

