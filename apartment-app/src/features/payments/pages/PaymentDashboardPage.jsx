import {
  Box, Button, Chip, Grid, IconButton, MenuItem, Paper,
  Skeleton, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useResidents } from "../../../context/ResidentContext";
import { getAllBills, getBillTotal, BILL_STATUS, BILLING_MONTHS } from "../../billing/mock/bills";
import { getPaymentStats, PAYMENT_STATUS } from "../mock/payments";
import { fetchBills } from "../../../services/paymentService";
import { fetchResident } from "../../../services/residentService";
import { isOffline } from "../../../services/apiClient";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDate } from "../../../utils/formatDate";
import PageHeader from "../../../components/common/PageHeader";
import DashboardCard from "../../../components/cards/DashboardCard";
import BillStatusChip from "../../billing/components/BillStatusChip";
import SearchBar from "../../../components/common/SearchBar";
import EmptyState from "../../../components/common/EmptyState";

export default function PaymentDashboardPage() {
  const navigate = useNavigate();
  const { residents } = useResidents();

  const [bills, setBills] = useState([]);
  const [apiResidentMap, setApiResidentMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    fetchBills()
      .then((data) => {
        setBills(data);
        setOffline(false);
        const uuids = [...new Set(data.map((b) => b.residentId).filter(Boolean))];
        Promise.all(uuids.map((id) => fetchResident(id).catch(() => null))).then((results) => {
          const m = {};
          results.forEach((r) => { if (r) m[r.id] = r; });
          setApiResidentMap(m);
        });
      })
      .catch((err) => {
        if (isOffline(err)) {
          setBills(getAllBills());
          setOffline(true);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const residentMap = useMemo(() => {
    const m = {};
    residents.forEach((r) => { m[r.id] = r; });
    Object.assign(m, apiResidentMap);
    return m;
  }, [residents, apiResidentMap]);

  const filteredBills = useMemo(() => {
    const q = search.toLowerCase();
    return bills.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (monthFilter !== "all" && b.billingMonth !== monthFilter) return false;
      if (!q) return true;
      const r = residentMap[b.residentId];
      return (
        b.id.toLowerCase().includes(q) ||
        b.billingMonth.toLowerCase().includes(q) ||
        r?.name?.toLowerCase().includes(q) ||
        `${r?.wing}-${r?.flat}`.toLowerCase().includes(q)
      );
    });
  }, [bills, search, statusFilter, monthFilter, residentMap]);

  const liveStats = useMemo(() => {
    if (offline) return getPaymentStats();
    const outstanding = bills
      .filter((b) => b.status === BILL_STATUS.PENDING || b.status === BILL_STATUS.OVERDUE || b.status === "pending" || b.status === "overdue")
      .reduce((s, b) => s + (b.total ?? 0), 0);
    const pendingBills = bills.filter(
      (b) => ["pending", "overdue", BILL_STATUS.PENDING, BILL_STATUS.OVERDUE].includes(b.status)
    ).length;
    const paidBills = bills.filter((b) => b.status === "paid" || b.status === BILL_STATUS.PAID);
    const paidThisMonth = paidBills.reduce((s, b) => s + (b.total ?? 0), 0);
    const completedPayments = paidBills.length;
    return { outstanding, paidThisMonth, pendingBills, completedPayments, lastPayment: null };
  }, [bills, offline]);

  const STAT_CARDS = [
    { title: "Outstanding Amount",   value: formatCurrency(liveStats.outstanding),      icon: AccountBalanceWalletOutlinedIcon, color: "error.main"    },
    { title: "Paid This Month",      value: formatCurrency(liveStats.paidThisMonth),    icon: CheckCircleOutlinedIcon,          color: "success.main"  },
    { title: "Pending Bills",        value: liveStats.pendingBills,                     icon: HourglassEmptyOutlinedIcon,       color: "warning.main"  },
    { title: "Completed Payments",   value: liveStats.completedPayments,                icon: PaymentOutlinedIcon,              color: "primary.main"  },
    { title: "Total Bills",          value: bills.length,                                          icon: HistoryOutlinedIcon, color: "secondary.main" },
  ];

  return (
    <Box>
      <PageHeader
        title="Payments"
        subtitle="View outstanding bills and manage your payments"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Payments" }]}
        action={
          <Button variant="outlined" startIcon={<HistoryOutlinedIcon />} onClick={() => navigate("/payments/history")}>
            Payment History
          </Button>
        }
      />

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STAT_CARDS.map((c) => (
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={c.title}>
            {loading ? <Skeleton variant="rounded" height={98} /> : (
              <DashboardCard title={c.title} value={c.value} icon={c.icon} color={c.color} />
            )}
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <SearchBar
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by bill no., resident or flat..."
            sx={{ flex: 1, minWidth: 220 }}
          />
          <TextField select size="small" label="Status" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value={BILL_STATUS.PAID}>Paid</MenuItem>
            <MenuItem value={BILL_STATUS.PENDING}>Pending</MenuItem>
            <MenuItem value={BILL_STATUS.OVERDUE}>Overdue</MenuItem>
            <MenuItem value={BILL_STATUS.PARTIALLY_PAID}>Partially Paid</MenuItem>
          </TextField>
          <TextField select size="small" label="Month" value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="all">All Months</MenuItem>
            {BILLING_MONTHS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
        </Box>
      </Paper>

      {/* Bills Table */}
      <Paper elevation={1} sx={{ borderRadius: 2 }}>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "background.default" }}>
                {["Bill Number", "Billing Month", "Resident", "Amount", "Due Date", "Status", "Payment Method", "Actions"].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary", whiteSpace: "nowrap" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredBills.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ border: 0 }}>
                    <EmptyState icon={PaymentOutlinedIcon} title="No Bills Found" description="Try adjusting your search or filters." />
                  </TableCell>
                </TableRow>
              ) : (
                filteredBills.map((bill) => {
                  const resident = residentMap[bill.residentId];
                  const isPaid = bill.status === BILL_STATUS.PAID;
                  return (
                    <TableRow key={bill.id} hover>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace" fontWeight={600} noWrap>{bill.billNo ?? bill.id}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap>{bill.billingMonth}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{resident?.name ?? "-"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {resident ? `Wing ${resident.wing} · ${resident.flat}` : ""}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{formatCurrency(bill.total ?? getBillTotal(bill))}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap>{formatDate(bill.dueDate)}</Typography>
                      </TableCell>
                      <TableCell>
                        <BillStatusChip status={bill.status} />
                      </TableCell>
                      <TableCell>
                        {(bill.payments ?? []).length > 0
                          ? <Chip label={(bill.payments[0].method ?? bill.payments[0].payment_method ?? "paid")} size="small" variant="outlined" />
                          : <Typography variant="caption" color="text.disabled">-</Typography>
                        }
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          {!isPaid && (
                            <Tooltip title="Pay Now">
                              <Button
                                size="small"
                                variant="contained"
                                sx={{ fontSize: 11, py: 0.25, px: 1, minWidth: 0 }}
                                onClick={() => navigate(`/payments/pay/${bill.id}`)}
                              >
                                Pay
                              </Button>
                            </Tooltip>
                          )}
                          <Tooltip title="View Bill">
                            <IconButton size="small" onClick={() => navigate(`/billing/invoice/${bill.id}`)}>
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {isPaid && (bill.payments ?? []).length > 0 && (
                            <Tooltip title="View Receipt">
                              <IconButton size="small" color="primary" onClick={() => navigate(`/payments/receipt/${bill.payments[0].id}`)}>
                                <ReceiptOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

