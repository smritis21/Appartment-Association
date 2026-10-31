import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  FormLabel,
  IconButton,
  InputAdornment,
  Link,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { Link as RouterLink } from "react-router-dom";
import * as authService from "../../../services/authService";
import * as onboardingService from "../../../services/onboardingService";
import { isOffline } from "../../../services/apiClient";
import { validators } from "../../../utils/validators";
import PasswordStrengthBar from "../../../components/common/PasswordStrengthBar";

/** "A-101" -> { block: "A", flatNumber: "101" }. Falls back to using the
 * whole value for both when there's no separator, since the form only
 * exposes a single "Flat Number" field but the backend needs block and
 * flat_number split out. */
function splitFlat(value) {
  const [block, ...rest] = value.split("-");
  const flatNumber = rest.join("-").trim();
  return flatNumber ? { block: block.trim(), flatNumber } : { block: value.trim(), flatNumber: value.trim() };
}

export default function SignUpPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    control,
    formState: { errors },
  } = useForm({ defaultValues: { registrationType: "owner" } });

  const password = watch("password", "");

  const onSubmit = async (data) => {
    setLoading(true);
    setError("");
    try {
      const account = await authService.register({
        email: data.email,
        password: data.password,
        fullName: data.name,
        role: data.registrationType,
      });
      const { block, flatNumber } = splitFlat(data.flat);
      await onboardingService.registerApplication({
        applicantName: data.name,
        email: data.email,
        phone: data.phone,
        applicantType: data.registrationType,
        block,
        flatNumber,
        occupation: data.occupation,
        userId: account.id,
      });
      setSubmitted(true);
    } catch (err) {
      setError(isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <Box sx={{ textAlign: "center", py: 2 }}>
        <CheckCircleOutlineIcon sx={{ fontSize: 64, color: "success.main", mb: 2 }} />
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Registration Submitted
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Your registration is under review. You will be notified once the Association approves your account.
        </Typography>
        <Alert severity="info" sx={{ textAlign: "left", mb: 3 }}>
          Waiting for Association Approval
        </Alert>
        <Link component={RouterLink} to="/login" variant="body2" color="primary" fontWeight={600}>
          Back to Login
        </Link>
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Typography variant="h6" fontWeight={700} gutterBottom>
        Create Account
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Register as a new resident
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <FormControl component="fieldset" sx={{ mb: 2.5 }} error={!!errors.registrationType}>
        <FormLabel component="legend" sx={{ fontSize: 13, mb: 0.5 }}>
          Registration Type
        </FormLabel>
        <Controller
          name="registrationType"
          control={control}
          rules={{ required: "Please select a registration type" }}
          render={({ field }) => (
            <RadioGroup row {...field}>
              <FormControlLabel value="owner" control={<Radio size="small" />} label="Owner" />
              <FormControlLabel value="tenant" control={<Radio size="small" />} label="Tenant" />
            </RadioGroup>
          )}
        />
        {errors.registrationType && (
          <FormHelperText>{errors.registrationType.message}</FormHelperText>
        )}
      </FormControl>

      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, mb: 2 }}>
        <TextField
          label="Full Name"
          fullWidth
          size="small"
          error={!!errors.name}
          helperText={errors.name?.message}
          {...register("name", { required: "Full name is required" })}
        />
        <TextField
          label="Flat Number"
          fullWidth
          size="small"
          placeholder="e.g. A-101"
          error={!!errors.flat}
          helperText={errors.flat?.message}
          {...register("flat", {
            required: "Flat number is required",
            pattern: { value: /^[A-Za-z0-9]+-[A-Za-z0-9]+$/, message: "Use the format Block-Number, e.g. A-101" },
          })}
        />
      </Box>

      <TextField
        label="Email Address"
        type="email"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        error={!!errors.email}
        helperText={errors.email?.message}
        {...register("email", validators.email)}
      />

      <TextField
        label="Phone Number"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        error={!!errors.phone}
        helperText={errors.phone?.message}
        {...register("phone", validators.phone)}
      />

      <TextField
        label="Occupation (Optional)"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        error={!!errors.occupation}
        helperText={errors.occupation?.message}
        {...register("occupation")}
      />

      <Box sx={{ mb: 2 }}>
        <TextField
          label="Password"
          type={showPassword ? "text" : "password"}
          fullWidth
          size="small"
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
        <PasswordStrengthBar password={password} />
      </Box>

      <TextField
        label="Confirm Password"
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
          validate: (v) => v === password || "Passwords do not match",
        })}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={loading}
        sx={{ fontWeight: 600 }}
      >
        {loading ? <CircularProgress size={22} color="inherit" /> : "Submit Registration"}
      </Button>

      <Divider sx={{ my: 2.5 }} />

      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
        Already have an account?{" "}
        <Link component={RouterLink} to="/login" color="primary" fontWeight={600}>
          Sign in
        </Link>
      </Typography>
    </Box>
  );
}
