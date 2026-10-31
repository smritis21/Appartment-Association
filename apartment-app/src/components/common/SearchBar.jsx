import { InputAdornment, TextField } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";

export default function SearchBar({ value, onChange, placeholder = "Search...", sx = {} }) {
  return (
    <TextField
      size="small"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      sx={{ minWidth: 240, ...sx }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: "text.secondary" }} />
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
