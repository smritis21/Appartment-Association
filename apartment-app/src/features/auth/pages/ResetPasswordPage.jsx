import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink } from "react-router-dom";
import * as authService from "../../../services/authService";
import { isOffline } from "../../../services/apiClient";
import PasswordStrengthBar from "../../../components/common/PasswordStrengthBar";

export default function ResetPasswordPage() {
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm();

  const newPassword = watch("newPassword", "");

  const onSubmit = async (data) => {
    setLoading(true);
    setError("");
    try {
      await authService.resetPassword(data.token, data.newPassword);
      setDone(true);
    } catch (err) {
      setError(isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Box sx={{ textAlign: "center", py: 2 }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 64, color: "success.main", mb: 2 }} />
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Password Reset Successful
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Your password has been updated. You can now sign in with your new password.
        </Typography>
        <Button variant="contained" component={RouterLink} to="/login" sx={{ fontWeight: 600 }}>
          Back to Login
        </Button>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Reset Password
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enter the reset token you received and your new password below.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        label="Reset Token"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        error={!!errors.token}
        helperText={errors.token?.message}
        {...register("token", { required: "Reset token is required" })}
      />

      <Box sx={{ mb: 2 }}>
        <TextField
          label="New Password"
          type={showNew ? "text" : "password"}
          fullWidth
          size="small"
          error={!!errors.newPassword}
          helperText={errors.newPassword?.message}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowNew((p) => !p)} edge="end">
                    {showNew ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
          {...register("newPassword", {
            required: "New password is required",
            minLength: { value: 8, message: "Minimum 8 characters" },
          })}
        />
        <PasswordStrengthBar password={newPassword} />
      </Box>

      <TextField
        label="Confirm New Password"
        type={showConfirm ? "text" : "password"}
        fullWidth
        size="small"
        sx={{ mb: 3 }}
        error={!!errors.confirmPassword}
        helperText={errors.confirmPassword?.message}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowConfirm((p) => !p)} edge="end">
                  {showConfirm ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
        {...register("confirmPassword", {
          required: "Please confirm your password",
          validate: (v) => v === newPassword || "Passwords do not match",
        })}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={loading}
        sx={{ fontWeight: 600, mb: 2 }}
      >
        {loading ? <CircularProgress size={22} color="inherit" /> : "Reset Password"}
      </Button>

      <Box sx={{ textAlign: "center" }}>
        <Link component={RouterLink} to="/login" variant="body2" color="text.secondary">
          Back to Login
        </Link>
      </Box>
    </Box>
  );
}
