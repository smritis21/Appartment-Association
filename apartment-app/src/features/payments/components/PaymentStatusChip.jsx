import { Chip } from "@mui/material";
import { PAYMENT_STATUS } from "../mock/payments";

const CONFIG = {
  [PAYMENT_STATUS.PAID]:     { label: "Paid",     color: "success" },
  [PAYMENT_STATUS.PENDING]:  { label: "Pending",  color: "warning" },
  [PAYMENT_STATUS.FAILED]:   { label: "Failed",   color: "error"   },
  [PAYMENT_STATUS.REFUNDED]: { label: "Refunded", color: "info"    },
};

export default function PaymentStatusChip({ status, size = "small" }) {
  const cfg = CONFIG[status] ?? { label: status, color: "default" };
  return <Chip label={cfg.label} color={cfg.color} size={size} />;
}
