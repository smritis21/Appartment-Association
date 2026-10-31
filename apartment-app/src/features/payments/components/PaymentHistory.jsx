import {
  Box, Chip, IconButton, MenuItem, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, TableSortLabel,
  TextField, Tooltip, Typography,
} from "@mui/material";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDateTime } from "../../../utils/formatDate";
import SearchBar from "../../../components/common/SearchBar";
import EmptyState from "../../../components/common/EmptyState";
import PaymentStatusChip from "./PaymentStatusChip";
import { PAYMENT_STATUS, PAYMENT_METHODS } from "../mock/payments";

export default function PaymentHistory({ payments, residentMap }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");
  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState("paidAt");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleSort = (col) => {
    setOrder(orderBy === col && order === "asc" ? "desc" : "asc");
    setOrderBy(col);
    setPage(0);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (methodFilter !== "all" && p.method !== methodFilter) return false;
      if (!q) return true;
      const name = residentMap?.[p.residentId]?.name?.toLowerCase() ?? "";
      return (
        p.id.toLowerCase().includes(q) ||
        p.billId.toLowerCase().includes(q) ||
        p.transactionId.toLowerCase().includes(q) ||
        name.includes(q)
      );
    });
  }, [payments, search, statusFilter, methodFilter, residentMap]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[orderBy] ?? "";
      const bv = b[orderBy] ?? "";
      if (av < bv) return order === "asc" ? -1 : 1;
      if (av > bv) return order === "asc" ? 1 : -1;
      return 0;
    });
  }, [filtered, order, orderBy]);

  const paginated = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const SortCell = ({ col, label }) => (
    <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary", whiteSpace: "nowrap" }}>
      <TableSortLabel active={orderBy === col} direction={orderBy === col ? order : "asc"} onClick={() => handleSort(col)}>
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box>
      <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <SearchBar
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by payment ID, bill, resident..."
            sx={{ flex: 1, minWidth: 220 }}
          />
          <TextField select size="small" label="Status" value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} sx={{ minWidth: 140 }}>
            <MenuItem value="all">All Statuses</MenuItem>
            {Object.values(PAYMENT_STATUS).map((s) => (
              <MenuItem key={s} value={s} sx={{ textTransform: "capitalize" }}>{s}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Method" value={methodFilter}
            onChange={(e) => { setMethodFilter(e.target.value); setPage(0); }} sx={{ minWidth: 150 }}>
            <MenuItem value="all">All Methods</MenuItem>
            {Object.values(PAYMENT_METHODS).map((m) => (
              <MenuItem key={m} value={m}>{m}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      <Paper elevation={1} sx={{ borderRadius: 2 }}>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "background.default" }}>
                <SortCell col="id"        label="Payment ID"  />
                <SortCell col="billId"    label="Bill"        />
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary" }}>Resident</TableCell>
                <SortCell col="amount"    label="Amount"      />
                <SortCell col="method"    label="Method"      />
                <SortCell col="paidAt"    label="Date"        />
                <SortCell col="status"    label="Status"      />
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary" }}>Receipt</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ border: 0 }}>
                    <EmptyState icon={PaymentOutlinedIcon} title="No Payments Found" description="Try adjusting your search or filters." />
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((p) => {
                  const resident = residentMap?.[p.residentId];
                  return (
                    <TableRow key={p.id} hover>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace" fontWeight={600} noWrap>{p.id}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace" noWrap>{p.billId}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{resident?.name ?? "-"}</Typography>
                        <Typography variant="caption" color="text.secondary">{resident ? `Wing ${resident.wing} · ${resident.flat}` : ""}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{formatCurrency(p.amount)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={p.method} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap>{formatDateTime(p.paidAt)}</Typography>
                      </TableCell>
                      <TableCell>
                        <PaymentStatusChip status={p.status} />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View Receipt">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              disabled={p.status !== "paid"}
                              onClick={() => navigate(`/payments/receipt/${p.id}`)}
                            >
                              <ReceiptOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </Paper>
    </Box>
  );
}

