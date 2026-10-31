import { Box, Chip } from "@mui/material";
import { HELP_CATEGORIES } from "../mock/houseHelp";

// Horizontal category chips for the house-help directory. `all` is prepended so
// residents can browse everyone. Controlled by the parent.
export default function CategoryFilter({ value, onChange }) {
  const options = [{ id: "all", label: "All" }, ...HELP_CATEGORIES];
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
      {options.map((opt) => {
        const Icon = opt.icon;
        const selected = value === opt.id;
        return (
          <Chip
            key={opt.id}
            label={opt.label}
            icon={Icon ? <Icon fontSize="small" /> : undefined}
            onClick={() => onChange(opt.id)}
            color={selected ? "primary" : "default"}
            variant={selected ? "filled" : "outlined"}
            sx={{ fontWeight: selected ? 700 : 500, px: 0.5 }}
          />
        );
      })}
    </Box>
  );
}
