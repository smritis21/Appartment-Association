import {
  Box, Grid, FormControl, InputLabel, Select, MenuItem, TextField, Button,
} from "@mui/material";
import { AUDIT_MODULES, AUDIT_SEVERITY, AUDIT_STATUS } from "../mock/auditLogs";
import { ROLE_LABELS } from "../../../constants/roles";

const EMPTY = "all";

export default function AuditFilterPanel({ filters, onChange, onReset }) {
  const handle = (field) => (e) => onChange({ ...filters, [field]: e.target.value });

  return (
    <Box sx={{ p: 2, bgcolor: "background.paper", borderRadius: 2, boxShadow: 1, mb: 2 }}>
      <Grid container spacing={2} alignItems="center">
        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Module</InputLabel>
            <Select value={filters.module} label="Module" onChange={handle("module")}>
              <MenuItem value={EMPTY}>All</MenuItem>
              {Object.values(AUDIT_MODULES).map((m) => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Severity</InputLabel>
            <Select value={filters.severity} label="Severity" onChange={handle("severity")}>
              <MenuItem value={EMPTY}>All</MenuItem>
              {Object.values(AUDIT_SEVERITY).map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select value={filters.status} label="Status" onChange={handle("status")}>
              <MenuItem value={EMPTY}>All</MenuItem>
              {Object.values(AUDIT_STATUS).map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <FormControl fullWidth size="small">
            <InputLabel>Role</InputLabel>
            <Select value={filters.role} label="Role" onChange={handle("role")}>
              <MenuItem value={EMPTY}>All</MenuItem>
              {Object.entries(ROLE_LABELS).map(([k, v]) => (
                <MenuItem key={k} value={k}>{v}</MenuItem>
              ))}
              <MenuItem value="system">System</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <TextField
            fullWidth size="small" type="date" label="From"
            slotProps={{ inputLabel: { shrink: true } }}
            value={filters.dateFrom}
            onChange={handle("dateFrom")}
          />
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 2 }}>
          <TextField
            fullWidth size="small" type="date" label="To"
            slotProps={{ inputLabel: { shrink: true } }}
            value={filters.dateTo}
            onChange={handle("dateTo")}
          />
        </Grid>

        <Grid size={{ xs: 12 }} sx={{ display: "flex", justifyContent: "flex-end" }}>
          <Button size="small" onClick={onReset} sx={{ textTransform: "none" }}>
            Reset Filters
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}
