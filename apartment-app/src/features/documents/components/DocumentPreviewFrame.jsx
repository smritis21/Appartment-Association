import { Box, Button, CircularProgress, Typography } from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { useEffect, useRef, useState } from "react";
import { downloadDocument } from "../../../services/documentService";
import { isOffline } from "../../../services/apiClient";

/**
 * Bug 8 - the actual file preview surface for a real (backend-served)
 * document, shared by DocumentPreviewDialog and DocumentDetailPage so there
 * is one implementation of "fetch the file and render it" rather than two
 * copies drifting apart.
 *
 * Mirrors the authenticated fetch -> blob URL pattern already used by
 * onboarding's DocumentPreviewModal (features/onboarding/components/
 * DocumentPreviewModal.jsx): the file itself needs a bearer token, but once
 * it's a blob: URL no further auth is required to render it in an <img> or
 * <iframe>.
 *
 * `active` gates the fetch (e.g. only fetch while a dialog is open) - pass
 * `true` for an always-visible surface like the detail page.
 */
export default function DocumentPreviewFrame({ doc, active = true, height = 240 }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [mimeType, setMimeType] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const blobUrlRef = useRef(null);

  useEffect(() => {
    if (!active || !doc) {
      setBlobUrl(null);
      setMimeType(null);
      setError("");
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    downloadDocument(doc.id)
      .then((blob) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setMimeType(blob.type);
        setBlobUrl(url);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          isOffline(err)
            ? "The server is unreachable - the preview could not be loaded."
            : err?.message || "This document could not be previewed."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, doc?.id]);

  const fileName = `${doc?.title || "document"}.${(doc?.fileType || "file").toLowerCase()}`;
  const effectiveMime = mimeType || "";
  const isImage = Boolean(
    effectiveMime.startsWith("image/") || fileName.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
  );
  const isPdf = Boolean(
    !isImage && (effectiveMime === "application/pdf" || fileName.toLowerCase().endsWith(".pdf"))
  );

  const handleOpenInNewTab = () => {
    if (blobUrl) window.open(blobUrl, "_blank", "noopener,noreferrer");
  };

  const frameSx = {
    height,
    borderRadius: 2,
    bgcolor: "background.default",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
    overflow: "hidden",
  };

  if (loading) {
    return (
      <Box sx={{ ...frameSx, border: "2px dashed", borderColor: "divider" }}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">Loading preview…</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ ...frameSx, border: "2px dashed", borderColor: "divider" }}>
        <DescriptionOutlinedIcon sx={{ fontSize: 56, color: "text.disabled" }} />
        <Typography variant="body2" color="text.secondary" sx={{ px: 2, textAlign: "center" }}>
          {error}
        </Typography>
      </Box>
    );
  }

  if (blobUrl && isImage) {
    return (
      <Box sx={{ ...frameSx, border: "1px solid", borderColor: "divider" }}>
        <img
          src={blobUrl}
          alt={doc.title}
          style={{ maxWidth: "100%", maxHeight: height, objectFit: "contain" }}
        />
      </Box>
    );
  }

  if (blobUrl && isPdf) {
    return (
      <Box sx={{ ...frameSx, border: "1px solid", borderColor: "divider", p: 0 }}>
        <iframe
          src={blobUrl}
          title={doc.title}
          style={{ width: "100%", height: "100%", border: "none" }}
        />
      </Box>
    );
  }

  if (blobUrl) {
    // A file type we can't render inline (DOCX, XLSX, ...) - offer the same
    // "open in a new tab" escape hatch the onboarding preview uses.
    return (
      <Box sx={{ ...frameSx, border: "2px dashed", borderColor: "divider" }}>
        <DescriptionOutlinedIcon sx={{ fontSize: 56, color: "text.disabled" }} />
        <Typography variant="body2" color="text.secondary">
          Inline preview isn't available for {doc.fileType} files
        </Typography>
        <Button size="small" startIcon={<OpenInNewIcon fontSize="small" />} onClick={handleOpenInNewTab}>
          Open in new tab
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ ...frameSx, border: "2px dashed", borderColor: "divider" }}>
      <DescriptionOutlinedIcon sx={{ fontSize: 56, color: "text.disabled" }} />
      <Typography variant="body2" color="text.secondary">
        Preview not available - {doc?.fileType} file
      </Typography>
    </Box>
  );
}
