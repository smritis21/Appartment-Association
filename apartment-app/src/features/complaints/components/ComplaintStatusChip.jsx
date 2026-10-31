import { Chip } from "@mui/material";
import { COMPLAINT_STATUS, STATUS_LABELS } from "../mock/complaints";

const STATUS_COLORS = {
  [COMPLAINT_STATUS.SUBMITTED]: "default",
  [COMPLAINT_STATUS.ASSIGNED]: "info",
  [COMPLAINT_STATUS.IN_PROGRESS]: "warning",
  [COMPLAINT_STATUS.RESOLVED]: "success",
  [COMPLAINT_STATUS.CLOSED]: "secondary",
};

export default function ComplaintStatusChip({ status, size = "small" }) {
  return (
    <Chip
      label={STATUS_LABELS[status] ?? status}
      color={STATUS_COLORS[status] ?? "default"}
      size={size}
      variant={status === COMPLAINT_STATUS.SUBMITTED ? "outlined" : "filled"}
      sx={{ fontWeight: 600 }}
    />
  );
}
