import { Box, MenuItem, Paper, TextField } from "@mui/material";
import SearchBar from "../../../components/common/SearchBar";
import { DIRECTORY_WINGS } from "../mock/directory";

export default function DirectoryFilters({ search, onSearch, roleFilter, onRole, statusFilter, onStatus, wingFilter, onWing }) {
  return (
    <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
        <SearchBar
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by name, flat, wing, email or phone..."
          sx={{ flex: 1, minWidth: 220 }}
        />
        <TextField select size="small" label="Role" value={roleFilter} onChange={(e) => onRole(e.target.value)} sx={{ minWidth: 120 }}>
          <MenuItem value="all">All Roles</MenuItem>
          <MenuItem value="owner">Owner</MenuItem>
          <MenuItem value="tenant">Tenant</MenuItem>
        </TextField>
        <TextField select size="small" label="Status" value={statusFilter} onChange={(e) => onStatus(e.target.value)} sx={{ minWidth: 140 }}>
          <MenuItem value="all">All Statuses</MenuItem>
          <MenuItem value="occupied">Occupied</MenuItem>
          <MenuItem value="vacant">Vacant</MenuItem>
          <MenuItem value="maintenance">Maintenance</MenuItem>
          <MenuItem value="reserved">Reserved</MenuItem>
        </TextField>
        <TextField select size="small" label="Wing" value={wingFilter} onChange={(e) => onWing(e.target.value)} sx={{ minWidth: 110 }}>
          <MenuItem value="all">All Wings</MenuItem>
          {DIRECTORY_WINGS.map((w) => (
            <MenuItem key={w} value={w}>Wing {w}</MenuItem>
          ))}
        </TextField>
      </Box>
    </Paper>
  );
}
