import { useState } from "react";
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TablePagination, Paper, Typography, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, Button, Grid, Divider,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { formatDateTime } from "../../../utils/formatDate";
import { ROLE_LABELS } from "../../../constants/roles";
import AuditSeverityChip from "./AuditSeverityChip";
import AuditStatusChip from "./AuditStatusChip";

function DetailRow({ label, value }) {
  return (
    <>
      <Grid size={{ xs: 4 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
      </Grid>
      <Grid size={{ xs: 8 }}>
        <Typography variant="body2">{value || "-"}</Typography>
      </Grid>
    </>
  );
}

function DetailDialog({ log, onClose }) {
  if (!log) return null;
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Audit Log Detail - {log.id}</DialogTitle>
      <Divider />
      <DialogContent>
        <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
          <DetailRow label="Timestamp"    value={formatDateTime(log.timestamp)} />
          <DetailRow label="Performed By" value={log.performedBy} />
          <DetailRow label="Role"         value={ROLE_LABELS[log.performedRole] ?? log.performedRole} />
          <DetailRow label="Module"       value={log.module} />
          <DetailRow label="Action"       value={log.action} />
          <DetailRow label="Description"  value={log.description} />
          <DetailRow label="Resident"     value={log.residentName} />
          <DetailRow label="Flat"         value={log.flat} />
          <DetailRow label="Wing"         value={log.wing} />
          <DetailRow label="Device"       value={log.device} />
          <DetailRow label="Browser"      value={log.browser} />
          <DetailRow label="IP Address"   value={log.ipAddress} />
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Severity</Typography>
          </Grid>
          <Grid size={{ xs: 8 }}><AuditSeverityChip severity={log.severity} /></Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Status</Typography>
          </Grid>
          <Grid size={{ xs: 8 }}><AuditStatusChip status={log.status} /></Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function AuditLogTable({ logs }) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [selected, setSelected] = useState(null);

  const paged = logs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <TableContainer component={Paper} sx={{ borderRadius: 2, boxShadow: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              {["Timestamp", "User", "Role", "Module", "Action", "Resident", "Severity", "Status", ""].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 700, fontSize: 12, whiteSpace: "nowrap" }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paged.map((log) => (
              <TableRow key={log.id} hover sx={{ cursor: "pointer" }} onClick={() => setSelected(log)}>
                <TableCell sx={{ fontSize: 12, whiteSpace: "nowrap" }}>{formatDateTime(log.timestamp)}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{log.performedBy}</TableCell>
                <TableCell sx={{ fontSize: 12, textTransform: "capitalize" }}>
                  {ROLE_LABELS[log.performedRole] ?? log.performedRole}
                </TableCell>
                <TableCell sx={{ fontSize: 12 }}>{log.module}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>{log.action}</TableCell>
                <TableCell sx={{ fontSize: 12 }}>
                  {log.residentName
                    ? `${log.residentName}${log.wing ? ` · ${log.wing}-${log.flat}` : ""}`
                    : "-"}
                </TableCell>
                <TableCell><AuditSeverityChip severity={log.severity} /></TableCell>
                <TableCell><AuditStatusChip status={log.status} /></TableCell>
                <TableCell>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSelected(log); }}>
                    <InfoOutlinedIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {paged.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">No audit logs found.</Typography>
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

      {selected && <DetailDialog log={selected} onClose={() => setSelected(null)} />}
    </Box>
  );
}

