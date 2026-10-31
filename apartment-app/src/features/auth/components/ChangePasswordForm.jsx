import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useState } from "react";
import { useForm } from "react-hook-form";
import * as authService from "../../../services/authService";
import { ApiError, isOffline } from "../../../services/apiClient";
import PasswordStrengthBar from "../../../components/common/PasswordStrengthBar";

export default function ChangePasswordForm({ onSuccess }) {
  const [show, setShow] = useState({ current: false, next: false, confirm: false });
  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const toggle = (field) => setShow((p) => ({ ...p, [field]: !p[field] }));

  const {
    register,
    handleSubmit,
    watch,
    setError,
    reset,
    formState: { errors },
  } = useForm();

  const newPassword = watch("newPassword", "");

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await authService.changePassword(data.currentPassword, data.newPassword);
      setSuccessOpen(true);
      reset();
      onSuccess?.();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("currentPassword", { message: "Current password is incorrect." });
      } else {
        setError("currentPassword", {
          message: isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const visibilityAdornment = (field) => (
    <InputAdornment position="end">
      <IconButton size="small" onClick={() => toggle(field)} edge="end">
        {show[field] ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
      </IconButton>
    </InputAdornment>
  );

  return (
    <>
      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <TextField
          label="Current Password"
          type={show.current ? "text" : "password"}
          fullWidth
          size="small"
          error={!!errors.currentPassword}
          helperText={errors.currentPassword?.message}
          slotProps={{ input: { endAdornment: visibilityAdornment("current") } }}
          {...register("currentPassword", { required: "Current password is required" })}
        />

        <Box>
          <TextField
            label="New Password"
            type={show.next ? "text" : "password"}
            fullWidth
            size="small"
            error={!!errors.newPassword}
            helperText={errors.newPassword?.message}
            slotProps={{ input: { endAdornment: visibilityAdornment("next") } }}
            {...register("newPassword", {
              required: "New password is required",
              minLength: { value: 8, message: "Minimum 8 characters" },
            })}
          />
          <PasswordStrengthBar password={newPassword} />
        </Box>

        <TextField
          label="Confirm New Password"
          type={show.confirm ? "text" : "password"}
          fullWidth
          size="small"
          error={!!errors.confirmPassword}
          helperText={errors.confirmPassword?.message}
          slotProps={{ input: { endAdornment: visibilityAdornment("confirm") } }}
          {...register("confirmPassword", {
            required: "Please confirm your new password",
            validate: (v) => v === newPassword || "Passwords do not match",
          })}
        />

        <Button type="submit" variant="contained" fullWidth size="large" disabled={loading} sx={{ fontWeight: 600, mt: 1 }}>
          {loading ? <CircularProgress size={22} color="inherit" /> : "Update Password"}
        </Button>
      </Box>

      <Dialog open={successOpen} onClose={() => setSuccessOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ textAlign: "center", pt: 4 }}>
          <CheckCircleOutlineIcon sx={{ fontSize: 52, color: "success.main" }} />
          <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
            Password Updated
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
            Your password has been changed successfully.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
          <Button variant="contained" onClick={() => setSuccessOpen(false)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
