import {
  Box, Button, Chip, IconButton, MenuItem, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TablePagination, TableRow,
  TableSortLabel, TextField, Tooltip, Typography,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import DoneOutlinedIcon from "@mui/icons-material/DoneOutlined";
import CloseOutlinedIcon from "@mui/icons-material/CloseOutlined";
import PaymentOutlinedIcon from "@mui/icons-material/PaymentOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDateTime } from "../../../utils/formatDate";
import SearchBar from "../../../components/common/SearchBar";
import EmptyState from "../../../components/common/EmptyState";
import ReminderStatusChip from "./ReminderStatusChip";
import ReminderPriorityChip from "./ReminderPriorityChip";
import { REMINDER_TYPE, REMINDER_STATUS, REMINDER_PRIORITY } from "../mock/reminders";

const TYPE_LABELS = {
  [REMINDER_TYPE.UPCOMING]:         "Upcoming",
  [REMINDER_TYPE.DUE_TODAY]:        "Due Today",
  [REMINDER_TYPE.OVERDUE]:          "Overdue",
  [REMINDER_TYPE.PAYMENT_RECEIVED]: "Payment Received",
  [REMINDER_TYPE.FINAL_REMINDER]:   "Final Reminder",
};

export default function ReminderList({ reminders, residentMap, onMarkRead, onDismiss }) {
  const navigate = useNavigate();
  const [search, setSearch]           = useState("");
  const [typeFilter, setTypeFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [order, setOrder]             = useState("desc");
  const [orderBy, setOrderBy]         = useState("sentAt");
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleSort = (col) => {
    setOrder(orderBy === col && order === "asc" ? "desc" : "asc");
    setOrderBy(col);
    setPage(0);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return reminders.filter((r) => {
      if (typeFilter     !== "all" && r.type     !== typeFilter)     return false;
      if (statusFilter   !== "all" && r.status   !== statusFilter)   return false;
      if (priorityFilter !== "all" && r.priority !== priorityFilter) return false;
      if (!q) return true;
      const name = residentMap?.[r.residentId]?.name?.toLowerCase() ?? "";
      // Real API reminders (services/reminderService.js::toUiReminder) never
      // carry a `title` - only mock data does - so this must not assume one
      // exists (see the same guard on the rendered row below).
      return (
        (r.title ?? "").toLowerCase().includes(q) ||
        (r.billId ?? "").toLowerCase().includes(q) ||
        name.includes(q)
      );
    });
  }, [reminders, search, typeFilter, statusFilter, priorityFilter, residentMap]);

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
      {/* Filters */}
      <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <SearchBar
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by reminder, resident, bill..."
            sx={{ flex: 1, minWidth: 220 }}
          />
          <TextField select size="small" label="Type" value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(0); }} sx={{ minWidth: 160 }}>
            <MenuItem value="all">All Types</MenuItem>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Priority" value={priorityFilter}
            onChange={(e) => { setPriorityFilter(e.target.value); setPage(0); }} sx={{ minWidth: 130 }}>
            <MenuItem value="all">All Priorities</MenuItem>
            {Object.values(REMINDER_PRIORITY).map((p) => (
              <MenuItem key={p} value={p} sx={{ textTransform: "capitalize" }}>{p}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Status" value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }} sx={{ minWidth: 130 }}>
            <MenuItem value="all">All Statuses</MenuItem>
            {Object.values(REMINDER_STATUS).map((s) => (
              <MenuItem key={s} value={s} sx={{ textTransform: "capitalize" }}>{s}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      {/* Table */}
      <Paper elevation={1} sx={{ borderRadius: 2 }}>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: "background.default" }}>
                <SortCell col="title"    label="Reminder"   />
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary" }}>Resident</TableCell>
                <SortCell col="billId"   label="Bill No."   />
                <SortCell col="type"     label="Type"       />
                <SortCell col="priority" label="Priority"   />
                <SortCell col="status"   label="Status"     />
                <SortCell col="sentAt"   label="Sent At"    />
                <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} sx={{ border: 0 }}>
                    <EmptyState icon={NotificationsOutlinedIcon} title="No Reminders Found" description="Try adjusting your search or filters." />
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((r) => {
                  const resident = residentMap?.[r.residentId];
                  const isDismissed = r.status === REMINDER_STATUS.DISMISSED;
                  return (
                    <TableRow key={r.id} hover sx={{ opacity: isDismissed ? 0.55 : 1 }}>
                      <TableCell sx={{ maxWidth: 220 }}>
                        {/* Real API reminders have no `title`/`description` (only mock data
                            does) - fall back to the type label so a real row still shows
                            something meaningful instead of crashing on r.description.slice(). */}
                        <Typography variant="body2" fontWeight={600} noWrap>
                          {r.title ?? TYPE_LABELS[r.type] ?? r.type ?? "Reminder"}
                        </Typography>
                        {r.description && (
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {r.description.slice(0, 60)}…
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{resident?.name ?? "-"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {resident ? `Wing ${resident.wing} · ${resident.flat}` : ""}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace" noWrap>{r.billId}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={TYPE_LABELS[r.type] ?? r.type} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell><ReminderPriorityChip priority={r.priority} /></TableCell>
                      <TableCell><ReminderStatusChip status={r.status} /></TableCell>
                      <TableCell>
                        <Typography variant="caption" noWrap>{formatDateTime(r.sentAt)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          <Tooltip title="View">
                            <IconButton size="small" onClick={() => navigate(`/reminders/${r.id}`)}>
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {r.status === REMINDER_STATUS.UNREAD && (
                            <Tooltip title="Mark Read">
                              <IconButton size="small" color="primary" onClick={() => onMarkRead?.(r.id)}>
                                <DoneOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!isDismissed && (
                            <Tooltip title="Dismiss">
                              <IconButton size="small" onClick={() => onDismiss?.(r.id)}>
                                <CloseOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          {!isDismissed && r.suggestedAction === "pay_now" && (
                            <Tooltip title="Pay Now">
                              <IconButton size="small" color="success"
                                onClick={() => navigate(`/payments/pay/${r.billId}`)}>
                                <PaymentOutlinedIcon fontSize="small" />
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

