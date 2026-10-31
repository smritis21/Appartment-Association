import { useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  TextField,
} from "@mui/material";
import { Controller, useForm } from "react-hook-form";
import { ASSETS, getAssetById } from "../mock/assets";
import { PRIORITY, PRIORITY_META, STAFF } from "../mock/workOrders";

const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const emptyValues = {
  title: "",
  date: "",
  time: "",
  facilities: [],
  priority: PRIORITY.MEDIUM,
  assignee: "",
  notes: "",
};

// Create dialog for a scheduled maintenance activity. Captures the three fields
// the acceptance criteria call out - date, time and affected facilities - plus a
// title, priority and optional owner. Built on react-hook-form so every required
// field blocks submit with an inline error until it's filled.
export default function MaintenanceScheduleForm({ open, onClose, onSubmit }) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: emptyValues });

  useEffect(() => {
    if (open) reset(emptyValues);
  }, [open, reset]);

  const submit = (data) => {
    onSubmit(data);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Schedule maintenance activity</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 0.5 }}>
            <TextField
              label="Activity title"
              placeholder="e.g. Overhead tank cleaning"
              fullWidth
              error={!!errors.title}
              helperText={errors.title?.message}
              {...register("title", {
                required: "Give the activity a short title.",
                minLength: { value: 5, message: "Title must be at least 5 characters." },
              })}
            />

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <TextField
                label="Date"
                type="date"
                sx={{ flex: 1, minWidth: 160 }}
                slotProps={{ inputLabel: { shrink: true } }}
                inputProps={{ min: todayISO() }}
                error={!!errors.date}
                helperText={errors.date?.message}
                {...register("date", { required: "Pick a date for the activity." })}
              />

              <TextField
                label="Time"
                type="time"
                sx={{ flex: 1, minWidth: 160 }}
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!errors.time}
                helperText={errors.time?.message}
                {...register("time", { required: "Set a start time." })}
              />
            </Box>

            {/* Affected facilities - multi-select. At least one is required. */}
            <Controller
              name="facilities"
              control={control}
              rules={{
                validate: (v) => (v && v.length > 0) || "Select at least one affected facility.",
              }}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.facilities}>
                  <InputLabel id="facilities-label">Affected facilities</InputLabel>
                  <Select
                    labelId="facilities-label"
                    multiple
                    value={field.value}
                    onChange={field.onChange}
                    input={<OutlinedInput label="Affected facilities" />}
                    renderValue={(selected) => (
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                        {selected.map((id) => (
                          <Chip key={id} size="small" label={getAssetById(id)?.name ?? id} />
                        ))}
                      </Box>
                    )}
                  >
                    {ASSETS.map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        <Checkbox checked={field.value.indexOf(a.id) > -1} />
                        <ListItemText primary={a.name} secondary={a.location} />
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {errors.facilities?.message ?? "Facilities affected while this work is carried out."}
                  </FormHelperText>
                </FormControl>
              )}
            />

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <TextField
                select
                label="Priority"
                sx={{ flex: 1, minWidth: 150 }}
                defaultValue={PRIORITY.MEDIUM}
                {...register("priority", { required: true })}
              >
                {Object.values(PRIORITY).map((p) => (
                  <MenuItem key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Assign to (optional)"
                sx={{ flex: 1, minWidth: 150 }}
                defaultValue=""
                {...register("assignee")}
              >
                <MenuItem value="">- Unassigned -</MenuItem>
                {STAFF.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name} · {s.trade}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <TextField
              label="Notes (optional)"
              placeholder="e.g. Water supply paused during the activity."
              fullWidth
              multiline
              minRows={2}
              {...register("notes")}
            />

            <Alert severity="info">
              Scheduled activities appear on the calendar and list below so residents-facing
              notices can be planned ahead of the date.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            Schedule activity
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

