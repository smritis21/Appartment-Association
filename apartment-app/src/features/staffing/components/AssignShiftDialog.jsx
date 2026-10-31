import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import { DEPARTMENT_META, SHIFT_META } from "../mock/staff";
import { dayLabel, unassignedStaff, validateAssignment } from "../mock/roster";

// Assigns a staff member to a specific department + shift on a day. Only offers
// staff who are free that day, and runs the same validation the store enforces
// so the manager sees an inline reason before the save is blocked.
export default function AssignShiftDialog({ open, slot, onClose, onAssign }) {
  const [staffId, setStaffId] = useState("");
  const [error, setError] = useState("");

  const options = useMemo(
    () => (slot ? unassignedStaff(slot.date, slot.department) : []),
    [slot],
  );

  useEffect(() => {
    setStaffId("");
    setError("");
  }, [slot]);

  if (!slot) return null;

  const dept = DEPARTMENT_META[slot.department];
  const shift = SHIFT_META[slot.shift];

  const handleSave = () => {
    if (!staffId) {
      setError("Select a staff member to assign.");
      return;
    }
    const check = validateAssignment({ staffId, date: slot.date, shift: slot.shift });
    if (!check.valid) {
      setError(check.error);
      return;
    }
    onAssign({ staffId, date: slot.date, shift: slot.shift });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Assign to shift</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
          <Chip size="small" color={dept.color} label={dept.label} />
          <Chip size="small" variant="outlined" label={`${shift.label} · ${shift.time}`} />
          <Chip size="small" variant="outlined" label={dayLabel(slot.date)} />
        </Box>

        {options.length === 0 ? (
          <Alert severity="info">
            Every {dept.label.toLowerCase()} staff member is already rostered on this day.
          </Alert>
        ) : (
          <TextField
            select
            label="Staff member"
            value={staffId}
            onChange={(e) => {
              setStaffId(e.target.value);
              setError("");
            }}
            fullWidth
            error={!!error}
            helperText={error || "Only staff free on this day are shown."}
            sx={{ mt: 1 }}
          >
            {options.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
                <Typography component="span" sx={{ ml: 1, color: "text.disabled", fontSize: 12 }}>
                  {s.id}
                </Typography>
              </MenuItem>
            ))}
          </TextField>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" disabled={options.length === 0}>
          Assign
        </Button>
      </DialogActions>
    </Dialog>
  );
}
