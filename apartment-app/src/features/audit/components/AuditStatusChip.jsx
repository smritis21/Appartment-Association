import { Chip } from "@mui/material";
import { AUDIT_STATUS } from "../mock/auditLogs";

const CONFIG = {
  [AUDIT_STATUS.SUCCESS]: { color: "success", label: "Success" },
  [AUDIT_STATUS.FAILED]:  { color: "error",   label: "Failed" },
  [AUDIT_STATUS.PENDING]: { color: "warning", label: "Pending" },
};

export default function AuditStatusChip({ status, size = "small" }) {
  const cfg = CONFIG[status] ?? { color: "default", label: status };
  return <Chip label={cfg.label} color={cfg.color} size={size} />;
}
