import {
  Box, Button, Grid, MenuItem, Paper, TextField, Snackbar, Alert, Typography,
} from "@mui/material";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import ReceiptOutlinedIcon from "@mui/icons-material/ReceiptOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getAllDocuments,
  DOC_CATEGORIES, DOC_STATUS, DOC_VISIBILITY,
} from "../mock/documents";
import {
  deleteDocument as deleteDocumentApi,
  downloadDocumentAs,
  fetchDocuments,
} from "../../../services/documentService";
import { isOffline } from "../../../services/apiClient";
import PageHeader from "../../../components/common/PageHeader";
import DashboardCard from "../../../components/cards/DashboardCard";
import SearchBar from "../../../components/common/SearchBar";
import ConfirmationDialog from "../../../components/common/ConfirmationDialog";
import DocumentList from "../components/DocumentList";
import DocumentPreviewDialog from "../components/DocumentPreviewDialog";

const RESIDENT_CATEGORIES = [
  DOC_CATEGORIES.OWNER_DOCUMENTS, DOC_CATEGORIES.TENANT_DOCUMENTS,
  DOC_CATEGORIES.SALE_DEED, DOC_CATEGORIES.RENTAL_AGREEMENT, DOC_CATEGORIES.KYC_DOCUMENTS,
];
const SOCIETY_CATEGORIES = [
  DOC_CATEGORIES.APARTMENT_RULES, DOC_CATEGORIES.AGM_MINUTES,
  DOC_CATEGORIES.CIRCULARS, DOC_CATEGORIES.SOCIETY_CERTIFICATES,
];
const BILLING_CATEGORIES = [DOC_CATEGORIES.INVOICES, DOC_CATEGORIES.RECEIPTS];

export default function DocumentManagementPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [visFilter, setVisFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [toast, setToast] = useState({ open: false, message: "" });

  // INT-38: the library comes from the live API, re-read on arrival so an
  // upload made on the other screen is visible on the way back.
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setDocs(await fetchDocuments());
      setOffline(false);
      setLoadError("");
    } catch (err) {
      if (isOffline(err)) {
        setDocs(getAllDocuments());
        setOffline(true);
        setLoadError("");
      } else {
        setDocs([]);
        setOffline(false);
        setLoadError(err?.message || "Could not load documents.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh, location.key]);

  const stats = useMemo(() => {
    const total = docs.length;
    const resident = docs.filter((d) => RESIDENT_CATEGORIES.includes(d.category)).length;
    const society = docs.filter((d) => SOCIETY_CATEGORIES.includes(d.category)).length;
    const billing = docs.filter((d) => BILLING_CATEGORIES.includes(d.category)).length;
    const pending = docs.filter((d) => d.status === DOC_STATUS.PENDING).length;
    return { total, resident, society, billing, pending };
  }, [docs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return docs.filter((d) => {
      if (catFilter !== "all" && d.category !== catFilter) return false;
      if (statusFilter !== "all" && d.status !== statusFilter) return false;
      if (visFilter !== "all" && d.visibility !== visFilter) return false;
      if (typeFilter !== "all" && d.fileType !== typeFilter) return false;
      if (!q) return true;
      return (
        d.title.toLowerCase().includes(q) ||
        d.ownerName?.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.uploadedBy.toLowerCase().includes(q)
      );
    });
  }, [docs, search, catFilter, statusFilter, visFilter, typeFilter]);

  // INT-38: fetch the file through the API (so the auth header travels with
  // it) and hand the browser the resulting blob to save. downloadDocumentAs()
  // is the single shared implementation of this - also used by
  // DocumentDetailPage and DocumentPreviewDialog (Bug 8).
  const handleDownload = async (doc) => {
    try {
      await downloadDocumentAs(doc);
      setToast({ open: true, message: `Downloading “${doc.title}”.` });
    } catch (err) {
      setToast({
        open: true,
        message: isOffline(err)
          ? "The server is unreachable - the file could not be downloaded."
          : err?.message || "This document could not be downloaded.",
      });
    }
  };

  const handleDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteDocumentApi(target.id);
      setToast({ open: true, message: "Document deleted successfully." });
    } catch (err) {
      // A resident deleting an admin document is a 403; say so rather than
      // reporting a deletion that did not happen.
      setToast({
        open: true,
        message: isOffline(err)
          ? "The server is unreachable - nothing was deleted."
          : err?.message || "Could not delete this document.",
      });
    } finally {
      refresh();
    }
  };

  const STAT_CARDS = [
    { title: "Total Documents",    value: stats.total,    icon: FolderOutlinedIcon,          color: "primary.main"   },
    { title: "Resident Documents", value: stats.resident, icon: PeopleOutlinedIcon,           color: "info.main"      },
    { title: "Society Documents",  value: stats.society,  icon: ApartmentOutlinedIcon,        color: "secondary.main" },
    { title: "Bills & Receipts",   value: stats.billing,  icon: ReceiptOutlinedIcon,          color: "success.main"   },
    { title: "Pending Verification", value: stats.pending, icon: HourglassEmptyOutlinedIcon,  color: "warning.main"   },
    { title: "Storage Used",       value: "48.2 MB",      icon: StorageOutlinedIcon,          color: "error.main"     },
  ];

  return (
    <Box>
      <PageHeader
        title="Document Management"
        subtitle="Central repository for all society and resident documents"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Documents" }]}
        action={
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => navigate("/documents/upload")}
            sx={{ fontWeight: 600 }}
          >
            Upload Document
          </Button>
        }
      />

      {offline && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Showing sample documents - the server is unreachable.
        </Alert>
      )}
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} action={
          <Button size="small" color="inherit" onClick={refresh}>Retry</Button>
        }>
          {loadError}
        </Alert>
      )}

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {STAT_CARDS.map((c) => (
          <Grid size={{ xs: 6, sm: 4, md: 2 }} key={c.title}>
            <DashboardCard title={c.title} value={c.value} icon={c.icon} color={c.color} />
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <SearchBar
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, resident, category, uploader..."
            sx={{ flex: 1, minWidth: 220 }}
          />
          <TextField select size="small" label="Category" value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="all">All Categories</MenuItem>
            {Object.values(DOC_CATEGORIES).map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Status" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="all">All Statuses</MenuItem>
            {Object.values(DOC_STATUS).map((s) => (
              <MenuItem key={s} value={s} sx={{ textTransform: "capitalize" }}>{s}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Visibility" value={visFilter}
            onChange={(e) => setVisFilter(e.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="all">All</MenuItem>
            {Object.values(DOC_VISIBILITY).map((v) => (
              <MenuItem key={v} value={v} sx={{ textTransform: "capitalize" }}>{v.replace("_", " ")}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="File Type" value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)} sx={{ minWidth: 120 }}>
            <MenuItem value="all">All Types</MenuItem>
            {["PDF", "DOCX", "JPG", "PNG"].map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography variant="body2" color="text.secondary">Loading documents…</Typography>
        </Box>
      ) : (
      <DocumentList
        documents={filtered}
        onDelete={(doc) => setDeleteTarget(doc)}
        onPreview={(doc) => setPreviewDoc(doc)}
        onDownload={handleDownload}
      />
      )}

      <ConfirmationDialog
        open={!!deleteTarget}
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <DocumentPreviewDialog
        open={!!previewDoc}
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast({ open: false, message: "" })}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setToast({ open: false, message: "" })}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

