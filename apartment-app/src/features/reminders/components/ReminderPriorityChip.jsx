import { Chip } from "@mui/material";
import { REMINDER_PRIORITY } from "../mock/reminders";

const CONFIG = {
  [REMINDER_PRIORITY.LOW]:      { label: "Low",      color: "success" },
  [REMINDER_PRIORITY.MEDIUM]:   { label: "Medium",   color: "info"    },
  [REMINDER_PRIORITY.HIGH]:     { label: "High",     color: "warning" },
  [REMINDER_PRIORITY.CRITICAL]: { label: "Critical", color: "error"   },
};

export default function ReminderPriorityChip({ priority, size = "small" }) {
  // Real API reminders (services/reminderService.js::toUiReminder) never set
  // a `priority` - only mock data does - so an unset value must not render
  // an empty chip.
  const cfg = CONFIG[priority] ?? { label: priority ?? "Normal", color: "default" };
  return <Chip label={cfg.label} color={cfg.color} size={size} />;
}
