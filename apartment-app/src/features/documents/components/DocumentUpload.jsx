import {
  Box, Button, Chip, LinearProgress, Typography,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { useRef, useState } from "react";

const ACCEPTED = ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg", "image/png"];
const ACCEPTED_LABELS = "PDF, DOCX, JPG, PNG";
const MAX_MB = 20;

export default function DocumentUpload({ onFileSelected, onFileRemoved }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  const handleFile = (f) => {
    setError("");
    if (!ACCEPTED.includes(f.type)) {
      setError(`Unsupported file type. Accepted: ${ACCEPTED_LABELS}`);
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File exceeds ${MAX_MB} MB limit.`);
      return;
    }
    setFile(f);
    setDone(false);
    setProgress(0);
    simulateUpload(f);
  };

  const simulateUpload = (f) => {
    setUploading(true);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 25;
      if (p >= 100) {
        p = 100;
        clearInterval(iv);
        setUploading(false);
        setDone(true);
        onFileSelected?.(f);
      }
      setProgress(Math.min(p, 100));
    }, 200);
  };

  const handleRemove = () => {
    setFile(null);
    setProgress(0);
    setDone(false);
    setError("");
    onFileRemoved?.();
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  return (
    <Box>
      {!file ? (
        <Box
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          sx={{
            border: "2px dashed",
            borderColor: dragging ? "primary.main" : "divider",
            borderRadius: 2,
            p: 4,
            textAlign: "center",
            cursor: "pointer",
            bgcolor: dragging ? "primary.light" : "background.default",
            transition: "all 0.2s",
            "&:hover": { borderColor: "primary.main", bgcolor: "primary.light" },
          }}
        >
          <CloudUploadOutlinedIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography variant="body1" fontWeight={600}>Drag & drop a file here</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            or click to browse
          </Typography>
          <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 1 }}>
            Accepted: {ACCEPTED_LABELS} · Max {MAX_MB} MB
          </Typography>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept=".pdf,.docx,.jpg,.jpeg,.png"
            onChange={(e) => { if (e.target.files[0]) handleFile(e.target.files[0]); }}
          />
        </Box>
      ) : (
        <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
            <InsertDriveFileOutlinedIcon color="primary" />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="body2" fontWeight={600} noWrap>{file.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {(file.size / 1024).toFixed(0)} KB
              </Typography>
            </Box>
            {done && <Chip label="Uploaded" color="success" size="small" />}
            <Button size="small" color="error" startIcon={<DeleteOutlinedIcon />} onClick={handleRemove}>
              Remove
            </Button>
          </Box>
          {uploading && (
            <Box>
              <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 1, mb: 0.5 }} />
              <Typography variant="caption" color="text.secondary">Uploading... {Math.round(progress)}%</Typography>
            </Box>
          )}
          {done && (
            <Typography variant="caption" color="success.main" fontWeight={600}>
              ✓ Upload complete
            </Typography>
          )}
        </Box>
      )}
      {error && (
        <Typography variant="caption" color="error" sx={{ mt: 0.75, display: "block" }}>
          {error}
        </Typography>
      )}
    </Box>
  );
}
