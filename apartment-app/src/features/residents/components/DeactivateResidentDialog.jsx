import {
  Box, Button, Dialog, DialogActions, DialogContent,
  DialogTitle, TextField, Typography,
} from "@mui/material";
import { useState } from "react";

export default function DeactivateResidentDialog({ open, resident, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    onConfirm(reason);
    setReason("");
  };

  const handleCancel = () => {
    setReason("");
    onCancel();
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Deactivate Resident?</DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          {[
            ["Resident", resident?.name],
            ["Flat",     `${resident?.wing}-${resident?.flat}`],
            ["Role",     resident?.role],
          ].map(([label, value]) => (
            <Box key={label} sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
              <Typography variant="body2" color="text.secondary">{label}</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ textTransform: "capitalize" }}>{value}</Typography>
            </Box>
          ))}
        </Box>
        <TextField
          label="Reason (optional)"
          multiline rows={3} fullWidth size="small"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Lease expired, moved out..."
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={handleCancel} variant="outlined" color="inherit">Cancel</Button>
        <Button onClick={handleConfirm} variant="contained" color="warning" sx={{ fontWeight: 600 }}>
          Deactivate
        </Button>
      </DialogActions>
    </Dialog>
  );
}
