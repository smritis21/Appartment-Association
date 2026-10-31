import { Chip } from "@mui/material";
import { BILL_STATUS } from "../mock/bills";

const CONFIG = {
  [BILL_STATUS.PAID]:           { label: "Paid",           color: "success" },
  [BILL_STATUS.PENDING]:        { label: "Pending",        color: "warning" },
  [BILL_STATUS.OVERDUE]:        { label: "Overdue",        color: "error"   },
  [BILL_STATUS.PARTIALLY_PAID]: { label: "Partially Paid", color: "info"    },
};

export default function BillStatusChip({ status, size = "small" }) {
  const cfg = CONFIG[status] ?? { label: status, color: "default" };
  return <Chip label={cfg.label} color={cfg.color} size={size} />;
}
