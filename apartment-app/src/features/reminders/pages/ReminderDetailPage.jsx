import {
  Alert, Box, Button, Chip, Divider, Grid, Paper, Snackbar, Typography,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import DoneOutlinedIcon from "@mui/icons-material/DoneOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import { useCallback, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useResidents } from "../../../context/ResidentContext";
import { getReminderById, getAllReminders, setReminderState, REMINDER_STATUS, REMINDER_TYPE } from "../mock/reminders";
import { getBillById, getBillTotal, BILL_STATUS } from "../../billing/mock/bills";
import { getPaymentByBillId } from "../../payments/mock/payments";
import { getReceiptByBillId } from "../../payments/mock/receipts";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDate, formatDateTime } from "../../../utils/formatDate";
import PageHeader from "../../../components/common/PageHeader";
import BillStatusChip from "../../billing/components/BillStatusChip";
import ReminderStatusChip from "../components/ReminderStatusChip";
import ReminderPriorityChip from "../components/ReminderPriorityChip";
import ReminderTimeline from "../components/ReminderTimeline";

const TYPE_LABELS = {
  [REMINDER_TYPE.UPCOMING]:         "Upcoming Payment",
  [REMINDER_TYPE.DUE_TODAY]:        "Due Today",
  [REMINDER_TYPE.OVERDUE]:          "Overdue",
  [REMINDER_TYPE.PAYMENT_RECEIVED]: "Payment Received",
  [REMINDER_TYPE.FINAL_REMINDER]:   "Final Reminder",
};

const ACTION_LABELS = {
  pay_now:      "Pay this bill immediately to avoid further penalties.",
  view_receipt: "Payment has been received. You can view or download the receipt.",
};

function InfoRow({ label, value }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Box>
  );
}

