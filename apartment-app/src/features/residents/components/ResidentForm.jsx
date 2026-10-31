import {
  Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, MenuItem, TextField, Typography,
} from "@mui/material";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { ROLES } from "../../../constants/roles";
import { WINGS } from "../mock/flats";
import { validators } from "../../../utils/validators";

const ROLE_OPTIONS = [
  { value: ROLES.OWNER,  label: "Owner"  },
  { value: ROLES.TENANT, label: "Tenant" },
];

export default function ResidentForm({ open, onClose, onSubmit, initialData, loading }) {
  const isEdit = !!initialData;

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    defaultValues: initialData ?? {
      firstName: "", lastName: "", email: "", phone: "",
      wing: "", flat: "", role: ROLES.OWNER, occupation: "",
      moveInDate: "", ownerName: "",
      emergencyName: "", emergencyRelation: "", emergencyPhone: "",
    },
  });

  useEffect(() => {
    if (open) {
      reset(initialData
        ? {
            ...initialData,
            emergencyName:     initialData.emergencyContact?.name     ?? "",
            emergencyRelation: initialData.emergencyContact?.relation ?? "",
            emergencyPhone:    initialData.emergencyContact?.phone    ?? "",
          }
        : {
            firstName: "", lastName: "", email: "", phone: "",
            wing: "", flat: "", role: ROLES.OWNER, occupation: "",
            moveInDate: "", ownerName: "",
            emergencyName: "", emergencyRelation: "", emergencyPhone: "",
          }
      );
    }
  }, [open, initialData, reset]);

  const handleFormSubmit = (data) => {
    onSubmit({
      ...data,
      name: `${data.firstName} ${data.lastName}`,
      emergencyContact: {
        name:     data.emergencyName,
        relation: data.emergencyRelation,
        phone:    data.emergencyPhone,
      },
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {isEdit ? "Edit Resident" : "Add New Resident"}
      </DialogTitle>
      <DialogContent dividers>
        <Box component="form" id="resident-form" onSubmit={handleSubmit(handleFormSubmit)} noValidate>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Personal Details</Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="First Name" fullWidth size="small"
                error={!!errors.firstName} helperText={errors.firstName?.message}
                {...register("firstName", { required: "First name is required" })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Last Name" fullWidth size="small"
                error={!!errors.lastName} helperText={errors.lastName?.message}
                {...register("lastName", { required: "Last name is required" })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Email" type="email" fullWidth size="small"
                error={!!errors.email} helperText={errors.email?.message}
                {...register("email", validators.email)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Phone" fullWidth size="small"
                error={!!errors.phone} helperText={errors.phone?.message}
                {...register("phone", validators.phone)} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Controller name="wing" control={control} rules={{ required: "Wing is required" }}
                render={({ field }) => (
                  <TextField select label="Wing" fullWidth size="small"
                    error={!!errors.wing} helperText={errors.wing?.message} {...field}>
                    {WINGS.map((w) => <MenuItem key={w} value={w}>{w} Wing</MenuItem>)}
                  </TextField>
                )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField label="Flat No." fullWidth size="small" placeholder="e.g. 101"
                error={!!errors.flat} helperText={errors.flat?.message}
                {...register("flat", { required: "Flat is required" })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <Controller name="role" control={control} rules={{ required: "Role is required" }}
                render={({ field }) => (
                  <TextField select label="Role" fullWidth size="small"
                    error={!!errors.role} helperText={errors.role?.message} {...field}>
                    {ROLE_OPTIONS.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
                  </TextField>
                )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 3 }}>
              <TextField label="Move-in Date" type="date" fullWidth size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!errors.moveInDate} helperText={errors.moveInDate?.message}
                {...register("moveInDate", { required: "Move-in date is required" })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Occupation" fullWidth size="small"
                {...register("occupation")} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Owner Name (if Tenant)" fullWidth size="small"
                {...register("ownerName")} />
            </Grid>
          </Grid>

          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Emergency Contact</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Contact Name" fullWidth size="small"
                {...register("emergencyName")} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Relation" fullWidth size="small"
                {...register("emergencyRelation")} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField label="Contact Phone" fullWidth size="small"
                {...register("emergencyPhone")} />
            </Grid>
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">Cancel</Button>
        <Button type="submit" form="resident-form" variant="contained" disabled={loading} sx={{ fontWeight: 600 }}>
          {loading ? <CircularProgress size={20} color="inherit" /> : isEdit ? "Save Changes" : "Add Resident"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
