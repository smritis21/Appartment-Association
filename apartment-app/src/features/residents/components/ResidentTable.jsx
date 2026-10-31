import {
  Box, Chip, IconButton, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow,
  TableSortLabel, Tooltip, Typography,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ROLE_LABELS } from "../../auth/mock/roles";
import ResidentStatusChip from "./ResidentStatusChip";
import { RESIDENT_STATUS } from "../mock/residents";
import EmptyState from "../../../components/common/EmptyState";

export default function ResidentTable({ residents, onEdit, onDeactivate, onDelete }) {
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [order, setOrder] = useState("asc");
  const [orderBy, setOrderBy] = useState("name");

  const handleSort = (col) => {
    setOrder(orderBy === col && order === "asc" ? "desc" : "asc");
    setOrderBy(col);
  };

  const sorted = useMemo(() => {
    return [...residents].sort((a, b) => {
      const av = (a[orderBy] ?? "").toString().toLowerCase();
      const bv = (b[orderBy] ?? "").toString().toLowerCase();
      return order === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [residents, order, orderBy]);

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
    <Paper elevation={1} sx={{ borderRadius: 2 }}>
      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size="small" sx={{ minWidth: 760 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              <SortCell col="id"    label="Resident ID" />
              <SortCell col="name"  label="Name"        />
              <SortCell col="role"  label="Role"        />
              <SortCell col="wing"  label="Wing"        />
              <SortCell col="flat"  label="Flat"        />
              <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary" }}>Phone</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary" }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "text.secondary" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} sx={{ border: 0 }}>
                  <EmptyState
                    icon={PeopleOutlinedIcon}
                    title="No Residents Found"
                    description="Try adjusting your search or filters."
                  />
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((r) => (
                <TableRow key={r.id} hover>
                  <TableCell>
                    <Typography variant="caption" fontFamily="monospace" fontWeight={600}>{r.id}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.email}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={ROLE_LABELS[r.role] ?? r.role} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell><Typography variant="body2">{r.wing}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{r.flat}</Typography></TableCell>
                  <TableCell><Typography variant="body2">{r.phone}</Typography></TableCell>
                  <TableCell><ResidentStatusChip status={r.status} /></TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <Tooltip title="View">
                        <IconButton size="small" onClick={() => navigate(`/residents/${r.id}`)}>
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => onEdit(r)}>
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Deactivate">
                        <span>
                          <IconButton size="small" color="warning"
                            disabled={r.status !== RESIDENT_STATUS.ACTIVE}
                            onClick={() => onDeactivate(r)}>
                            <BlockOutlinedIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => onDelete(r)}>
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={residents.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[5, 10, 25]}
      />
    </Paper>
  );
}
