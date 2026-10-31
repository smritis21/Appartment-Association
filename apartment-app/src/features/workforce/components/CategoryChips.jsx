import { Box, Chip } from "@mui/material";

// Generic selectable chip row. `options` is a list of { id, label, icon? } and
// the parent controls the selected `value`. Used for the service-provider trade
// filter (and any other simple single-select chip filter).
export default function CategoryChips({ value, options, onChange }) {
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
