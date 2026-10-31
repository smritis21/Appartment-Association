import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { validators } from "../../../utils/validators";
import { WINGS, APPLICATION_STATUS } from "../mock/onboarding";
import { useOnboarding } from "../../../context/OnboardingContext";
import * as authService from "../../../services/authService";
import * as onboardingService from "../../../services/onboardingService";
import { isOffline } from "../../../services/apiClient";
import PasswordStrengthBar from "../../../components/common/PasswordStrengthBar";
import DocumentUploadCard from "./DocumentUploadCard";
import OnboardingStepperHeader from "./OnboardingStepperHeader";
import PageHeader from "../../../components/common/PageHeader";

export default function OnboardingForm({ type = "owner" }) {
  const navigate = useNavigate();
  const { addApplication } = useOnboarding();
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploads, setUploads] = useState({});
  const [successApp, setSuccessApp] = useState(null);
  const [error, setError] = useState("");
  const [ownerNameLocked, setOwnerNameLocked] = useState(false);

  const isOwner = type === "owner";

  const { register, handleSubmit, watch, control, setValue, formState: { errors } } = useForm();
  const password = watch("password", "");
  const wing = watch("wing");
  const flatNumber = watch("flat");

  const handleUpload = (key, file) => setUploads((p) => ({ ...p, [key]: file }));
  const handleRemove = (key) => setUploads((p) => { const n = { ...p }; delete n[key]; return n; });

  // Auto-fill "Owner Name" for tenant applications by looking up whether an
  // approved owner application already exists for the block/flat the
  // applicant just entered. Falls back to manual entry when nothing matches.
  useEffect(() => {
    if (isOwner || !wing || !flatNumber) {
      setOwnerNameLocked(false);
      return undefined;
    }
    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      try {
        const result = await onboardingService.lookupOwnerForFlat({ block: wing, flatNumber });
        if (cancelled) return;
        if (result.found && result.ownerName) {
          setValue("ownerName", result.ownerName, { shouldValidate: true });
          setOwnerNameLocked(true);
        } else {
          setOwnerNameLocked(false);
        }
      } catch {
        if (!cancelled) setOwnerNameLocked(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [isOwner, wing, flatNumber, setValue]);

  const onSubmit = async (data) => {
    setLoading(true);
    setError("");
    try {
      const account = await authService.register({
        email: data.email,
        password: data.password,
        fullName: `${data.firstName} ${data.lastName}`,
        role: isOwner ? "owner" : "tenant",
      });
      const application = await onboardingService.registerApplication({
        applicantName: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone,
        applicantType: isOwner ? "owner" : "tenant",
        block: data.wing,
        flatNumber: data.flat,
        occupation: data.occupation,
        ownerName: data.ownerName,
        userId: account.id,
      });
      // Upload real document files if present, or fall back to filename reference only
      const uploadedDocList = [];
      for (const [key, file] of Object.entries(uploads)) {
        if (file.rawFile) {
          try {
            const saved = await onboardingService.uploadDocumentFile({
              applicationId: application.id,
              documentType: key,
              file: file.rawFile,
            });
            // Attach local dataUrl so the modal can preview before page reload
            uploadedDocList.push({ ...saved, dataUrl: file.dataUrl });
            continue;
          } catch (err) {
            console.error("Failed to upload file natively:", err);
            // fall through to JSON reference upload
          }
        }
        // Fallback: send filename only - never send large base64 strings via JSON
        const saved = await onboardingService.uploadDocument({
          applicationId: application.id,
          documentType: key,
          fileReference: file.name || `${key}.pdf`,
          fileName: file.name,
        });
        uploadedDocList.push({ ...saved, dataUrl: file.dataUrl });
      }
      addApplication({
        id: application.id,
        name: application.applicantName,
        firstName: data.firstName,
        lastName: data.lastName,
        email: application.email,
        phone: application.phone,
        flat: application.flatNumber,
        wing: application.block,
        occupation: application.occupation,
        role: isOwner ? "owner" : "tenant",
        ownerName: data.ownerName ?? "",
        leaseStart: data.leaseStart ?? "",
        leaseEnd: data.leaseEnd ?? "",
        submittedAt: application.createdAt,
        status: APPLICATION_STATUS.PENDING,
        documents: uploadedDocList.length > 0 ? uploadedDocList : Object.keys(uploads),
        remarks: "",
      });
      setSuccessApp({
        id: application.id,
        name: application.applicantName,
        wing: application.block,
        flat: application.flatNumber,
      });
    } catch (err) {
      setError(isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title={isOwner ? "Owner Registration" : "Tenant Registration"}
        subtitle="Fill in your details to submit your registration request"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Onboarding", href: "/onboarding" },
          { label: isOwner ? "Owner Registration" : "Tenant Registration" },
        ]}
      />

      <OnboardingStepperHeader activeStep={1} />

      {error && (
        <Alert severity="error" sx={{ mb: 2, maxWidth: 720 }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate sx={{ maxWidth: 720 }}>
        {/* Personal Details */}
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Personal Details</Typography>
        
        {/* Row 1: First Name & Last Name */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mb: 2 }}>
          <TextField label="First Name" fullWidth size="small"
            error={!!errors.firstName} helperText={errors.firstName?.message}
            {...register("firstName", { required: "First name is required" })} />
          <TextField label="Last Name" fullWidth size="small"
            error={!!errors.lastName} helperText={errors.lastName?.message}
            {...register("lastName", { required: "Last name is required" })} />
        </Box>

        {/* Row 2: Email & Phone Number */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mb: 2 }}>
          <TextField label="Email Address" type="email" fullWidth size="small"
            error={!!errors.email} helperText={errors.email?.message}
            {...register("email", validators.email)} />
          <TextField label="Phone Number" fullWidth size="small"
            error={!!errors.phone} helperText={errors.phone?.message}
            {...register("phone", validators.phone)} />
        </Box>

        {/* Row 3: Wing, Flat Number & Occupation */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr 1fr" }, gap: 2, mb: 2 }}>
          <Controller name="wing" control={control} rules={{ required: "Wing is required" }}
            render={({ field }) => (
              <TextField select label="Wing" fullWidth size="small"
                error={!!errors.wing} helperText={errors.wing?.message} {...field}>
                {WINGS.map((w) => <MenuItem key={w} value={w}>{w} Wing</MenuItem>)}
              </TextField>
            )} />
          <TextField label="Flat Number" fullWidth size="small" placeholder="e.g. 101"
            error={!!errors.flat} helperText={errors.flat?.message}
            {...register("flat", { required: "Flat number is required" })} />
          <TextField label="Occupation (Optional)" fullWidth size="small"
            error={!!errors.occupation} helperText={errors.occupation?.message}
            {...register("occupation")} />
        </Box>

        {!isOwner && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "2fr 1fr 1fr" }, gap: 2, mb: 2 }}>
            <TextField label="Owner Name" fullWidth size="small"
              disabled={ownerNameLocked}
              error={!!errors.ownerName}
              helperText={errors.ownerName?.message || (ownerNameLocked ? "Auto-filled from the flat's owner on file" : undefined)}
              {...register("ownerName", { required: "Owner name is required" })} />
            <TextField label="Lease Start" type="date" fullWidth size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!errors.leaseStart} helperText={errors.leaseStart?.message}
              {...register("leaseStart", { required: "Lease start date is required" })} />
            <TextField label="Lease End" type="date" fullWidth size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              error={!!errors.leaseEnd} helperText={errors.leaseEnd?.message}
              {...register("leaseEnd", { required: "Lease end date is required" })} />
          </Box>
        )}

        {/* Password */}
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2, mt: 3 }}>Set Password</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2, mb: 3 }}>
          <Box>
            <TextField label="Password" type={showPw ? "text" : "password"} fullWidth size="small"
              error={!!errors.password} helperText={errors.password?.message}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowPw((p) => !p)} edge="end">
                        {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              {...register("password", validators.password)} />
            <PasswordStrengthBar password={password} />
          </Box>
          <TextField label="Confirm Password" type={showConfirm ? "text" : "password"} fullWidth size="small"
            error={!!errors.confirmPassword} helperText={errors.confirmPassword?.message}
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
            })} />
        </Box>

        {/* Documents */}
        <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Upload Documents</Typography>
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DocumentUploadCard docKey="aadhaar" label="Aadhaar Card" required accept=".pdf,.jpg,.jpeg,.png"
              uploadedFile={uploads.aadhaar} onUpload={handleUpload} onRemove={handleRemove} />
          </Grid>
          {isOwner ? (
            <Grid size={{ xs: 12, sm: 6 }}>
              <DocumentUploadCard docKey="sale_deed" label="Sale Deed" required accept=".pdf"
                uploadedFile={uploads.sale_deed} onUpload={handleUpload} onRemove={handleRemove} />
            </Grid>
          ) : (
            <Grid size={{ xs: 12, sm: 6 }}>
              <DocumentUploadCard docKey="rental_agreement" label="Rental Agreement" required accept=".pdf"
                uploadedFile={uploads.rental_agreement} onUpload={handleUpload} onRemove={handleRemove} />
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: 6 }}>
            <DocumentUploadCard docKey="pan" label="PAN Card" accept=".pdf,.jpg,.jpeg,.png"
              uploadedFile={uploads.pan} onUpload={handleUpload} onRemove={handleRemove} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <DocumentUploadCard docKey="photo" label="Passport Size Photo" required accept=".jpg,.jpeg,.png"
              uploadedFile={uploads.photo} onUpload={handleUpload} onRemove={handleRemove} />
          </Grid>
        </Grid>

        {/* Declaration */}
        <Controller name="declaration" control={control}
          rules={{ required: "You must accept the declaration to proceed" }}
          render={({ field, fieldState }) => (
            <Box sx={{ mb: 3 }}>
              <FormControlLabel
                control={<Checkbox {...field} checked={!!field.value} size="small" />}
                label={
                  <Typography variant="body2">
                    I declare that all information provided is true and accurate. I agree to the
                    apartment association's rules and regulations.
                  </Typography>
                }
              />
              {fieldState.error && <FormHelperText error>{fieldState.error.message}</FormHelperText>}
            </Box>
          )} />

        <Box sx={{ display: "flex", gap: 2 }}>
          <Button variant="outlined" color="inherit" onClick={() => navigate("/onboarding")} sx={{ flex: 1 }}>
            Back
          </Button>
          <Button type="submit" variant="contained" disabled={loading} sx={{ flex: 2, fontWeight: 600 }}>
            {loading ? <CircularProgress size={22} color="inherit" /> : "Submit Registration"}
          </Button>
        </Box>
      </Box>

      {/* Fix 2: Success dialog with application number */}
      <Dialog open={!!successApp} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ textAlign: "center", pt: 4 }}>
          <CheckCircleOutlinedIcon sx={{ fontSize: 56, color: "success.main" }} />
          <Typography variant="h6" fontWeight={700} sx={{ mt: 1 }}>
            Registration Submitted Successfully
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ bgcolor: "background.default", borderRadius: 2, p: 2, mb: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">Application Number</Typography>
            <Typography variant="h6" fontWeight={700} fontFamily="monospace" color="primary.main">
              {successApp?.id}
            </Typography>
          </Box>
          <Divider sx={{ my: 1.5 }} />
          {[
            ["Applicant", successApp?.name],
            ["Flat", `Wing ${successApp?.wing} • Flat ${successApp?.flat}`],
            ["Status", "Pending Approval"],
          ].map(([label, value]) => (
            <Box key={label} sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
              <Typography variant="body2" color="text.secondary">{label}</Typography>
              <Typography variant="body2" fontWeight={600}>{value}</Typography>
            </Box>
          ))}
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
            Your request has been sent to the Association Secretary.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1, flexDirection: { xs: "column", sm: "row" } }}>
          <Button fullWidth variant="outlined" onClick={() => navigate("/onboarding/status", { state: { application: successApp } })}>
            Track Status
          </Button>
          <Button fullWidth variant="contained" sx={{ fontWeight: 600 }} onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

