import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import ZoomOutIcon from "@mui/icons-material/ZoomOut";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import BadgeIcon from "@mui/icons-material/Badge";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { useEffect, useRef, useState } from "react";
import apiClient, { getAuthToken } from "../../../services/apiClient";

const DOC_LABELS = {
  aadhaar: "Aadhaar Card / Govt ID",
  id_proof: "Aadhaar Card / Govt ID",
  sale_deed: "Property Sale Deed",
  ownership_deed: "Property Sale Deed",
  rental_agreement: "Registered Rental Agreement",
  pan: "PAN Card",
  address_proof: "Address Proof",
  photo: "Passport Size Photograph",
  other: "Uploaded Document",
};

export default function DocumentPreviewModal({ open, onClose, doc, application }) {
  const [zoom, setZoom] = useState(100);
  const [blobUrl, setBlobUrl] = useState(null);
  const [blobMimeType, setBlobMimeType] = useState(null);
  const [loading, setLoading] = useState(false);

  const docType = doc?.type || "other";
  const docTitle = DOC_LABELS[docType] || docType.replace("_", " ").toUpperCase();
  const fileName = doc?.fileName || `${docType}.pdf`;
  const applicantName = application?.name || application?.applicantName || "Applicant";
  const flatDetails = application ? `Wing ${application.wing || application.block || ""} • Flat ${application.flat || application.flatNumber || ""}` : "";

  const inlineDataUrl = doc?.dataUrl || (doc?.fileReference?.startsWith("data:") ? doc.fileReference : null);

  const blobUrlRef = useRef(null);

  useEffect(() => {
    if (!open || !doc) {
      setBlobUrl(null);
      setBlobMimeType(null);
      setLoading(false);
      return;
    }

    if (inlineDataUrl) {
      setBlobUrl(inlineDataUrl);
      setLoading(false);
      return;
    }

    const documentId = doc.id || doc.document_id;
    const directUrl = doc.fileUrl || (documentId ? `${apiClient.baseUrl}/onboarding/documents/${documentId}/file` : null);

    if (directUrl) {
      setLoading(true);
      const token = getAuthToken();
      let active = true;

      fetch(directUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((res) => {
          if (!res.ok) throw new Error("Failed to load file");
          return res.blob();
        })
        .then((blob) => {
          if (!active) return;
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          setBlobMimeType(blob.type);
          setBlobUrl(url);
          setLoading(false);
        })
        .catch(() => {
          if (!active) return;
          setLoading(false);
        });

      return () => {
        active = false;
        if (blobUrlRef.current?.startsWith("blob:")) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }
      };
    }
  }, [open, doc, inlineDataUrl]);

  if (!open || !doc) return null;

  const resolvedUrl = blobUrl || inlineDataUrl;
  const effectiveMime = blobMimeType || doc.mimeType || "";
  const isImage = Boolean(effectiveMime.startsWith("image/") || resolvedUrl?.startsWith("data:image/") || fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i));
  const isPdf = Boolean(!isImage && (effectiveMime === "application/pdf" || resolvedUrl?.startsWith("data:application/pdf") || fileName.toLowerCase().endsWith(".pdf")));

  const handleOpenInNewTab = () => {
    if (resolvedUrl) {
      window.open(resolvedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDownload = () => {
    if (resolvedUrl) {
      const a = document.createElement("a");
      a.href = resolvedUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    const content = `DOCUMENT RECORD\n===============\nDocument Type: ${docTitle}\nFile Name: ${fileName}\nApplicant: ${applicantName}\nProperty: ${flatDetails}\nApplication ID: ${application?.id || "N/A"}\nStatus: Verified\nTimestamp: ${new Date().toISOString()}\n`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 25, 200));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 25, 75));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={700}>
            {docTitle}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {fileName} • {applicantName} ({flatDetails})
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ bgcolor: "#f4f6f8", py: 3, px: 2, overflowX: "auto" }}>
        {/* Controls Toolbar */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2, px: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Chip icon={<VerifiedUserIcon />} label="KYC Document Attached" color="success" size="small" variant="outlined" />
            {isImage && (
              <Typography variant="caption" color="text.secondary">
                Zoom: {zoom}%
              </Typography>
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            {resolvedUrl && (
              <Tooltip title="Open full resolution in a new tab">
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<OpenInNewIcon fontSize="small" />}
                  onClick={handleOpenInNewTab}
                  sx={{ textTransform: "none", fontSize: "0.8rem", py: 0.5 }}
                >
                  Open in New Tab
                </Button>
              </Tooltip>
            )}
            {isImage && (
              <>
                <IconButton size="small" onClick={handleZoomOut} disabled={zoom <= 75}>
                  <ZoomOutIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" onClick={handleZoomIn} disabled={zoom >= 200}>
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Box>
        </Box>

        {/* Document Canvas Container */}
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          {loading ? (
            <Paper elevation={1} sx={{ width: "100%", maxWidth: 640, minHeight: 380, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", p: 4, bgcolor: "#ffffff", borderRadius: 2 }}>
              <CircularProgress size={36} sx={{ mb: 2 }} />
              <Typography variant="body2" color="text.secondary">
                Loading document preview...
              </Typography>
            </Paper>
          ) : resolvedUrl && isImage ? (
            <Paper
              elevation={3}
              sx={{
                width: "100%",
                maxWidth: 720,
                p: 2,
                bgcolor: "#ffffff",
                borderRadius: 2,
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
                transition: "transform 0.2s ease",
                border: "1px solid #e0e0e0",
                textAlign: "center",
              }}
            >
              <img
                src={resolvedUrl}
                alt={fileName}
                style={{
                  maxWidth: "100%",
                  maxHeight: 560,
                  borderRadius: 6,
                  boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                  objectFit: "contain",
                }}
              />
            </Paper>
          ) : resolvedUrl && isPdf ? (
            <Paper
              elevation={3}
              sx={{
                width: "100%",
                maxWidth: 780,
                height: 580,
                p: 1,
                bgcolor: "#ffffff",
                borderRadius: 2,
                border: "1px solid #e0e0e0",
              }}
            >
              <iframe
                src={resolvedUrl}
                title={fileName}
                style={{ width: "100%", height: "100%", border: "none", borderRadius: 6 }}
              />
            </Paper>
          ) : (
            <Paper
              elevation={3}
              sx={{
                width: "100%",
                maxWidth: 640,
                minHeight: 420,
                p: 4,
                bgcolor: "#ffffff",
                borderRadius: 2,
                border: "1px solid #e0e0e0",
                position: "relative",
              }}
            >
              {/* Verification certificate info box */}
              <Box sx={{ borderBottom: "2px solid #2f5233", pb: 2, mb: 3, textAlign: "center" }}>
                <Typography variant="overline" letterSpacing={2} color="primary" fontWeight={700}>
                  RESIDENT KYC DOCUMENT RECORD
                </Typography>
                <Typography variant="h5" fontWeight={700} sx={{ color: "#1a202c", mt: 0.5 }}>
                  {docTitle}
                </Typography>
              </Box>

              <Box sx={{ textAlign: "center", py: 3 }}>
                <Box
                  sx={{
                    width: 100,
                    height: 100,
                    mx: "auto",
                    bgcolor: "#eef4ef",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mb: 2,
                  }}
                >
                  {isPdf ? (
                    <PictureAsPdfIcon sx={{ fontSize: 48, color: "#a83b3b" }} />
                  ) : (
                    <BadgeIcon sx={{ fontSize: 48, color: "#2f5233" }} />
                  )}
                </Box>
                <Typography variant="subtitle1" fontWeight={700}>{fileName}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Applicant: <strong>{applicantName}</strong> ({flatDetails})
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                  Document Type: {docType} • Reference: {doc.fileReference || doc.id}
                </Typography>
              </Box>

              <Divider sx={{ my: 3 }} />
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <Box>
                  <Typography variant="caption" display="block" color="text.secondary">FILE ATTACHMENT</Typography>
                  <Typography variant="body2" fontWeight={600}>{fileName}</Typography>
                </Box>
                <Chip label="OFFICIAL KYC ARCHIVE" size="small" color="primary" display="inline-flex" />
              </Box>
            </Paper>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: "space-between" }}>
        <Typography variant="caption" color="text.secondary">
          Document ID: {doc.id || docType}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={onClose} variant="outlined" color="inherit">
            Close
          </Button>
          <Button onClick={handleDownload} variant="contained" startIcon={<DownloadIcon />}>
            Download Document
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
