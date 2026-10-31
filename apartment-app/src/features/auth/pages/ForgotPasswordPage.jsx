import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink } from "react-router-dom";
import * as authService from "../../../services/authService";
import { isOffline } from "../../../services/apiClient";
import { validators } from "../../../utils/validators";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      // The backend always returns the same acknowledgement regardless of
      // whether the email is registered, to prevent enumeration.
      const result = await authService.forgotPassword(data.email);
      setSnackbar({ open: true, message: result.detail, severity: "success" });
      reset();
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

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Forgot Password
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter your registered email and we'll send you a reset link.
      </Typography>

      <TextField
        label="Email Address"
        type="email"
        fullWidth
        size="small"
        sx={{ mb: 3 }}
        error={!!errors.email}
        helperText={errors.email?.message}
        {...register("email", validators.email)}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={loading}
        sx={{ fontWeight: 600, mb: 2 }}
      >
        {loading ? <CircularProgress size={22} color="inherit" /> : "Send Reset Link"}
      </Button>

      <Box sx={{ textAlign: "center" }}>
        <Link
          component={RouterLink}
          to="/login"
          variant="body2"
          color="text.secondary"
          sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
        >
          <ArrowBackIcon fontSize="inherit" /> Back to Login
        </Link>
      </Box>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
