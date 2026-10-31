import {
  Box, Card, CardActionArea, CardContent, IconButton,
  Tooltip, Typography,
} from "@mui/material";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { useNavigate } from "react-router-dom";
import DocumentStatusChip from "./DocumentStatusChip";
import DocumentCategoryChip from "./DocumentCategoryChip";

const FILE_COLORS = { PDF: "#a83b3b", DOCX: "#2f5aa8", JPG: "#a8823c", PNG: "#2f7a3f" };

export default function DocumentCard({ doc, onDelete, onPreview }) {
  const navigate = useNavigate();
  const iconColor = FILE_COLORS[doc.fileType] ?? "#5b6472";

  return (
    <Card sx={{ borderRadius: 2, boxShadow: 1, height: "100%", display: "flex", flexDirection: "column" }}>
      <CardActionArea onClick={() => navigate(`/documents/${doc.id}`)} sx={{ flexGrow: 1 }}>
        <CardContent>
          <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1.5 }}>
            <Box sx={{
              width: 44, height: 44, borderRadius: 1.5, flexShrink: 0,
              bgcolor: `${iconColor}18`, display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <DescriptionOutlinedIcon sx={{ color: iconColor }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" fontWeight={700} noWrap title={doc.title}>
                {doc.title}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {doc.fileType} · {doc.fileSize}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1 }}>
            <DocumentCategoryChip category={doc.category} />
            <DocumentStatusChip status={doc.status} />
          </Box>
          <Typography variant="caption" color="text.secondary" display="block">
            {doc.ownerName}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Uploaded {doc.uploadDate}
          </Typography>
        </CardContent>
      </CardActionArea>
      <Box sx={{ display: "flex", justifyContent: "flex-end", px: 1, pb: 1, gap: 0.5 }}>
        <Tooltip title="Preview">
          <IconButton size="small" onClick={() => onPreview(doc)}>
            <VisibilityOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {doc.downloadable && (
          <Tooltip title="Download">
            <IconButton size="small">
              <DownloadOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Delete">
          <IconButton size="small" color="error" onClick={() => onDelete(doc)}>
            <DeleteOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Card>
  );
}
