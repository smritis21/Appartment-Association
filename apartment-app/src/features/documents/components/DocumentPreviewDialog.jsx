import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Snackbar, Typography,
} from "@mui/material";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import { useState } from "react";
import DocumentStatusChip from "./DocumentStatusChip";
import DocumentCategoryChip from "./DocumentCategoryChip";
import DocumentPreviewFrame from "./DocumentPreviewFrame";
import { downloadDocumentAs } from "../../../services/documentService";
import { isOffline } from "../../../services/apiClient";

/**
 * Fetches the real file (DocumentPreviewFrame, mirroring the onboarding
 * module's authenticated fetch -> blob URL pattern) and downloads through
 * the same shared implementation DocumentManagementPage's table and
 * DocumentDetailPage use.
 */
export default function DocumentPreviewDialog({ open, onClose, doc }) {
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  if (!doc) return null;

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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {doc.title}
        <Typography variant="caption" color="text.secondary" display="block">
          {doc.fileType} · {doc.fileSize}
        </Typography>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ mb: 2.5 }}>
          <DocumentPreviewFrame doc={doc} active={open} height={220} />
        </Box>

        {/* Document info */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
          <DocumentCategoryChip category={doc.category} />
          <DocumentStatusChip status={doc.status} />
        </Box>
        <Divider sx={{ mb: 1.5 }} />
        {[
          ["Owner", doc.ownerName],
          ["Uploaded By", doc.uploadedBy],
          ["Upload Date", doc.uploadDate],
          ["Visibility", doc.visibility.replace("_", " ")],
        ].map(([label, value]) => (
          <Box key={label} sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
            <Typography variant="body2" color="text.secondary">{label}</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ textTransform: "capitalize" }}>{value}</Typography>
          </Box>
        ))}
        {doc.description && (
          <Box sx={{ mt: 1.5, p: 1.5, bgcolor: "background.default", borderRadius: 1.5 }}>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Description</Typography>
            <Typography variant="body2">{doc.description}</Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">Close</Button>
        {doc.downloadable && (
          <Button variant="contained" startIcon={<DownloadOutlinedIcon />} onClick={handleDownload}>
            Download
          </Button>
        )}
      </DialogActions>

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
    </Dialog>
  );
}
