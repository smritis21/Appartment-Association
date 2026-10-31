import { Box, Chip, Divider, Paper, Typography } from "@mui/material";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDateTime } from "../../../utils/formatDate";
import PaymentStatusChip from "./PaymentStatusChip";

export default function PaymentCard({ payment, residentName }) {
  return (
    <Paper elevation={1} sx={{ borderRadius: 3, p: 2.5 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
        <Box>
          <Typography variant="caption" fontFamily="monospace" fontWeight={700} color="text.secondary">
            {payment.id}
          </Typography>
          <Typography variant="body2" fontWeight={600}>{residentName ?? "-"}</Typography>
        </Box>
        <PaymentStatusChip status={payment.status} />
      </Box>
      <Divider sx={{ my: 1 }} />
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="body2" color="text.secondary">Bill</Typography>
        <Typography variant="body2" fontFamily="monospace">{payment.billId}</Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
        <Typography variant="body2" color="text.secondary">Amount</Typography>
        <Typography variant="body2" fontWeight={700}>{formatCurrency(payment.amount)}</Typography>
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
        <Typography variant="body2" color="text.secondary">Method</Typography>
        <Chip label={payment.method} size="small" variant="outlined" />
      </Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
        <Typography variant="body2" color="text.secondary">Date</Typography>
        <Typography variant="body2">{formatDateTime(payment.paidAt)}</Typography>
      </Box>
    </Paper>
  );
}

