import { useState, useMemo } from "react";
import {
  Box, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TablePagination, TextField, InputAdornment, Typography,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import AuditStatusChip from "../components/AuditStatusChip";
import { getLoginLogs } from "../mock/auditLogs";
import { useAuditFeed } from "../hooks/useAuditFeed";
import { formatDateTime } from "../../../utils/formatDate";
import { ROLE_LABELS } from "../../../constants/roles";

// The backend only ever logs a "user_login" action - there's no logout or
// failed-attempt entry to show yet (login failures 401 before any audit
// write, and there's no logout endpoint that writes one either).
const onlyLogins = (items) => items.filter((l) => l.action === "user_login");

export default function LoginLogsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Bug 20a: shared with AuditLogsPage/ActivityLogsPage - fetches once, then
  // polls every 20s so a new login shows up without a manual reload.
  const filters = useMemo(() => ({ module: "auth", pageSize: 200 }), []);
  const { logs: apiLogs, offline } = useAuditFeed(filters, onlyLogins);

  const allLogs = apiLogs ?? getLoginLogs();

  const logs = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return allLogs;
    return allLogs.filter((l) =>
      [l.performedBy, l.performedRole, l.browser, l.device, l.ipAddress]
        .some((v) => v?.toLowerCase().includes(q))
    );
  }, [allLogs, search]);

  const paged = logs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  // Pair login with logout for same user on same day. Live data never has a
  // logout entry (the backend doesn't write one), so this always falls
  // through to "Active / Not recorded" there.
  function getLogoutTime(log) {
    if (log.action !== "User Login" && log.action !== "user_login") return "-";
    const loginDay = log.timestamp.split("T")[0];
    const logout = allLogs.find(
      (l) =>
        (l.action === "User Logout" || l.action === "user_logout") &&
        l.performedBy === log.performedBy &&
        l.timestamp.split("T")[0] === loginDay &&
        l.timestamp > log.timestamp
    );
    return logout ? formatDateTime(logout.timestamp) : "Active / Not recorded";
  }

  return (
    <Box>
      <PageHeader
        title="Login Logs"
        subtitle="All login, logout, and failed login attempts."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Audit Logs", href: "/audit" },
          { label: "Login Logs" },
        ]}
      />

      {offline && (
        <Chip
          icon={<CloudOffOutlinedIcon />}
          label="Backend unreachable - showing sample data"
          color="warning"
          variant="outlined"
          size="small"
          sx={{ mb: 2 }}
        />
      )}

      <TextField
        fullWidth size="small" placeholder="Search by user, role, browser, device, IP…"
        value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        sx={{ mb: 2 }}
      />

      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              {["User", "Role", "Action", "Login Time", "Logout Time", "Browser", "Device", "IP Address", "Status"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell sx={{ fontSize: 12 }}>{log.performedBy}</TableCell>
                <TableCell sx={{ fontSize: 12, textTransform: "capitalize" }}>
                  {ROLE_LABELS[log.performedRole] ?? log.performedRole}
                </TableCell>
                <TableCell sx={{ fontSize: 12 }}>{log.action}</TableCell>
                <TableCell sx={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatDateTime(log.timestamp)}</TableCell>
                <TableCell sx={{ fontSize: 12, whiteSpace: "nowrap" }}>{getLogoutTime(log)}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{log.browser}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{log.device}</TableCell>
                <TableCell sx={{ fontSize: 12, fontFamily: "monospace" }}>{log.ipAddress}</TableCell>
                <TableCell><AuditStatusChip status={log.status} /></TableCell>
              </TableRow>
            ))}
            {paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">No login logs found.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={logs.length}
        page={page}
        rowsPerPage={rowsPerPage}
        onPageChange={(_, p) => setPage(p)}
        onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
        rowsPerPageOptions={[10, 25, 50]}
      />
    </Box>
  );
}

