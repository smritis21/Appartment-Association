import { Chip } from "@mui/material";
import { DOC_STATUS } from "../mock/documents";

const CONFIG = {
  [DOC_STATUS.VERIFIED]: { label: "Verified", color: "success" },
  [DOC_STATUS.PENDING]:  { label: "Pending",  color: "warning" },
  [DOC_STATUS.REJECTED]: { label: "Rejected", color: "error"   },
  [DOC_STATUS.ARCHIVED]: { label: "Archived", color: "default" },
};

export default function DocumentStatusChip({ status, size = "small" }) {
  const cfg = CONFIG[status] ?? { label: status, color: "default" };
  return <Chip label={cfg.label} color={cfg.color} size={size} />;
}
