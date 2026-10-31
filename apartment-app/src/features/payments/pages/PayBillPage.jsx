import {
  Alert, Box, Button, CircularProgress, Grid, Paper, Typography,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useResidents } from "../../../context/ResidentContext";
import { fetchBill, processPayment } from "../../../services/paymentService";
import { isOffline, ApiError } from "../../../services/apiClient";
import { getBillById, getBillTotal, BILL_STATUS } from "../../billing/mock/bills";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDate } from "../../../utils/formatDate";
import PageHeader from "../../../components/common/PageHeader";
import BillStatusChip from "../../billing/components/BillStatusChip";
import PaymentSummaryCard from "../components/PaymentSummaryCard";
import PaymentForm from "../components/PaymentForm";

// Map UI method labels to backend enum values
const METHOD_MAP = {
  "UPI":           "upi",
  "Credit Card":   "online_transfer",
  "Debit Card":    "online_transfer",
  "Net Banking":   "online_transfer",
  "Wallet":        "online_transfer",
  "Cash":          "cash",
  "Cheque":        "cheque",
  "online_transfer": "online_transfer",
  "upi":           "upi",
  "cash":          "cash",
  "cheque":        "cheque",
};

export default function PayBillPage() {
  const { billId } = useParams();
  const navigate = useNavigate();
  const { getResidentById } = useResidents();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    fetchBill(billId)
      .then((data) => { setBill(data); setOffline(false); })
      .catch((err) => {
        if (isOffline(err)) {
          const mockBill = getBillById(billId);
          if (mockBill) {
            setBill({
              id: mockBill.id,
              residentId: mockBill.residentId,
              billingMonth: mockBill.billingMonth,
              total: getBillTotal(mockBill),
              dueDate: mockBill.dueDate,
              status: mockBill.status,
              gst: mockBill.gst,
              maintenance: mockBill.maintenance,
              water: mockBill.water,
              parking: mockBill.parking,
              miscellaneous: mockBill.miscellaneous,
              discount: mockBill.discount,
              payments: [],
            });
            setOffline(true);
          } else {
            setError("Bill not found.");
          }
        } else {
          setError(err.detail ?? "Failed to load bill.");
        }
      })
      .finally(() => setLoading(false));
  }, [billId]);

  const resident = bill ? getResidentById(bill.residentId) : null;

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  }

  if (error || !bill) {
    return (
      <Box>
        <PageHeader title="Bill Not Found" breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Payments", href: "/payments" }, { label: "Pay Bill" }]} />
        <Alert severity="error">{error ?? `Bill "${billId}" does not exist.`}</Alert>
        <Button sx={{ mt: 2 }} startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/payments")}>Back to Payments</Button>
      </Box>
    );
  }

  if (bill.status === BILL_STATUS.PAID || bill.status === "paid") {
    return (
      <Box>
        <PageHeader title={`Pay Bill - ${bill.id}`} breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Payments", href: "/payments" }, { label: bill.id }]} />
        <Alert severity="info">This bill has already been paid.</Alert>
        <Button sx={{ mt: 2 }} startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/payments")}>Back to Payments</Button>
      </Box>
    );
  }

  const handleSubmit = async ({ method }) => {
    setSubmitting(true);
    setError(null);
    const backendMethod = METHOD_MAP[method] ?? "upi";
    const total = bill.total ?? getBillTotal(bill);

    if (offline) {
      // Fallback: simulate success locally
      setTimeout(() => {
        setSubmitting(false);
        navigate("/payments/success", {
          state: {
            paymentId: `PMNT-${Date.now()}`,
            billId: bill.id,
            amount: total,
            method,
            transactionId: `TXN${Math.floor(Math.random() * 9000000 + 1000000)}`,
            paidAt: new Date().toISOString(),
          },
        });
      }, 1500);
      return;
    }

    try {
      const receipt = await processPayment(bill.id, total, backendMethod);
      navigate("/payments/success", {
        state: {
          paymentId:     receipt.id,
          billId:        bill.id,
          amount:        receipt.amount,
          method:        receipt.method,
          transactionId: receipt.transactionId,
          receiptNo:     receipt.receiptNo,
          paidAt:        receipt.paidAt,
        },
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.detail ?? "Payment failed. Please try again.");
      } else {
        setError("Could not reach the payment gateway. Please try again.");
      }
      setSubmitting(false);
    }
  };

  const total = bill.total ?? getBillTotal(bill);

  return (
    <Box>
      <PageHeader
        title={`Pay Bill - ${bill.id}`}
        subtitle={`${bill.billingMonth} · ${resident?.name ?? "Unknown Resident"}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Payments", href: "/payments" },
          { label: bill.id },
        ]}
        action={
          <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/payments")}>
            Back
          </Button>
        }
      />

      {offline && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Backend unreachable - payment will be simulated locally.
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Left - Bill Info */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper elevation={1} sx={{ borderRadius: 3, p: 3, mb: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Resident Details</Typography>
            </Box>
            <Grid container spacing={1.5}>
              {[
                ["Name",  resident?.name ?? "-"],
                ["Wing",  resident?.wing ? `Wing ${resident.wing}` : "-"],
                ["Flat",  resident?.flat ?? "-"],
                ["Email", resident?.email ?? "-"],
                ["Phone", resident?.phone ?? "-"],
              ].map(([label, value]) => (
                <Grid size={6} key={label}>
                  <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                  <Typography variant="body2" fontWeight={600}>{value}</Typography>
                </Grid>
              ))}
            </Grid>
          </Paper>

          <Paper elevation={1} sx={{ borderRadius: 3, p: 3, mb: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Bill Details</Typography>
              <BillStatusChip status={bill.status} />
            </Box>
            <Grid container spacing={1.5}>
              {[
                ["Bill Number",   bill.id],
                ["Billing Month", bill.billingMonth],
                ["Due Date",      formatDate(bill.dueDate)],
                ["Grand Total",   formatCurrency(total)],
              ].map(([label, value]) => (
                <Grid size={6} key={label}>
                  <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                  <Typography variant="body2" fontWeight={600} fontFamily={label === "Bill Number" ? "monospace" : undefined}>
                    {value}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          </Paper>

          <Paper elevation={1} sx={{ borderRadius: 3, p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Payment Details</Typography>
            <PaymentForm onSubmit={handleSubmit} loading={submitting} />
          </Paper>
        </Grid>

        {/* Right - Summary */}
        <Grid size={{ xs: 12, md: 5 }}>
          <PaymentSummaryCard bill={bill} />
        </Grid>
      </Grid>
    </Box>
  );
}

