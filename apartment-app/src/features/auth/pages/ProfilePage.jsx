import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  Paper,
  Snackbar,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import * as authService from "../../../services/authService";
import { isOffline } from "../../../services/apiClient";
import { ROLE_LABELS, ROLE_COLORS } from "../mock/roles";
import PageHeader from "../../../components/common/PageHeader";
import "../styles/ProfilePage.css";

export default function ProfilePage() {
  const { user, updateUser, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
    },
  });

  // Refresh the profile (and, via AuthContext, the linked resident's
  // flat/wing/phone) from the API on mount so edits made elsewhere (or by an
  // admin) are reflected, and re-sync the form once it lands.
  useEffect(() => {
    let cancelled = false;
    refreshProfile()
      .then((profile) => {
        if (!cancelled) reset({ name: profile.name, email: profile.email });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const profile = await authService.updateProfile({ fullName: data.name });
      updateUser(profile);
      setEditing(false);
      setSnackbar({ open: true, message: "Profile updated successfully.", severity: "success" });
    } catch (err) {
      setSnackbar({
        open: true,
        message: isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message,
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    reset({ name: user?.name, email: user?.email });
    setEditing(false);
  };

  if (!user) return null;

  return (
    <Box>
      <PageHeader
        title="My Profile"
        subtitle="View and manage your account details"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Profile" }]}
      />

      <Grid container spacing={3} sx={{ maxWidth: 860 }}>
        {/* Avatar card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper elevation={1} sx={{ borderRadius: 3, p: 3, textAlign: "center" }}>
            <Box sx={{ position: "relative", display: "inline-block", mb: 2 }}>
              <Avatar
                sx={{
                  width: 96,
                  height: 96,
                  bgcolor: "primary.main",
                  fontSize: 36,
                  fontWeight: 700,
                }}
              >
                {user.name?.[0]?.toUpperCase()}
              </Avatar>
              <Tooltip title="Change photo (coming soon)">
                <IconButton
                  size="small"
                  sx={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    "&:hover": { bgcolor: "primary.light" },
                  }}
                >
                  <PhotoCameraOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            <Typography variant="h6" fontWeight={700}>
              {user.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {user.email}
            </Typography>
            <Chip
              label={ROLE_LABELS[user.role] ?? user.role}
              color={ROLE_COLORS[user.role] ?? "default"}
              size="small"
              sx={{ mb: 2 }}
            />

            <Divider sx={{ my: 2 }} />

            <Button
              variant="outlined"
              fullWidth
              startIcon={<LockOutlinedIcon />}
              onClick={() => navigate("/change-password")}
              size="small"
            >
              Change Password
            </Button>
          </Paper>
        </Grid>

        {/* Details card */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper elevation={1} sx={{ borderRadius: 3, p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>
                Personal Information
              </Typography>
              {!editing && (
                <Button
                  startIcon={<EditOutlinedIcon />}
                  size="small"
                  onClick={() => setEditing(true)}
                  variant="outlined"
                >
                  Edit
                </Button>
              )}
            </Box>

            <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Full Name"
                    fullWidth
                    size="small"
                    disabled={!editing}
                    error={!!errors.name}
                    helperText={errors.name?.message}
                    {...register("name", { required: "Name is required" })}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Flat Number"
                    fullWidth
                    size="small"
                    disabled
                    value={user.flat ?? ""}
                    helperText="Managed via the Resident record"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Email Address"
                    type="email"
                    fullWidth
                    size="small"
                    disabled
                    value={user.email}
                    helperText="Changing your email requires re-verification (not yet supported)"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Phone Number"
                    fullWidth
                    size="small"
                    disabled
                    value={user.phone ?? ""}
                    helperText="Managed via the Resident record"
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Role"
                    fullWidth
                    size="small"
                    disabled
                    value={ROLE_LABELS[user.role] ?? user.role}
                  />
                </Grid>
              </Grid>

              {editing && (
                <Box sx={{ display: "flex", gap: 1.5, mt: 3 }}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={loading}
                    sx={{ fontWeight: 600 }}
                  >
                    {loading ? <CircularProgress size={20} color="inherit" /> : "Save Changes"}
                  </Button>
                  <Button variant="outlined" color="inherit" onClick={handleCancel}>
                    Cancel
                  </Button>
                </Box>
              )}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
