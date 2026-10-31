// INT-11/INT-28: Receipt Page - live API with mock fallback
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Grid, Paper, Typography,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useResidents } from "../../../context/ResidentContext";
import { fetchReceipt, fetchPayment } from "../../../services/paymentService";
import { isOffline } from "../../../services/apiClient";
import { getReceiptByPaymentId } from "../mock/receipts";
import { getBillById } from "../../billing/mock/bills";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDateTime } from "../../../utils/formatDate";
import PageHeader from "../../../components/common/PageHeader";
import appConfig from "../../../config/appConfig";

function InfoRow({ label, value, mono = false }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600} fontFamily={mono ? "monospace" : undefined}>{value}</Typography>
    </Box>
  );
}

export default function ReceiptPage() {
  const { paymentId } = useParams();
  const navigate = useNavigate();
  const { getResidentById } = useResidents();

  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Try /payments/{id}/receipt first, fall back to /payments/{id}, then mock
    fetchReceipt(paymentId)
      .then((data) => {
        setReceipt({
          id:            data.receipt_no ?? paymentId,
          paymentId:     data.payment_id ?? paymentId,
          billId:        data.bill_id,
          residentId:    data.resident_id,
          amount:        Number(data.amount_paid ?? data.amount ?? 0),
          gst:           Number(data.gst ?? 0),
          method:        data.payment_method ?? data.method,
          transactionId: data.transaction_ref ?? data.receipt_no,
          issuedAt:      data.paid_on ?? data.created_at,
          association:   appConfig.appName,
        });
      })
      .catch(() =>
        fetchPayment(paymentId)
          .then((p) => {
            setReceipt({
              id:            p.receiptNo ?? p.id,
              paymentId:     p.id,
              billId:        p.billId,
              residentId:    p.residentId,
              amount:        p.amount,
              gst:           0,
              method:        p.method,
              transactionId: p.transactionId,
              issuedAt:      p.paidAt,
              association:   appConfig.appName,
            });
          })
          .catch((err) => {
            if (isOffline(err)) {
              const mock = getReceiptByPaymentId(paymentId);
              if (mock) setReceipt(mock);
              else setError(`Receipt for payment "${paymentId}" does not exist.`);
            } else {
              setError(`Receipt for payment "${paymentId}" does not exist.`);
            }
          })
      )
      .finally(() => setLoading(false));
  }, [paymentId]);

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  }

  if (error || !receipt) {
    return (
      <Box>
        <PageHeader title="Receipt Not Found"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Payments", href: "/payments" }, { label: "Receipt" }]} />
        <Alert severity="error">{error ?? `Receipt for payment "${paymentId}" does not exist.`}</Alert>
        <Button sx={{ mt: 2 }} startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/payments")}>
          Back to Payments
        </Button>
      </Box>
    );
  }

  const resident = receipt.residentId ? getResidentById(receipt.residentId) : null;
  const bill = receipt.billId ? getBillById(receipt.billId) : null;

  return (
    <Box>
      <PageHeader
        title={`Receipt - ${receipt.id}`}
        subtitle={`Payment for ${bill?.billingMonth ?? receipt.billId ?? ""}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payments", href: "/payments" },
          { label: receipt.id },
        ]}
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/payments")}>Back</Button>
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>Print</Button>
          </Box>
        }
      />

      <Box sx={{ maxWidth: 680, mx: "auto" }}>
        <Paper elevation={2} sx={{ borderRadius: 3, p: 4 }}>
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Typography variant="h6" fontWeight={800} color="primary.main">{appConfig.appName}</Typography>
            <Typography variant="body2" color="text.secondary">{receipt.association}</Typography>
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1, mt: 1.5 }}>
              <CheckCircleOutlinedIcon sx={{ color: "success.main", fontSize: 28 }} />
              <Typography variant="subtitle1" fontWeight={700} color="success.main">Payment Receipt</Typography>
            </Box>
          </Box>

          <Divider sx={{ mb: 3 }} />

          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                Resident Details
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" fontWeight={700}>{resident?.name ?? "-"}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {resident ? `Wing ${resident.wing}, Flat ${resident.flat}` : "-"}
                </Typography>
                <Typography variant="body2" color="text.secondary">{resident?.email ?? ""}</Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
                Receipt Details
              </Typography>
              <Box sx={{ mt: 1 }}>
                <InfoRow label="Receipt ID"  value={receipt.id}        mono />
                <InfoRow label="Payment ID"  value={receipt.paymentId} mono />
                <InfoRow label="Issued On"   value={formatDateTime(receipt.issuedAt)} />
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Payment Details
          </Typography>
          <Box sx={{ mt: 1.5 }}>
            <InfoRow label="Bill Number"    value={receipt.billId}         mono />
            <InfoRow label="Transaction ID" value={receipt.transactionId}  mono />
            <InfoRow label="Payment Method" value={receipt.method} />
            {bill?.billingMonth && <InfoRow label="Billing Month" value={bill.billingMonth} />}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Amount
          </Typography>
          <Box sx={{ mt: 1.5 }}>
            {receipt.gst > 0 && (
              <>
                <InfoRow label="Subtotal"  value={formatCurrency(receipt.amount - receipt.gst)} />
                <InfoRow label="GST"       value={formatCurrency(receipt.gst)} />
                <Divider sx={{ my: 1 }} />
              </>
            )}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="subtitle1" fontWeight={700}>Total Paid</Typography>
              <Typography variant="h6" fontWeight={800} color="success.main">{formatCurrency(receipt.amount)}</Typography>
            </Box>
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ textAlign: "center" }}>
            <Chip label="PAID" color="success" sx={{ fontWeight: 700, px: 2 }} />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              This is a computer-generated receipt and does not require a signature.
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

