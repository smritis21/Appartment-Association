import {
  Box, Button, Divider, Paper, Typography,
} from "@mui/material";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { useNavigate } from "react-router-dom";
import { formatDateTime } from "../../../utils/formatDate";
import { REMINDER_TYPE, REMINDER_STATUS } from "../mock/reminders";
import ReminderStatusChip from "./ReminderStatusChip";
import ReminderPriorityChip from "./ReminderPriorityChip";

const TYPE_ICON = {
  [REMINDER_TYPE.UPCOMING]:         HourglassEmptyOutlinedIcon,
  [REMINDER_TYPE.DUE_TODAY]:        WarningAmberOutlinedIcon,
  [REMINDER_TYPE.OVERDUE]:          ErrorOutlineOutlinedIcon,
  [REMINDER_TYPE.PAYMENT_RECEIVED]: CheckCircleOutlinedIcon,
  [REMINDER_TYPE.FINAL_REMINDER]:   ErrorOutlineOutlinedIcon,
};

const TYPE_COLOR = {
  [REMINDER_TYPE.UPCOMING]:         "info.main",
  [REMINDER_TYPE.DUE_TODAY]:        "warning.main",
  [REMINDER_TYPE.OVERDUE]:          "error.main",
  [REMINDER_TYPE.PAYMENT_RECEIVED]: "success.main",
  [REMINDER_TYPE.FINAL_REMINDER]:   "error.main",
};

export default function ReminderCard({ reminder, residentName, onMarkRead, onDismiss }) {
  const navigate = useNavigate();
  const Icon = TYPE_ICON[reminder.type] ?? NotificationsOutlinedIcon;
  const iconColor = TYPE_COLOR[reminder.type] ?? "text.secondary";
  const isDismissed = reminder.status === REMINDER_STATUS.DISMISSED;

  return (
    <Paper
      elevation={1}
      sx={{
        borderRadius: 3,
        p: 2.5,
        opacity: isDismissed ? 0.55 : 1,
        borderLeft: "4px solid",
        borderColor: iconColor,
      }}
    >
      <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
        <Box sx={{ mt: 0.25, flexShrink: 0 }}>
          <Icon sx={{ color: iconColor, fontSize: 22 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 0.5 }}>
            <Typography variant="body2" fontWeight={700} sx={{ mr: 1 }}>{reminder.title}</Typography>
            <Box sx={{ display: "flex", gap: 0.75, flexShrink: 0 }}>
              <ReminderPriorityChip priority={reminder.priority} />
              <ReminderStatusChip status={reminder.status} />
            </Box>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{reminder.description}</Typography>
          <Box sx={{ display: "flex", gap: 2, mt: 0.75, flexWrap: "wrap" }}>
            <Typography variant="caption" color="text.disabled">{residentName ?? "-"}</Typography>
            <Typography variant="caption" fontFamily="monospace" color="text.disabled">{reminder.billId}</Typography>
            <Typography variant="caption" color="text.disabled">{formatDateTime(reminder.sentAt)}</Typography>
          </Box>
        </Box>
      </Box>

      {!isDismissed && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <Button size="small" variant="text" onClick={() => navigate(`/reminders/${reminder.id}`)}>
              View
            </Button>
            {reminder.status === REMINDER_STATUS.UNREAD && (
              <Button size="small" variant="text" onClick={() => onMarkRead?.(reminder.id)}>
                Mark Read
              </Button>
            )}
            {reminder.suggestedAction === "pay_now" && (
              <Button size="small" variant="contained" onClick={() => navigate(`/payments/pay/${reminder.billId}`)}>
                Pay Now
              </Button>
            )}
            {reminder.suggestedAction === "view_receipt" && (
              <Button size="small" variant="outlined" onClick={() => navigate(`/billing/invoice/${reminder.billId}`)}>
                View Bill
              </Button>
            )}
            <Button size="small" variant="text" color="inherit" sx={{ ml: "auto", color: "text.disabled" }}
              onClick={() => onDismiss?.(reminder.id)}>
              Dismiss
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
}

