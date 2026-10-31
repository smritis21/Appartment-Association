import {
  Box, Button, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Grid, Typography,
} from "@mui/material";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import { formatDate } from "../../../utils/formatDate";
import { formatCurrency } from "../../../utils/formatCurrency";
import { getBillTotal } from "../mock/bills";
import BillStatusChip from "./BillStatusChip";
import { ROLE_LABELS } from "../../auth/mock/roles";

function Row({ label, value, bold = false, color }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={bold ? 700 : 400} color={color ?? "text.primary"}>
        {value}
      </Typography>
    </Box>
  );
}

export default function InvoicePreviewDialog({ open, onClose, bill, resident }) {
  if (!bill || !resident) return null;
  const total = getBillTotal(bill);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        Invoice Preview
        <Typography variant="caption" color="text.secondary" display="block">
          {bill.id} · {bill.billingMonth}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        {/* Resident info */}
        <Box sx={{ bgcolor: "primary.light", borderRadius: 2, p: 2, mb: 2.5 }}>
          <Grid container spacing={1}>
            {[
              ["Resident",  resident.name],
              ["Role",      ROLE_LABELS[resident.role] ?? resident.role],
              ["Flat",      `Wing ${resident.wing} · ${resident.flat}`],
              ["Email",     resident.email],
              ["Due Date",  formatDate(bill.dueDate)],
              ["Status",    null],
            ].map(([label, value]) => (
              <Grid size={{ xs: 6 }} key={label}>
                <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                {label === "Status"
                  ? <BillStatusChip status={bill.status} />
                  : <Typography variant="body2" fontWeight={600}>{value}</Typography>
                }
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Line items */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Charges</Typography>
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

        {bill.paidDate && (
          <Box sx={{ mt: 2, p: 1.5, bgcolor: "success.50", border: "1px solid", borderColor: "success.main", borderRadius: 2 }}>
            <Typography variant="caption" color="success.main" fontWeight={600}>
              Paid on {formatDate(bill.paidDate)} · Ref: {bill.paymentRef}
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">Close</Button>
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
          Print
        </Button>
      </DialogActions>
    </Dialog>
  );
}
