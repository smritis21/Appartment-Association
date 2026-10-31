import {
  Box, IconButton, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow,
  TableSortLabel, Tooltip, Typography,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DocumentStatusChip from "./DocumentStatusChip";
import DocumentCategoryChip from "./DocumentCategoryChip";
import EmptyState from "../../../components/common/EmptyState";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";

const COLS = [
  { id: "title",      label: "Document Name" },
  { id: "category",   label: "Category"      },
  { id: "ownerName",  label: "Resident"      },
  { id: "uploadedBy", label: "Uploaded By"   },
  { id: "uploadDate", label: "Upload Date"   },
  { id: "fileSize",   label: "File Size"     },
  { id: "status",     label: "Status"        },
];

function descendingComparator(a, b, orderBy) {
  if (b[orderBy] < a[orderBy]) return -1;
  if (b[orderBy] > a[orderBy]) return 1;
  return 0;
}

function getComparator(order, orderBy) {
  return order === "desc"
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

export default function DocumentList({ documents, onDelete, onPreview, onDownload }) {
  const navigate = useNavigate();
  const [order, setOrder] = useState("desc");
  const [orderBy, setOrderBy] = useState("uploadDate");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const handleSort = (col) => {
    setOrder(orderBy === col && order === "asc" ? "desc" : "asc");
    setOrderBy(col);
    setPage(0);
  };

  const sorted = [...documents].sort(getComparator(order, orderBy));
  const paginated = sorted.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  if (documents.length === 0) {
    return <EmptyState icon={FolderOutlinedIcon} title="No documents found" description="Try adjusting your search or filters." />;
  }

  return (
    <Paper elevation={1} sx={{ borderRadius: 2 }}>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              {COLS.map((col) => (
                <TableCell key={col.id} sx={{ fontWeight: 700, fontSize: 12 }}>
                  <TableSortLabel
                    active={orderBy === col.id}
                    direction={orderBy === col.id ? order : "asc"}
                    onClick={() => handleSort(col.id)}
                  >
                    {col.label}
                  </TableSortLabel>
                </TableCell>
              ))}
              <TableCell sx={{ fontWeight: 700, fontSize: 12 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paginated.map((doc) => (
              <TableRow key={doc.id} hover sx={{ cursor: "pointer" }}>
                <TableCell onClick={() => navigate(`/documents/${doc.id}`)}>
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
                    {doc.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">{doc.fileType}</Typography>
                </TableCell>
                <TableCell><DocumentCategoryChip category={doc.category} /></TableCell>
                <TableCell>
                  <Typography variant="body2">{doc.ownerName || "-"}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{doc.uploadedBy}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{doc.uploadDate}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{doc.fileSize}</Typography>
                </TableCell>
                <TableCell><DocumentStatusChip status={doc.status} /></TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", gap: 0.25 }}>
                    <Tooltip title="View">
                      <IconButton size="small" onClick={() => navigate(`/documents/${doc.id}`)}>
                        <VisibilityOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {doc.downloadable && (
                      <Tooltip title="Download">
                        <IconButton size="small" onClick={() => onDownload?.(doc)}>
                          <DownloadOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => navigate(`/documents/${doc.id}`)}>
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => onDelete(doc)}>
                        <DeleteOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={documents.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(+e.target.value); setPage(0); }}
        rowsPerPageOptions={[5, 10, 25]}
      />
    </Paper>
  );
}

