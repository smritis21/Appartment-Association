import {
  Box,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import { useRef, useState } from "react";

export default function DocumentUploadCard({ docKey, label, required = false, accept = "*", onUpload, onRemove, uploadedFile }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setProgress(0);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result;
      const interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setUploading(false);
            onUpload?.(docKey, {
              name: file.name,
              size: file.size,
              type: file.type,
              rawFile: file,
              dataUrl,
            });
            return 100;
          }
          return prev + 25;
        });
      }, 100);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    handleFileChange({ target: { files: [file], value: "" } });
  };

  const handleDragOver = (e) => e.preventDefault();

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderStyle: uploadedFile ? "solid" : "dashed",
        borderColor: uploadedFile ? "success.main" : "divider",
        bgcolor: uploadedFile ? "success.50" : "background.default",
        p: 2,
        cursor: uploadedFile ? "default" : "pointer",
        transition: "border-color 0.2s",
        "&:hover": !uploadedFile ? { borderColor: "primary.main", bgcolor: "primary.light" } : {},
      }}
      onClick={() => !uploadedFile && inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {uploadedFile ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <CheckCircleOutlinedIcon sx={{ color: "success.main", flexShrink: 0 }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {uploadedFile.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {(uploadedFile.size / 1024).toFixed(1)} KB
            </Typography>
          </Box>
          <Tooltip title="Remove">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); onRemove?.(docKey); }}
              sx={{ color: "error.main" }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ) : (
        <Box sx={{ textAlign: "center", py: 1 }}>
          {uploading ? (
            <Box>
              <InsertDriveFileOutlinedIcon sx={{ color: "primary.main", mb: 0.5 }} />
              <LinearProgress variant="determinate" value={progress} sx={{ mt: 1, borderRadius: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                Uploading... {progress}%
              </Typography>
            </Box>
          ) : (
            <>
              <CloudUploadOutlinedIcon sx={{ color: "text.secondary", fontSize: 32, mb: 0.5 }} />
              <Typography variant="body2" fontWeight={600} color="text.primary">
                {label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Drag & drop or click to upload
              </Typography>
              {required && (
                <Box sx={{ mt: 0.5 }}>
                  <Chip label="Required" size="small" color="error" variant="outlined" sx={{ fontSize: 10 }} />
                </Box>
              )}
            </>
          )}
        </Box>
      )}
    </Paper>
  );
}
