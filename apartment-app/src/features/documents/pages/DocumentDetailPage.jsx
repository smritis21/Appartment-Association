import {
  Alert, Box, Button, Grid, Paper, Snackbar, Typography,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchDocumentById, downloadDocumentAs } from "../../../services/documentService";
import { isOffline } from "../../../services/apiClient";
import PageHeader from "../../../components/common/PageHeader";
import DocumentInfoPanel from "../components/DocumentInfoPanel";
import DocumentPreviewFrame from "../components/DocumentPreviewFrame";

const TIMELINE = [
  { icon: CloudUploadOutlinedIcon, label: "Document Uploaded",  color: "primary.main"  },
  { icon: EditOutlinedIcon,        label: "Last Modified",       color: "warning.main"  },
  { icon: CheckCircleOutlinedIcon, label: "Status Updated",      color: "success.main"  },
];

/**
 * Fetches the document record from the backend (GET /documents/{id}) and
 * downloads through the same shared implementation the document list and
 * preview dialog use.
 */
export default function DocumentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setDoc(await fetchDocumentById(id));
    } catch (err) {
      setDoc(null);
      setLoadError(
        isOffline(err)
          ? "The server is unreachable - this document could not be loaded."
          : err?.message || `Document ID "${id}" does not exist.`
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleDownload = async () => {
    try {
      await downloadDocumentAs(doc);
      setToast({ open: true, severity: "success", message: `Downloading "${doc.title}".` });
    } catch (err) {
      setToast({
        open: true,
        severity: "error",
        message: isOffline(err)
          ? "The server is unreachable - the file could not be downloaded."
          : err?.message || "This document could not be downloaded.",
      });
    }
  };

  if (loading) {
    return (
      <Box>
        <PageHeader
          title="Loading document…"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Documents", href: "/documents" },
          ]}
        />
        <Box sx={{ textAlign: "center", py: 8 }}>
          <Typography variant="body2" color="text.secondary">Loading document…</Typography>
        </Box>
      </Box>
    );
  }

  if (!doc) {
    return (
      <Box>
        <PageHeader
          title="Document Not Found"
          breadcrumbs={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Documents", href: "/documents" },
            { label: "Not Found" },
          ]}
        />
        <Alert
          severity="error"
          action={<Button size="small" color="inherit" onClick={load}>Retry</Button>}
        >
          {loadError}
        </Alert>
        <Button sx={{ mt: 2 }} startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/documents")}>
          Back to Documents
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={doc.title}
        subtitle={`${doc.category} · ${doc.fileType} · ${doc.fileSize}`}
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Documents", href: "/documents" },
          { label: doc.title },
        ]}
        action={
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/documents")}>
              Back
            </Button>
            {doc.downloadable && (
              <Button
                variant="contained"
                startIcon={<DownloadOutlinedIcon />}
                onClick={handleDownload}
              >
                Download
              </Button>
            )}
          </Box>
        }
      />

      <Grid container spacing={3}>
        {/* Left - preview + description */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 3, mb: 3 }}>
            <DocumentPreviewFrame doc={doc} height={260} />
          </Paper>

          {/* Description */}
          {doc.description && (
            <Paper elevation={1} sx={{ borderRadius: 2, p: 3, mb: 3 }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Description</Typography>
              <Typography variant="body2" color="text.secondary">{doc.description}</Typography>
            </Paper>
          )}

          {/* Activity Timeline */}
          <Paper elevation={1} sx={{ borderRadius: 2, p: 3 }}>
            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Activity Timeline</Typography>
            {TIMELINE.map((step, i) => {
              const Icon = step.icon;
              const dates = [doc.uploadDate, doc.lastModified, doc.lastModified];
              const labels = ["Document uploaded by " + doc.uploadedBy, "Last modified on " + doc.lastModified, "Status: " + doc.status];
              return (
                <Box key={i} sx={{ display: "flex", gap: 2, mb: i < TIMELINE.length - 1 ? 2 : 0 }}>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Box sx={{
                      width: 32, height: 32, borderRadius: "50%",
                      bgcolor: step.color, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Icon sx={{ color: "white", fontSize: 16 }} />
                    </Box>
                    {i < TIMELINE.length - 1 && (
                      <Box sx={{ width: 2, flexGrow: 1, bgcolor: "divider", mt: 0.5 }} />
                    )}
                  </Box>
                  <Box sx={{ pb: i < TIMELINE.length - 1 ? 2 : 0 }}>
                    <Typography variant="body2" fontWeight={600}>{step.label}</Typography>
                    <Typography variant="caption" color="text.secondary">{labels[i]}</Typography>
                    <Typography variant="caption" color="text.disabled" display="block">{dates[i]}</Typography>
                  </Box>
                </Box>
              );
            })}
          </Paper>
        </Grid>

        {/* Right - info panel */}
        <Grid size={{ xs: 12, md: 5 }}>
          <DocumentInfoPanel doc={doc} />
        </Grid>
      </Grid>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((t) => ({ ...t, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
