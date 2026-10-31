import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link as RouterLink, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as authService from "../../../services/authService";
import { isOffline } from "../../../services/apiClient";
import { ROLE_DASHBOARD_PATHS, ROLE_LABELS, ROLE_COLORS } from "../mock/roles";
import { useAuth } from "../../../hooks/useAuth";
import { validators } from "../../../utils/validators";
import Chip from "@mui/material/Chip";

export default function LoginForm() {
  const { login, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggedInUser, setLoggedInUser] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({ defaultValues: { email: "", password: "", remember: false } });

  const onSubmit = async (data) => {
    setLoading(true);
    setError("");
    try {
      const { token, user } = await authService.login(data.email, data.password);
      login(user, token, data.remember);
      const profile = await refreshProfile();
      const fullUser = { ...user, ...profile };
      setLoggedInUser(fullUser);
      setTimeout(() => {
        navigate(ROLE_DASHBOARD_PATHS[fullUser.role] ?? "/dashboard");
      }, 900);
    } catch (err) {
      setError(isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message);
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        {t("login.welcomeBack", { defaultValue: "Welcome back" })}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t("login.signInSubtitle", { defaultValue: "Sign in to your account" })}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loggedInUser && (
        <Alert
          severity="success"
          sx={{ mb: 2 }}
          icon={false}
          action={
            <Chip
              label={ROLE_LABELS[loggedInUser.role]}
              color={ROLE_COLORS[loggedInUser.role] ?? "default"}
              size="small"
            />
          }
        >
          Welcome, {loggedInUser.name}!
        </Alert>
      )}

      <TextField
        label={t("login.emailLabel", { defaultValue: "Email Address" })}
        type="email"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        error={!!errors.email}
        helperText={errors.email?.message}
        {...register("email", validators.email)}
      />

      <TextField
        label={t("login.passwordLabel", { defaultValue: "Password" })}
        type={showPassword ? "text" : "password"}
        fullWidth
        size="small"
        sx={{ mb: 1 }}
        error={!!errors.password}
        helperText={errors.password?.message}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => setShowPassword((p) => !p)} edge="end">
                  {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
        {...register("password", validators.password)}
      />

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2.5 }}>
        <FormControlLabel
          control={<Checkbox size="small" {...register("remember")} />}
          label={<Typography variant="body2">{t("login.rememberMe", { defaultValue: "Remember me" })}</Typography>}
        />
        <Link component={RouterLink} to="/forgot-password" variant="body2" color="primary">
          {t("login.forgotPassword", { defaultValue: "Forgot password?" })}
        </Link>
      </Box>

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={loading}
        sx={{ fontWeight: 600 }}
      >
        {loading ? <CircularProgress size={22} color="inherit" /> : t("login.signIn", { defaultValue: "Sign In" })}
      </Button>

      <Divider sx={{ my: 2.5 }} />

      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
        {t("login.newResident", { defaultValue: "New resident?" })}{" "}
        <Link component={RouterLink} to="/signup" color="primary" fontWeight={600}>
          {t("login.registerHere", { defaultValue: "Register here" })}
        </Link>
      </Typography>
    </Box>
  );
}
