import { Alert, Box, Button, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { REMINDER_TYPE, REMINDER_STATUS } from "../mock/reminders";

const TYPE_SEVERITY = {
  [REMINDER_TYPE.UPCOMING]:         "info",
  [REMINDER_TYPE.DUE_TODAY]:        "warning",
  [REMINDER_TYPE.OVERDUE]:          "error",
  [REMINDER_TYPE.PAYMENT_RECEIVED]: "success",
  [REMINDER_TYPE.FINAL_REMINDER]:   "error",
};

export default function ReminderBanner({ reminder, residentName, onDismiss }) {
  const navigate = useNavigate();
  if (!reminder || reminder.status === REMINDER_STATUS.DISMISSED) return null;

  const severity = TYPE_SEVERITY[reminder.type] ?? "info";

  return (
    <Alert
      severity={severity}
      sx={{ mb: 3, borderRadius: 2, alignItems: "center" }}
      action={
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexShrink: 0 }}>
          {reminder.suggestedAction === "pay_now" && (
            <Button
              size="small"
              variant="contained"
              color={severity === "error" ? "error" : severity === "warning" ? "warning" : "primary"}
              onClick={() => navigate(`/payments/pay/${reminder.billId}`)}
            >
              Pay Now
            </Button>
          )}
          <Button size="small" variant="outlined" color="inherit"
            onClick={() => navigate(`/billing/invoice/${reminder.billId}`)}>
            View Bill
          </Button>
          <Button size="small" color="inherit" onClick={() => onDismiss?.(reminder.id)}>
            Dismiss
          </Button>
        </Box>
      }
    >
      <Typography variant="body2" fontWeight={700}>{reminder.title}</Typography>
      <Typography variant="caption" color="inherit">
        {residentName ? `${residentName} · ` : ""}{reminder.description}
      </Typography>
    </Alert>
  );
}
