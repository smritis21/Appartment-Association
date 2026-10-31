import { Box, Chip, Divider, Paper, Typography } from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { formatDate } from "../../../utils/formatDate";
import { formatCurrency } from "../../../utils/formatCurrency";

export default function ReceiptCard({ receipt, residentName }) {
  if (!receipt) return null;
  return (
    <Paper elevation={1} sx={{ borderRadius: 3, p: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
        <CheckCircleOutlinedIcon sx={{ color: "success.main", fontSize: 32 }} />
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>Payment Received</Typography>
          <Typography variant="caption" color="text.secondary">{receipt.id}</Typography>
        </Box>
        <Chip label="Paid" color="success" size="small" sx={{ ml: "auto" }} />
      </Box>
      <Divider sx={{ mb: 2 }} />
      {[
        ["Resident",    residentName ?? "-"],
        ["Bill Ref",    receipt.billId],
        ["Amount Paid", formatCurrency(receipt.amount)],
        ["Paid On",     formatDate(receipt.paidDate)],
        ["Mode",        receipt.mode],
        ["Reference",   receipt.ref],
      ].map(([label, value]) => (
        <Box key={label} sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="body2" fontWeight={600}>{value}</Typography>
        </Box>
      ))}
    </Paper>
  );
}

