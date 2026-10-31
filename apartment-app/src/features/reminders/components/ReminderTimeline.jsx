import { Box, Paper, Typography } from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import { BILL_STATUS } from "../../billing/mock/bills";
import { REMINDER_TYPE } from "../mock/reminders";
import { formatDate } from "../../../utils/formatDate";

export default function ReminderTimeline({ bill, reminders }) {
  const isPaid    = bill?.status === BILL_STATUS.PAID;
  const isOverdue = bill?.status === BILL_STATUS.OVERDUE;

  const hasUpcoming      = reminders.some((r) => r.type === REMINDER_TYPE.UPCOMING);
  const hasDueToday      = reminders.some((r) => r.type === REMINDER_TYPE.DUE_TODAY);
  const hasFinalReminder = reminders.some((r) => r.type === REMINDER_TYPE.FINAL_REMINDER);

  const steps = [
    {
      label: "Bill Generated",
      date: bill?.billingMonth ?? "-",
      done: true,
      icon: HourglassEmptyOutlinedIcon,
      color: "primary.main",
    },
    {
      label: "Reminder Sent",
      date: hasUpcoming ? "Upcoming reminder sent" : "-",
      done: hasUpcoming,
      icon: NotificationsOutlinedIcon,
      color: "info.main",
    },
    {
      label: "Second Reminder",
      date: hasDueToday ? "Due today reminder sent" : "-",
      done: hasDueToday,
      icon: WarningAmberOutlinedIcon,
      color: "warning.main",
    },
    {
      label: "Final Reminder",
      date: hasFinalReminder ? "Final notice sent" : "-",
      done: hasFinalReminder,
      icon: ErrorOutlineOutlinedIcon,
      color: "error.main",
    },
    {
      label: isPaid ? "Payment Received" : isOverdue ? "Overdue" : "Awaiting Payment",
      date: isPaid ? formatDate(bill.paidDate) : isOverdue ? `Due: ${formatDate(bill?.dueDate)}` : `Due: ${formatDate(bill?.dueDate)}`,
      done: isPaid,
      warn: isOverdue && !isPaid,
      icon: isPaid ? CheckCircleOutlinedIcon : isOverdue ? ErrorOutlineOutlinedIcon : HourglassEmptyOutlinedIcon,
      color: isPaid ? "success.main" : isOverdue ? "error.main" : "text.disabled",
    },
  ];

  return (
    <Paper elevation={1} sx={{ borderRadius: 3, p: 3 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Payment Timeline</Typography>
      <Box sx={{ display: "flex", alignItems: "flex-start" }}>
        {steps.map((step, i) => {
          const Icon = step.icon;
          const dotColor = step.done ? step.color : step.warn ? "error.main" : "action.disabledBackground";
          return (
            <Box key={step.label} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
                {i > 0 && (
                  <Box sx={{ flex: 1, height: 2, bgcolor: step.done ? step.color : "divider" }} />
                )}
                <Box sx={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  bgcolor: step.done ? step.color : step.warn ? "error.main" : "action.disabledBackground",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon sx={{ color: step.done || step.warn ? "white" : "text.disabled", fontSize: 16 }} />
                </Box>
                {i < steps.length - 1 && (
                  <Box sx={{ flex: 1, height: 2, bgcolor: steps[i + 1].done ? steps[i + 1].color : "divider" }} />
                )}
              </Box>
              <Typography variant="caption" fontWeight={600} sx={{ mt: 0.75, textAlign: "center", fontSize: 11 }}>
                {step.label}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center", fontSize: 10 }}>
                {step.date}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

