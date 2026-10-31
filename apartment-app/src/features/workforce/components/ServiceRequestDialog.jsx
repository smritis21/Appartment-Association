import { useEffect, useState } from "react";
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
import { PRIORITIES, tradeLabel } from "../mock/serviceProviders";

const emptyForm = { description: "", priority: "medium" };

// Raise-a-job form for a chosen provider's trade. A description of at least 10
// characters is required so management can act on it; priority defaults to
// medium.
export default function ServiceRequestDialog({ open, provider, user, onClose, onConfirm }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(emptyForm);
      setError("");
    }
  }, [open, provider]);

  if (!provider) return null;

  const handleConfirm = () => {
    const desc = form.description.trim();
    if (desc.length < 10) {
      setError("Please describe the problem in at least 10 characters.");
      return;
    }
    onConfirm({ ...form, description: desc });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Raise a {tradeLabel(provider.trade)} job</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 0.5 }}>
          <TextField
            label="Describe the problem"
            value={form.description}
            onChange={(e) => {
              setForm((p) => ({ ...p, description: e.target.value }));
              setError("");
            }}
            multiline
            minRows={3}
            placeholder="e.g. kitchen tap dripping continuously"
            error={!!error}
            helperText={error}
            fullWidth
          />
          <TextField
            select
            label="Priority"
            value={form.priority}
            onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}
            fullWidth
          >
            {PRIORITIES.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Alert severity="info" sx={{ mt: 2 }}>
          Raised for <strong>{user?.name ?? "you"}</strong> ({user?.flat ?? "-"}). Management assigns a
          provider - the preferred one is <strong>{provider.name}</strong>.
        </Alert>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Cancel
        </Button>
        <Button onClick={handleConfirm} variant="contained">
          Submit Request
        </Button>
      </DialogActions>
    </Dialog>
  );
}

