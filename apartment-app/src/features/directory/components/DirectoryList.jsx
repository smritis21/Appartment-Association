import {
  Box, Chip, IconButton, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow,
  TableSortLabel, Tooltip, Typography,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import ContactsOutlinedIcon from "@mui/icons-material/ContactsOutlined";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import FlatStatusChip from "./FlatStatusChip";
import EmptyState from "../../../components/common/EmptyState";

const COLS = [
  { id: "flat",      label: "Flat",      sortable: true  },
  { id: "wing",      label: "Wing",      sortable: true  },
  { id: "owner",     label: "Owner",     sortable: false },
  { id: "tenant",    label: "Tenant",    sortable: false },
  { id: "residents", label: "Residents", sortable: true  },
  { id: "status",    label: "Status",    sortable: true  },
  { id: "actions",   label: "Actions",   sortable: false },
];

function descendingComparator(a, b, orderBy) {
  const va = orderBy === "residents" ? a.residentCount : (a.flat[orderBy] ?? "");
  const vb = orderBy === "residents" ? b.residentCount : (b.flat[orderBy] ?? "");
  if (vb < va) return -1;
  if (vb > va) return 1;
  return 0;
}

export default function DirectoryList({ rows }) {
  const navigate = useNavigate();
  const [order, setOrder]   = useState("asc");
  const [orderBy, setOrderBy] = useState("flat");
  const [page, setPage]     = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleSort = (col) => {
    if (orderBy === col) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setOrderBy(col);
      setOrder("asc");
    }
    setPage(0);
  };

  const sorted = [...rows].sort((a, b) =>
    order === "asc" ? descendingComparator(b, a, orderBy) : descendingComparator(a, b, orderBy)
  );

  const paginated = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Paper elevation={1} sx={{ borderRadius: 2 }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              {COLS.map((col) => (
                <TableCell key={col.id} sx={{ fontWeight: 700, fontSize: 13 }}>
                  {col.sortable ? (
                    <TableSortLabel
                      active={orderBy === col.id}
                      direction={orderBy === col.id ? order : "asc"}
                      onClick={() => handleSort(col.id)}
                    >
                      {col.label}
                    </TableSortLabel>
                  ) : col.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} sx={{ border: 0 }}>
                  <EmptyState
                    icon={ContactsOutlinedIcon}
                    title="No Results Found"
                    description="Try adjusting your search or filters."
                  />
                </TableCell>
              </TableRow>
            ) : (
              paginated.map(({ flat, owner, tenant, residentCount }) => (
                <TableRow key={flat.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{flat.flat}</TableCell>
                  <TableCell>
                    <Chip label={`Wing ${flat.wing}`} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    {owner ? (
                      <Typography
                        variant="body2"
                        sx={{ cursor: "pointer", color: "primary.main", fontWeight: 500 }}
                        onClick={() => navigate(`/directory/owners/${owner.id}`)}
                      >
                        {owner.name}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {tenant ? (
                      <Typography
                        variant="body2"
                        sx={{ cursor: "pointer", color: "primary.main", fontWeight: 500 }}
                        onClick={() => navigate(`/directory/tenants/${tenant.id}`)}
                      >
                        {tenant.name}
                      </Typography>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={residentCount} size="small" color={residentCount > 0 ? "primary" : "default"} />
                  </TableCell>
                  <TableCell>
                    <FlatStatusChip status={flat.status} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5 }}>
                      <Tooltip title="View Flat">
                        <IconButton size="small" onClick={() => navigate(`/directory/flat/${flat.id}`)}>
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {owner && (
                        <Tooltip title="View Owner">
                          <IconButton size="small" onClick={() => navigate(`/directory/owners/${owner.id}`)}>
                            <HomeOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {tenant && (
                        <Tooltip title="View Tenant">
                          <IconButton size="small" onClick={() => navigate(`/directory/tenants/${tenant.id}`)}>
                            <PersonOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
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
        count={rows.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
        rowsPerPageOptions={[5, 10, 25]}
      />
    </Paper>
  );
}

