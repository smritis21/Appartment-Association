// INT-28: Invoice Detail - live API with mock fallback + late fee display
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Grid, Paper, Typography,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useResidents } from "../../../context/ResidentContext";
import { fetchBill, fetchLateFee } from "../../../services/paymentService";
import { fetchResident } from "../../../services/residentService";
import { isOffline } from "../../../services/apiClient";
import { getBillById, getBillTotal, BILL_STATUS } from "../mock/bills";
import { getReceiptByBillId } from "../mock/receipts";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDate } from "../../../utils/formatDate";
import PageHeader from "../../../components/common/PageHeader";
import BillStatusChip from "../components/BillStatusChip";
import BillSummaryCard from "../components/BillSummaryCard";
import ReceiptCard from "../components/ReceiptCard";
import { ROLE_LABELS } from "../../auth/mock/roles";

function PaymentTimeline({ bill }) {
  const isPaid    = bill.status === BILL_STATUS.PAID || bill.status === "paid";
  const isOverdue = bill.status === BILL_STATUS.OVERDUE || bill.status === "overdue";

  const steps = [
    { label: "Bill Generated",   done: true,              date: bill.billingMonth },
    { label: "Due Date",         done: isPaid || isOverdue, date: formatDate(bill.dueDate), warn: isOverdue && !isPaid },
    { label: "Payment Received", done: isPaid,             date: isPaid ? formatDate(bill.paidDate) : "-" },
  ];

  return (
    <Paper elevation={1} sx={{ borderRadius: 3, p: 3 }}>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Payment Timeline</Typography>
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0 }}>
        {steps.map((step, i) => (
          <Box key={step.label} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <Box sx={{ display: "flex", alignItems: "center", width: "100%" }}>
              {i > 0 && (
                <Box sx={{ flex: 1, height: 2, bgcolor: step.done ? (step.warn ? "error.main" : "success.main") : "divider" }} />
              )}
              <Box sx={{
                width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                bgcolor: step.done ? (step.warn ? "error.main" : "success.main") : "action.disabledBackground",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {step.done
                  ? (step.warn
                    ? <ErrorOutlineOutlinedIcon sx={{ color: "white", fontSize: 16 }} />
                    : <CheckCircleOutlinedIcon sx={{ color: "white", fontSize: 16 }} />)
                  : <HourglassEmptyOutlinedIcon sx={{ color: "text.disabled", fontSize: 16 }} />
                }
              </Box>
              {i < steps.length - 1 && (
                <Box sx={{ flex: 1, height: 2, bgcolor: steps[i + 1].done ? (steps[i + 1].warn ? "error.main" : "success.main") : "divider" }} />
              )}
            </Box>
            <Typography variant="caption" fontWeight={600} sx={{ mt: 0.75, textAlign: "center" }}>{step.label}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>{step.date}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getResidentById } = useResidents();

  const [bill, setBill] = useState(null);
  const [apiResident, setApiResident] = useState(null);
  const [lateFee, setLateFee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchBill(id)
      .then((data) => {
        setBill(data);
        if (data.residentId) {
          fetchResident(data.residentId).then(setApiResident).catch(() => {});
        }
        if (data.status === "overdue" || data.status === BILL_STATUS.OVERDUE) {
          fetchLateFee(id).then(setLateFee).catch(() => {});
        }
      })
      .catch((err) => {
        if (isOffline(err)) {
          const mock = getBillById(id);
          if (mock) setBill(mock);
          else setError(`Bill ID "${id}" does not exist.`);
        } else {
          const mock = getBillById(id);
          if (mock) setBill(mock);
          else setError(`Bill ID "${id}" does not exist.`);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  }

  if (error || !bill) {
    return (
      <Box>
        <PageHeader title="Invoice Not Found"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Billing", href: "/billing" }, { label: "Invoice" }]} />
        <Alert severity="error">{error ?? `Bill ID "${id}" does not exist.`}</Alert>
        <Button sx={{ mt: 2 }} startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/billing")}>
          Back to Billing
        </Button>
      </Box>
    );
  }

  const resident = apiResident ?? (bill.residentId ? getResidentById(bill.residentId) : null);
  const receipt  = getReceiptByBillId(bill.id);
  const total    = bill.total ?? getBillTotal(bill);
  // Human-readable invoice number (Bug 18) - the raw bill.id (a UUID) stays
  // available for API calls/URLs, but is never shown to the user as "the"
  // invoice number.
  const billNo   = bill.billNo ?? bill.id;

  return (
    <Box>
      <PageHeader
        title={`Invoice - ${billNo}`}
        subtitle={`${bill.billingMonth} · ${resident?.name ?? "Unknown Resident"}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Billing", href: "/billing" },
          { label: billNo },
        ]}
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/billing")}>Back</Button>
            <Button variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>Print</Button>
          </Box>
        }
      />

      {lateFee && Number(lateFee.late_fee ?? 0) > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Late fee of <strong>{formatCurrency(Number(lateFee.late_fee))}</strong> applies
          ({lateFee.days_overdue} days overdue). Total payable: <strong>{formatCurrency(Number(lateFee.total_payable))}</strong>.
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper elevation={1} sx={{ borderRadius: 3, p: 3, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Resident Details</Typography>
            <Grid container spacing={1.5}>
              {[
                ["Name",  resident?.name ?? "-"],
                ["Role",  ROLE_LABELS?.[resident?.role] ?? resident?.role ?? "-"],
                ["Wing",  resident?.wing ? `Wing ${resident.wing}` : "-"],
                ["Flat",  resident?.flat ?? "-"],
                ["Email", resident?.email ?? "-"],
                ["Phone", resident?.phone ?? "-"],
              ].map(([label, value]) => (
                <Grid size={{ xs: 6 }} key={label}>
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
                ["Bill No.",      billNo],
                ["Billing Month", bill.billingMonth],
                ["Due Date",      formatDate(bill.dueDate)],
                ["Paid Date",     formatDate(bill.paidDate)],
                ["Payment Ref",   bill.paymentRef ?? "-"],
              ].map(([label, value]) => (
                <Grid size={{ xs: 6 }} key={label}>
                  <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                  <Typography variant="body2" fontWeight={600}
                    fontFamily={label === "Bill No." || label === "Payment Ref" ? "monospace" : undefined}>
                    {value}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          </Paper>

          <PaymentTimeline bill={bill} />
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <BillSummaryCard bill={bill} />
          {receipt && (
            <Box sx={{ mt: 3 }}>
              <ReceiptCard receipt={receipt} residentName={resident?.name} />
            </Box>
          )}
          {(bill.status === "pending" || bill.status === BILL_STATUS.PENDING || bill.status === "overdue" || bill.status === BILL_STATUS.OVERDUE) && (
            <Button variant="contained" fullWidth sx={{ mt: 2 }} onClick={() => navigate(`/payments/pay/${bill.id}`)}>
              Pay Now - {formatCurrency(total)}
            </Button>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

