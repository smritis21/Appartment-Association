import { Chip } from "@mui/material";
import { FLAT_STATUS } from "../mock/flats";

const CONFIG = {
  [FLAT_STATUS.OCCUPIED]:    { label: "Occupied",    color: "success" },
  [FLAT_STATUS.VACANT]:      { label: "Vacant",      color: "warning" },
  [FLAT_STATUS.MAINTENANCE]: { label: "Maintenance", color: "info"    },
  [FLAT_STATUS.RESERVED]:    { label: "Reserved",    color: "default" },
};

export default function FlatStatusChip({ status, size = "small" }) {
  const cfg = CONFIG[status] ?? { label: status, color: "default" };
  return <Chip label={cfg.label} color={cfg.color} size={size} />;
}
