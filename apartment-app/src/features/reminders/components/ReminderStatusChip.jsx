import { Chip } from "@mui/material";
import { REMINDER_STATUS } from "../mock/reminders";

const CONFIG = {
  [REMINDER_STATUS.UNREAD]:    { label: "Unread",    color: "primary" },
  [REMINDER_STATUS.READ]:      { label: "Read",      color: "default" },
  [REMINDER_STATUS.DISMISSED]: { label: "Dismissed", color: "default" },
};

export default function ReminderStatusChip({ status, size = "small" }) {
  const cfg = CONFIG[status] ?? { label: status, color: "default" };
  return <Chip label={cfg.label} color={cfg.color} size={size} variant={status === REMINDER_STATUS.UNREAD ? "filled" : "outlined"} />;
}
