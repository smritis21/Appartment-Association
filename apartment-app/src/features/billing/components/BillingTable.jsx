import {
  Alert, Box, Chip, IconButton, Paper, Snackbar, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow,
  TableSortLabel, Tooltip, Typography,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import PrintOutlinedIcon from "@mui/icons-material/PrintOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatDate } from "../../../utils/formatDate";
import { formatCurrency } from "../../../utils/formatCurrency";
import { getBillTotal } from "../mock/bills";
import BillStatusChip from "./BillStatusChip";
import EmptyState from "../../../components/common/EmptyState";
import { ROLE_LABELS } from "../../auth/mock/roles";

export default function BillingTable({ bills, residentMap }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState("id");
  const [toast, setToast] = useState(null);

  const handleDownloadReceipt = (bill) => {
    const paymentId = bill.payments?.[0]?.id;
    if (!paymentId) {
      setToast("No payment record is linked to this bill yet - receipt unavailable.");
      return;
    }
    navigate(`/payments/receipt/${paymentId}`);
  };

  const handleSort = (col) => {
    setOrder(orderBy === col && order === "asc" ? "desc" : "asc");
    setOrderBy(col);
    setPage(0);
  };

  const sorted = useMemo(() => {
    return [...bills].sort((a, b) => {
      let av, bv;
      if (orderBy === "amount") {
        av = a.total ?? getBillTotal(a); bv = b.total ?? getBillTotal(b);
      } else if (orderBy === "resident") {
        av = residentMap[a.residentId]?.name ?? "";
        bv = residentMap[b.residentId]?.name ?? "";
      } else {
        av = a[orderBy] ?? ""; bv = b[orderBy] ?? "";
      }
      if (av < bv) return order === "asc" ? -1 : 1;
      if (av > bv) return order === "asc" ? 1 : -1;
      return 0;
    });
  }, [bills, order, orderBy, residentMap]);

  const paginated = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  const SortCell = ({ col, label }) => (
    <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary", whiteSpace: "nowrap" }}>
      <TableSortLabel
        active={orderBy === col}
        direction={orderBy === col ? order : "asc"}
        onClick={() => handleSort(col)}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <>
    <Paper elevation={1} sx={{ borderRadius: 2 }}>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              <SortCell col="id"             label="Bill No."   />
              <SortCell col="resident"       label="Resident"   />
              <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary" }}>Wing</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary" }}>Flat</TableCell>
              <SortCell col="billingMonth"   label="Month"      />
              <SortCell col="amount"         label="Amount"     />
              <SortCell col="dueDate"        label="Due Date"   />
              <SortCell col="status"         label="Status"     />
              <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} sx={{ border: 0 }}>
                  <EmptyState
                    icon={ReceiptLongOutlinedIcon}
                    title="No Bills Found"
                    description="Try adjusting your search or filters."
                  />
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((bill) => {
                const resident = residentMap[bill.residentId];
                return (
                  <TableRow key={bill.id} hover>
                    <TableCell>
                      <Typography variant="caption" fontFamily="monospace" fontWeight={600} noWrap>
                        {bill.billNo ?? bill.id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{resident?.name ?? "-"}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {ROLE_LABELS[resident?.role] ?? resident?.role ?? "-"}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={`Wing ${resident?.wing ?? "-"}`} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{resident?.flat ?? "-"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>{bill.billingMonth}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {formatCurrency(bill.total ?? getBillTotal(bill))}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" noWrap>{formatDate(bill.dueDate)}</Typography>
                    </TableCell>
                    <TableCell>
                      <BillStatusChip status={bill.status} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        <Tooltip title="View Invoice">
                          <IconButton size="small" onClick={() => navigate(`/billing/invoice/${bill.id}`)}>
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Download Receipt">
                          <span>
                            <IconButton
                              size="small"
                              color="primary"
                              disabled={bill.status !== "paid"}
                              onClick={() => handleDownloadReceipt(bill)}
                            >
                              <ReceiptOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Print (mock)">
                          <IconButton size="small" onClick={() => window.print()}>
                            <PrintOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
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
        count={bills.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 25]}
      />
    </Paper>
    <Snackbar
      open={Boolean(toast)}
      autoHideDuration={4000}
      onClose={() => setToast(null)}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      <Alert severity="warning" variant="filled" onClose={() => setToast(null)}>
        {toast}
      </Alert>
    </Snackbar>
    </>
  );
}

