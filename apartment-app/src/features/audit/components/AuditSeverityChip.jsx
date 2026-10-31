import { Chip } from "@mui/material";
import { AUDIT_SEVERITY } from "../mock/auditLogs";

const CONFIG = {
  [AUDIT_SEVERITY.INFO]:     { color: "info",    label: "Info" },
  [AUDIT_SEVERITY.WARNING]:  { color: "warning", label: "Warning" },
  [AUDIT_SEVERITY.CRITICAL]: { color: "error",   label: "Critical" },
};

export default function AuditSeverityChip({ severity, size = "small" }) {
  const cfg = CONFIG[severity] ?? { color: "default", label: severity };
  return <Chip label={cfg.label} color={cfg.color} size={size} />;
}
