import {
  Box, Button, Chip, Grid, MenuItem, Paper, Skeleton, TextField,
} from "@mui/material";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import CurrencyRupeeOutlinedIcon from "@mui/icons-material/CurrencyRupeeOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useResidents } from "../../../context/ResidentContext";
import { fetchBills } from "../../../services/paymentService";
import { fetchResident } from "../../../services/residentService";
import { isOffline } from "../../../services/apiClient";
import { getAllBills, BILL_STATUS, BILLING_MONTHS, getBillTotal } from "../mock/bills";
import PageHeader from "../../../components/common/PageHeader";
import DashboardCard from "../../../components/cards/DashboardCard";
import SearchBar from "../../../components/common/SearchBar";
import BillingTable from "../components/BillingTable";

export default function BillingDashboardPage() {
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
    fetchBills({ limit: 100 })
      .then((data) => {
        setBills(data);
        setOffline(false);
        // Build a map of API residents keyed by their UUID for bill lookup
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
    // Overlay API residents (UUID-keyed) so bill rows resolve correctly
    Object.assign(m, apiResidentMap);
    return m;
  }, [residents, apiResidentMap]);

  const stats = useMemo(() => {
    const total   = bills.length;
    const paid    = bills.filter((b) => b.status === "paid"   || b.status === BILL_STATUS.PAID).length;
    const pending = bills.filter((b) => ["pending", "partially_paid", BILL_STATUS.PENDING, BILL_STATUS.PARTIALLY_PAID].includes(b.status)).length;
    const overdue = bills.filter((b) => b.status === "overdue" || b.status === BILL_STATUS.OVERDUE).length;
    const revenue = bills
      .filter((b) => b.status === "paid" || b.status === BILL_STATUS.PAID)
      .reduce((sum, b) => sum + (b.total ?? getBillTotal(b)), 0);
    return { total, paid, pending, overdue, revenue };
  }, [bills]);

  const billingMonths = useMemo(() => {
    const months = [...new Set(bills.map((b) => b.billingMonth).filter(Boolean))].sort().reverse();
    return months.length ? months : BILLING_MONTHS;
  }, [bills]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bills.filter((b) => {
      const resident = residentMap[b.residentId];
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (monthFilter  !== "all" && b.billingMonth !== monthFilter) return false;
      if (!q) return true;
      return (
        (b.id ?? "").toLowerCase().includes(q) ||
        (b.billingMonth ?? "").toLowerCase().includes(q) ||
        resident?.name?.toLowerCase().includes(q) ||
        `${resident?.wing ?? ""}-${resident?.flat ?? ""}`.toLowerCase().includes(q)
      );
    });
  }, [bills, search, statusFilter, monthFilter, residentMap]);

  const STAT_CARDS = [
    { title: "Total Bills",   value: stats.total,   icon: ReceiptLongOutlinedIcon,    color: "primary.main"   },
    { title: "Paid",          value: stats.paid,    icon: CheckCircleOutlinedIcon,    color: "success.main"   },
    { title: "Pending",       value: stats.pending, icon: HourglassEmptyOutlinedIcon, color: "warning.main"   },
    { title: "Overdue",       value: stats.overdue, icon: ErrorOutlineOutlinedIcon,   color: "error.main"     },
    { title: "Total Revenue", value: `₹${(stats.revenue / 1000).toFixed(1)}k`, icon: CurrencyRupeeOutlinedIcon, color: "secondary.main" },
  ];

  return (
    <Box>
      <PageHeader
        title="Billing"
        subtitle="Generate and manage maintenance bills for all residents"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Billing" }]}
        action={
          <Button variant="contained" startIcon={<AddOutlinedIcon />}
            onClick={() => navigate("/billing/generate")} sx={{ fontWeight: 600 }}>
            Generate Bill
          </Button>
        }
      />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STAT_CARDS.map((c) => (
          <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={c.title}>
            {loading
              ? <Skeleton variant="rounded" height={98} />
              : <DashboardCard title={c.title} value={c.value} icon={c.icon} color={c.color} />}
          </Grid>
        ))}
      </Grid>

      <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <SearchBar value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by bill no., resident or flat..." sx={{ flex: 1, minWidth: 220 }} />
          <TextField select size="small" label="Status" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value="paid">Paid</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="overdue">Overdue</MenuItem>
            <MenuItem value="partially_paid">Partially Paid</MenuItem>
          </TextField>
          <TextField select size="small" label="Month" value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)} sx={{ minWidth: 160 }}>
            <MenuItem value="all">All Months</MenuItem>
            {billingMonths.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </TextField>
        </Box>
      </Paper>

      <BillingTable bills={filtered} residentMap={residentMap} />
    </Box>
  );
}

