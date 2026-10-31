import {
  Box, Button, Dialog, DialogContent, DialogTitle, Divider,
  IconButton, Typography,
} from "@mui/material";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDateTime } from "../../../utils/formatDate";

function Row({ label, value }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.6 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Box>
  );
}

export default function ReceiptDialog({ open, onClose, receipt, resident, bill }) {
  if (!receipt) return null;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="subtitle1" fontWeight={700}>Payment Receipt</Typography>
        <IconButton size="small" onClick={onClose}><CloseOutlinedIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ textAlign: "center", mb: 2 }}>
          <CheckCircleOutlinedIcon sx={{ color: "success.main", fontSize: 48 }} />
          <Typography variant="h6" fontWeight={700} color="success.main">Payment Successful</Typography>
          <Typography variant="body2" color="text.secondary">{receipt.association}</Typography>
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Row label="Receipt ID"      value={receipt.id} />
        <Row label="Payment ID"      value={receipt.paymentId} />
        <Row label="Transaction ID"  value={receipt.transactionId} />
        <Row label="Bill Number"     value={receipt.billId} />
        <Row label="Resident"        value={resident?.name ?? "-"} />
        <Row label="Flat"            value={resident ? `Wing ${resident.wing} · Flat ${resident.flat}` : "-"} />
        <Row label="Payment Method"  value={receipt.method} />
        <Row label="Amount Paid"     value={formatCurrency(receipt.amount)} />
        <Row label="GST"             value={formatCurrency(receipt.gst)} />
        <Row label="Paid On"         value={formatDateTime(receipt.issuedAt)} />
        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
          <Button variant="outlined" size="small" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
            Print
          </Button>
          <Button variant="contained" size="small" startIcon={<DownloadOutlinedIcon />} onClick={() => {}}>
            Download
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}

