import {
  Alert, Box, Button, Grid, MenuItem, Paper, Snackbar, TextField, Typography,
} from "@mui/material";
import ArrowBackOutlinedIcon from "@mui/icons-material/ArrowBackOutlined";
import UploadOutlinedIcon from "@mui/icons-material/UploadOutlined";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useResidents } from "../../../context/ResidentContext";
import { DOC_CATEGORIES, DOC_VISIBILITY } from "../mock/documents";
import { uploadDocument } from "../../../services/documentService";
import { isOffline } from "../../../services/apiClient";
import { useAuthContext } from "../../../context/AuthContext";
import PageHeader from "../../../components/common/PageHeader";
import DocumentUpload from "../components/DocumentUpload";

export default function UploadDocumentPage() {
  const navigate = useNavigate();
  const { residents } = useResidents();
  const activeResidents = residents.filter((r) => r.status === "active");

  const [uploadedFile, setUploadedFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [toast, setToast] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const { user } = useAuthContext();

  const { control, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: {
      title: "",
      description: "",
      category: "",
      residentId: "",
      visibility: DOC_VISIBILITY.PRIVATE,
    },
  });

  const selectedResidentId = watch("residentId");
  const selectedResident = activeResidents.find((r) => r.id === selectedResidentId);

  // INT-38: the file is sent to the API as multipart. The screen only reports
  // success once the server has stored it, so a rejected type, an oversized
  // file or a permission error is shown rather than a false confirmation.
  const onSubmit = async (data) => {
    if (!uploadedFile) {
      setFileError("Please upload a file.");
      return;
    }
    setFileError("");
    setUploadError("");
    setUploading(true);

    try {
      await uploadDocument({
        file: uploadedFile,
        title: data.title,
        category: data.category,
        description: data.description,
        // The API models reach as an access role; the form speaks of
        // visibility, so a public document maps across to "public".
        accessRole: data.visibility === DOC_VISIBILITY.PUBLIC ? "public" : "resident",
        uploadedBy: user?.name || "Society Admin",
      });
      setToast(true);
      setTimeout(() => navigate("/documents"), 1200);
    } catch (err) {
      setUploadError(
        isOffline(err)
          ? "The server is unreachable, so the document was not uploaded."
          : err?.message || "The document could not be uploaded."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Upload Document"
        subtitle="Add a new document to the repository"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Documents", href: "/documents" },
          { label: "Upload" },
        ]}
        action={
          <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate("/documents")}>
            Cancel
          </Button>
        }
      />

      <Grid container spacing={3} justifyContent="center">
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={1} sx={{ borderRadius: 2, p: 3 }}>
            <Box component="form" onSubmit={handleSubmit(onSubmit)}>
              {uploadError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError("")}>
                  {uploadError}
                </Alert>
              )}
              <Grid container spacing={2.5}>
                {/* Title */}
                <Grid size={{ xs: 12 }}>
                  <Controller
                    name="title"
                    control={control}
                    rules={{ required: "Title is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Document Title"
                        fullWidth
                        size="small"
                        error={!!errors.title}
                        helperText={errors.title?.message}
                      />
                    )}
                  />
                </Grid>

                {/* Description */}
                <Grid size={{ xs: 12 }}>
                  <Controller
                    name="description"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Description"
                        fullWidth
                        size="small"
                        multiline
                        rows={3}
                      />
                    )}
                  />
                </Grid>

                {/* Category */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="category"
                    control={control}
                    rules={{ required: "Category is required" }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        select
                        label="Category"
                        fullWidth
                        size="small"
                        error={!!errors.category}
                        helperText={errors.category?.message}
                      >
                        {Object.values(DOC_CATEGORIES).map((c) => (
                          <MenuItem key={c} value={c}>{c}</MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>

                {/* Visibility */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="visibility"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        select
                        label="Visibility"
                        fullWidth
                        size="small"
                      >
                        {Object.values(DOC_VISIBILITY).map((v) => (
                          <MenuItem key={v} value={v} sx={{ textTransform: "capitalize" }}>
                            {v.replace("_", " ")}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>

                {/* Resident selector */}
                <Grid size={{ xs: 12 }}>
                  <Controller
                    name="residentId"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        select
                        label="Resident (optional)"
                        fullWidth
                        size="small"
                      >
                        <MenuItem value="">- None (Society Document) -</MenuItem>
                        {activeResidents.map((r) => (
                          <MenuItem key={r.id} value={r.id}>
                            {r.name} · Wing {r.wing}, Flat {r.flat} · {r.role}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                  {selectedResident && (
                    <Box sx={{
                      mt: 1, p: 1.5, bgcolor: "primary.light", borderRadius: 1.5,
                      display: "flex", gap: 3,
                    }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Name</Typography>
                        <Typography variant="body2" fontWeight={600}>{selectedResident.name}</Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Flat</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          Wing {selectedResident.wing}, {selectedResident.flat}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">Role</Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ textTransform: "capitalize" }}>
                          {selectedResident.role}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Grid>

                {/* File upload */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Upload File
                  </Typography>
                  <DocumentUpload
                    onFileSelected={(f) => { setUploadedFile(f); setFileError(""); }}
                    onFileRemoved={() => setUploadedFile(null)}
                  />
                  {fileError && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
                      {fileError}
                    </Typography>
                  )}
                </Grid>

                {/* Actions */}
                <Grid size={{ xs: 12 }}>
                  <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                    <Button variant="outlined" color="inherit" onClick={() => navigate("/documents")}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="contained"
                      startIcon={<UploadOutlinedIcon />}
                      disabled={uploading}
                      sx={{ fontWeight: 600 }}
                    >
                      {uploading ? "Uploading…" : "Upload Document"}
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={toast}
        autoHideDuration={3000}
        onClose={() => setToast(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" onClose={() => setToast(false)}>
          Document uploaded successfully!
        </Alert>
      </Snackbar>
    </Box>
  );
}

