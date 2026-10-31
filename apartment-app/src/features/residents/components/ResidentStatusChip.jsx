import { Chip } from "@mui/material";
import { RESIDENT_STATUS } from "../mock/residents";

const CONFIG = {
  [RESIDENT_STATUS.ACTIVE]:    { label: "Active",    color: "success" },
  [RESIDENT_STATUS.INACTIVE]:  { label: "Inactive",  color: "warning" },
  [RESIDENT_STATUS.MOVED_OUT]: { label: "Moved Out", color: "default" },
};

export default function ResidentStatusChip({ status, size = "small" }) {
  const cfg = CONFIG[status] ?? { label: status, color: "default" };
  return <Chip label={cfg.label} color={cfg.color} size={size} />;
}
