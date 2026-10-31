import { Box, Divider, Paper, Typography } from "@mui/material";
import { formatCurrency } from "../../../utils/formatCurrency";
import { getBillTotal } from "../../billing/mock/bills";

function Row({ label, value, bold = false, color = "text.primary" }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={bold ? 700 : 400} color={color}>{value}</Typography>
    </Box>
  );
}

export default function PaymentSummaryCard({ bill }) {
  const total = getBillTotal(bill);
  return (
    <Paper elevation={1} sx={{ borderRadius: 3, p: 3 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Payment Summary</Typography>
      <Divider sx={{ mb: 1.5 }} />
      <Row label="Maintenance Fee" value={formatCurrency(bill.maintenance)} />
      <Row label="Water Charges"   value={formatCurrency(bill.water)} />
      <Row label="Parking Charges" value={formatCurrency(bill.parking)} />
      <Row label="Miscellaneous"   value={formatCurrency(bill.miscellaneous)} />
      {bill.discount > 0 && (
        <Row label="Discount" value={`− ${formatCurrency(bill.discount)}`} color="success.main" />
      )}
      <Row label="GST (18%)" value={formatCurrency(bill.gst)} />
      <Divider sx={{ my: 1.5 }} />
      <Row label="Total Payable" value={formatCurrency(total)} bold />
    </Paper>
  );
}
