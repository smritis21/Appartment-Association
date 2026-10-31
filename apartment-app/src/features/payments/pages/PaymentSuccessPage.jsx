// INT-11: Payment Success - shows real receipt from live API response
import {
  Box, Button, Chip, Divider, Paper, Typography,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDateTime } from "../../../utils/formatDate";
import PageHeader from "../../../components/common/PageHeader";

function Row({ label, value }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Box>
  );
}

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const { state } = useLocation();

  if (!state?.paymentId) {
    navigate("/payments");
    return null;
  }

  const { paymentId, billId, amount, method, transactionId, receiptNo, paidAt } = state;

  return (
    <Box>
      <PageHeader
        title="Payment Successful"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payments", href: "/payments" },
          { label: "Success" },
        ]}
      />

      <Box sx={{ maxWidth: 520, mx: "auto" }}>
        <Paper elevation={2} sx={{ borderRadius: 3, p: 4, textAlign: "center" }}>
          <CheckCircleOutlinedIcon sx={{ fontSize: 72, color: "success.main", mb: 1 }} />
          <Typography variant="h5" fontWeight={700} color="success.main">Payment Successful!</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
            Your payment has been processed successfully.
          </Typography>

          <Divider sx={{ mb: 2 }} />

          <Row label="Payment ID"     value={paymentId} />
          <Row label="Bill Number"    value={billId} />
          <Row label="Amount Paid"    value={formatCurrency(amount)} />
          <Row label="Payment Method" value={<Chip label={method} size="small" variant="outlined" />} />
          {transactionId && <Row label="Transaction ID" value={transactionId} />}
          {receiptNo      && <Row label="Receipt No."   value={receiptNo} />}
          <Row label="Date & Time"    value={formatDateTime(paidAt)} />

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Button variant="contained" startIcon={<ReceiptOutlinedIcon />} fullWidth
              onClick={() => navigate(`/payments/receipt/${paymentId}`)}>
              View Receipt
            </Button>
            <Button variant="text" startIcon={<HomeOutlinedIcon />} fullWidth
              onClick={() => navigate("/payments")}>
              Back to Payments
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

