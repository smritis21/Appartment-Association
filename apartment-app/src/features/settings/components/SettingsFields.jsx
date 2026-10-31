import {
  Box, Typography, Switch, FormControl, InputLabel,
  Select, MenuItem, TextField, InputAdornment, IconButton,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useState } from "react";

export function SettingsSwitch({ label, description, checked, onChange }) {
  return (
    <Box sx={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      py: 1.25, borderBottom: "1px solid", borderColor: "divider",
    }}>
      <Box>
        <Typography variant="body2" fontWeight={500}>{label}</Typography>
        {description && (
          <Typography variant="caption" color="text.secondary">{description}</Typography>
        )}
      </Box>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} size="small" />
    </Box>
  );
}

export function SettingsSelect({ label, value, options, onChange, size = "small" }) {
  return (
    <FormControl fullWidth size={size}>
      <InputLabel>{label}</InputLabel>
      <Select value={value} label={label} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export function SettingsTextField({ label, value, onChange, type = "text", helperText, multiline, rows, disabled }) {
  const [showPw, setShowPw] = useState(false);
  const isPassword = type === "password";

  return (
    <TextField
      fullWidth
      size="small"
      label={label}
      value={value}
      type={isPassword ? (showPw ? "text" : "password") : type}
      helperText={helperText}
      multiline={multiline}
      rows={rows}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      slotProps={{
        input: isPassword
          ? {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPw((p) => !p)} edge="end">
                    {showPw ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }
          : undefined,
      }}
    />
  );
}