export default function ReminderDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getResidentById } = useResidents();
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  // Re-read on every render so mutations are reflected
  const reminder  = getReminderById(id);
  const bill      = reminder ? getBillById(reminder.billId) : null;
  const resident  = reminder ? getResidentById(reminder.residentId) : null;
  const payment   = bill ? getPaymentByBillId(bill.id) : null;
  const receipt   = bill ? getReceiptByBillId(bill.id) : null;

  // All reminders for the same bill (for timeline)
  const billReminders = useMemo(() => {
    if (!bill) return [];
    return getAllReminders().filter((r) => r.billId === bill.id);
  }, [bill]);

  const handleMarkRead = useCallback(() => {
    setReminderState(id, REMINDER_STATUS.READ);
    setToast({ open: true, message: "Marked as read.", severity: "success" });
  }, [id]);

  const handleDismiss = useCallback(() => {
    setReminderState(id, REMINDER_STATUS.DISMISSED);
    setToast({ open: true, message: "Reminder dismissed.", severity: "info" });
    setTimeout(() => navigate("/reminders"), 800);
  }, [id, navigate]);

  if (!reminder) {
    return (
      <Box>
        <PageHeader
          title="Reminder Not Found"
          breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reminders", href: "/reminders" }, { label: "Detail" }]}
        />
        <Alert severity="error">Reminder "{id}" does not exist.</Alert>
        <Button sx={{ mt: 2 }} startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/reminders")}>
          Back to Reminders
        </Button>
      </Box>
    );
  }

  const isDismissed = reminder.status === REMINDER_STATUS.DISMISSED;
  const isPaid      = bill?.status === BILL_STATUS.PAID;

  return (
    <Box>
      <PageHeader
        title={reminder.title}
        subtitle={TYPE_LABELS[reminder.type] ?? reminder.type}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reminders", href: "/reminders" },
          { label: reminder.id },
        ]}
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/reminders")}>
              Back
            </Button>
            {reminder.status === REMINDER_STATUS.UNREAD && (
              <Button variant="outlined" startIcon={<DoneOutlinedIcon />} onClick={handleMarkRead}>
                Mark Read
              </Button>
            )}
            {!isDismissed && (
              <Button variant="outlined" color="inherit" startIcon={<CloseOutlinedIcon />} onClick={handleDismiss}>
                Dismiss
              </Button>
            )}
          </Box>
        }
      />

      <Grid container spacing={3}>
        {/* Left column */}
        <Grid size={{ xs: 12, md: 7 }}>
          {/* Reminder Info */}
          <Paper elevation={1} sx={{ borderRadius: 3, p: 3, mb: 3 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700}>Reminder Details</Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <ReminderPriorityChip priority={reminder.priority} />
                <ReminderStatusChip status={reminder.status} />
              </Box>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{reminder.description}</Typography>
            <Grid container spacing={1.5}>
              {[
                ["Reminder ID",  reminder.id],
                ["Type",         TYPE_LABELS[reminder.type] ?? reminder.type],
                ["Sent At",      formatDateTime(reminder.sentAt)],
                ["Bill Number",  reminder.billId],
              ].map(([label, value]) => (
                <Grid size={6} key={label}>
                  <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
                  <Typography variant="body2" fontWeight={600}
                    fontFamily={label === "Reminder ID" || label === "Bill Number" ? "monospace" : undefined}>
                    {value}
                  </Typography>
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Resident Info */}
          <Paper elevation={1} sx={{ borderRadius: 3, p: 3, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Resident Details</Typography>
            <Divider sx={{ mb: 2 }} />
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

          {/* Timeline */}
          {bill && <ReminderTimeline bill={bill} reminders={billReminders} />}
        </Grid>

        {/* Right column */}
        <Grid size={{ xs: 12, md: 5 }}>
          {/* Bill Info */}
          {bill && (
            <Paper elevation={1} sx={{ borderRadius: 3, p: 3, mb: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Related Bill</Typography>
                <BillStatusChip status={bill.status} />
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              <InfoRow label="Bill Number"   value={bill.id} />
              <InfoRow label="Billing Month" value={bill.billingMonth} />
              <InfoRow label="Due Date"      value={formatDate(bill.dueDate)} />
              <InfoRow label="Amount"        value={formatCurrency(getBillTotal(bill))} />
              {isPaid && <InfoRow label="Paid On" value={formatDate(bill.paidDate)} />}
              <Divider sx={{ my: 1.5 }} />
              <Button
                fullWidth variant="outlined" size="small"
                onClick={() => navigate(`/billing/invoice/${bill.id}`)}
              >
                View Invoice
              </Button>
            </Paper>
          )}

          {/* Payment Info */}
          {payment && (
            <Paper elevation={1} sx={{ borderRadius: 3, p: 3, mb: 3 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Related Payment</Typography>
              <Divider sx={{ mb: 1.5 }} />
              <InfoRow label="Payment ID"    value={payment.id} />
              <InfoRow label="Amount"        value={formatCurrency(payment.amount)} />
              <InfoRow label="Method"        value={<Chip label={payment.method} size="small" variant="outlined" />} />
              <InfoRow label="Transaction"   value={payment.transactionId} />
              <InfoRow label="Paid At"       value={formatDateTime(payment.paidAt)} />
              {receipt && (
                <>
                  <Divider sx={{ my: 1.5 }} />
                  <Button
                    fullWidth variant="outlined" size="small" startIcon={<ReceiptOutlinedIcon />}
                    onClick={() => navigate(`/payments/receipt/${payment.id}`)}
                  >
                    View Receipt
                  </Button>
                </>
              )}
            </Paper>
          )}

          {/* Suggested Action */}
          <Paper elevation={1} sx={{ borderRadius: 3, p: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Suggested Action</Typography>
            <Divider sx={{ mb: 1.5 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {ACTION_LABELS[reminder.suggestedAction] ?? "No action required."}
            </Typography>
            {!isDismissed && !isPaid && reminder.suggestedAction === "pay_now" && (
              <Button
                fullWidth variant="contained" startIcon={<PaymentOutlinedIcon />}
                onClick={() => navigate(`/payments/pay/${reminder.billId}`)}
              >
                Pay Now
              </Button>
            )}
            {reminder.suggestedAction === "view_receipt" && receipt && (
              <Button
                fullWidth variant="contained" startIcon={<ReceiptOutlinedIcon />}
                onClick={() => navigate(`/payments/receipt/${payment?.id}`)}
              >
                View Receipt
              </Button>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

