import { useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from "@mui/material";
import { useForm } from "react-hook-form";
import { ASSETS } from "../mock/assets";
import { PRIORITY, PRIORITY_META, STAFF, WO_TYPE, WO_TYPE_META } from "../mock/workOrders";

const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const emptyValues = {
  title: "",
  description: "",
  assetId: "",
  type: WO_TYPE.REACTIVE,
  priority: PRIORITY.MEDIUM,
  assignee: "",
  dueDate: "",
};

// Create / edit dialog for a work order. Uses react-hook-form so every field
// surfaces inline validation, and only calls back with a clean payload once the
// form passes. Passing `workOrder` switches it into edit mode.
export default function WorkOrderForm({ open, workOrder, onClose, onSubmit }) {
  const isEdit = !!workOrder;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: emptyValues });

  useEffect(() => {
    if (!open) return;
    reset(
      workOrder
        ? {
            title: workOrder.title,
            description: workOrder.description,
            assetId: workOrder.assetId,
            type: workOrder.type,
            priority: workOrder.priority,
            assignee: workOrder.assignee ?? "",
            dueDate: workOrder.dueDate ?? "",
          }
        : emptyValues,
    );
  }, [open, workOrder, reset]);

  const submit = (data) => {
    onSubmit({
      ...data,
      title: data.title.trim(),
      description: data.description.trim(),
      assignee: data.assignee || null,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? `Edit ${workOrder.id}` : "New work order"}</DialogTitle>
      <Box component="form" onSubmit={handleSubmit(submit)} noValidate>
        <DialogContent>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 0.5 }}>
            <TextField
              label="Title"
              placeholder="e.g. Elevator halting between floors"
              fullWidth
              error={!!errors.title}
              helperText={errors.title?.message}
              {...register("title", {
                required: "Give the work order a short title.",
                minLength: { value: 5, message: "Title must be at least 5 characters." },
              })}
            />

            <TextField
              label="Description"
              placeholder="What is the problem or scheduled work?"
              fullWidth
              multiline
              minRows={3}
              error={!!errors.description}
              helperText={errors.description?.message}
              {...register("description", {
                required: "Describe the work so staff can act on it.",
                minLength: { value: 10, message: "Please add at least 10 characters." },
              })}
            />

            <TextField
              select
              label="Asset / facility"
              fullWidth
              defaultValue=""
              error={!!errors.assetId}
              helperText={errors.assetId?.message}
              {...register("assetId", { required: "Link this order to an asset." })}
            >
              {ASSETS.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name}
                </MenuItem>
              ))}
            </TextField>

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <TextField
                select
                label="Type"
                sx={{ flex: 1, minWidth: 150 }}
                defaultValue={WO_TYPE.REACTIVE}
                {...register("type", { required: true })}
              >
                {Object.values(WO_TYPE).map((t) => (
                  <MenuItem key={t} value={t}>
                    {WO_TYPE_META[t].label}
                  </MenuItem>
                ))}
              </TextField>

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
            </Box>

            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
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

              <TextField
                label="Due date"
                type="date"
                sx={{ flex: 1, minWidth: 150 }}
                slotProps={{ inputLabel: { shrink: true } }}
                inputProps={{ min: todayISO() }}
                error={!!errors.dueDate}
                helperText={errors.dueDate?.message}
                {...register("dueDate", { required: "Set a target completion date." })}
              />
            </Box>

            <Alert severity="info">
              Leaving the assignee blank keeps the order in the <strong>Open</strong> column until
              management assigns it.
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button type="submit" variant="contained">
            {isEdit ? "Save changes" : "Create work order"}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

