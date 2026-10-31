import { Box, Divider, Paper, Typography } from "@mui/material";
import { formatCurrency } from "../../../utils/formatCurrency";
import { getBillTotal } from "../mock/bills";
import BillStatusChip from "./BillStatusChip";

function Row({ label, value, bold = false, color = "text.primary" }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={bold ? 700 : 400} color={color}>
        {value}
      </Typography>
    </Box>
  );
}

export default function BillSummaryCard({ bill }) {
  const total = getBillTotal(bill);
  return (
    <Paper elevation={1} sx={{ borderRadius: 3, p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="subtitle1" fontWeight={700}>Bill Summary</Typography>
        <BillStatusChip status={bill.status} />
      </Box>
      <Divider sx={{ mb: 1.5 }} />
      <Row label="Maintenance Fee"  value={formatCurrency(bill.maintenance)} />
      <Row label="Water Charges"    value={formatCurrency(bill.water)} />
      <Row label="Parking Charges"  value={formatCurrency(bill.parking)} />
      <Row label="Miscellaneous"    value={formatCurrency(bill.miscellaneous)} />
      {bill.discount > 0 && (
        <Row label="Discount" value={`− ${formatCurrency(bill.discount)}`} color="success.main" />
      )}
      <Row label="GST (18%)" value={formatCurrency(bill.gst)} />
      <Divider sx={{ my: 1.5 }} />
      <Row label="Total Amount" value={formatCurrency(total)} bold />
    </Paper>
  );
}
