import { Box, Divider, Paper, Typography } from "@mui/material";
import DocumentStatusChip from "./DocumentStatusChip";
import DocumentCategoryChip from "./DocumentCategoryChip";

function Row({ label, children }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>{label}</Typography>
      <Box sx={{ textAlign: "right" }}>{children}</Box>
    </Box>
  );
}

export default function DocumentInfoPanel({ doc }) {
  return (
    <Paper elevation={1} sx={{ borderRadius: 2, p: 2.5 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Document Information</Typography>
      <Divider sx={{ mb: 1.5 }} />
      <Row label="Category"><DocumentCategoryChip category={doc.category} /></Row>
      <Row label="Status"><DocumentStatusChip status={doc.status} /></Row>
      <Row label="File Type">
        <Typography variant="body2" fontWeight={600}>{doc.fileType}</Typography>
      </Row>
      <Row label="File Size">
        <Typography variant="body2" fontWeight={600}>{doc.fileSize}</Typography>
      </Row>
      <Row label="Visibility">
        <Typography variant="body2" fontWeight={600} sx={{ textTransform: "capitalize" }}>
          {doc.visibility.replace("_", " ")}
        </Typography>
      </Row>
      <Row label="Owner">
        <Typography variant="body2" fontWeight={600}>{doc.ownerName}</Typography>
      </Row>
      <Row label="Uploaded By">
        <Typography variant="body2" fontWeight={600}>{doc.uploadedBy}</Typography>
      </Row>
      <Row label="Upload Date">
        <Typography variant="body2" fontWeight={600}>{doc.uploadDate}</Typography>
      </Row>
      <Row label="Last Modified">
        <Typography variant="body2" fontWeight={600}>{doc.lastModified}</Typography>
      </Row>
      <Row label="Downloadable">
        <Typography variant="body2" fontWeight={600}>{doc.downloadable ? "Yes" : "No"}</Typography>
      </Row>
    </Paper>
  );
}
