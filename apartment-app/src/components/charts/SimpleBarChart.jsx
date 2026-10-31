import { Box, Tooltip, Typography } from "@mui/material";

// Lightweight CSS bar chart used by the complaint monitoring dashboard,
// complaint reports and the analytics dashboard. Keeps the prototype free
// of a charting dependency; data is [{ label, value }].
export default function SimpleBarChart({ data, color = "primary.main", height = 160, emptyLabel = "No data" }) {
  const max = Math.max(...data.map((d) => d.value), 0);

  if (max === 0) {
    return (
      <Box sx={{ height, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Typography variant="body2" color="text.secondary">{emptyLabel}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: 1.5, height, pt: 1 }}>
      {data.map((d) => (
        <Box key={d.label} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, height: "100%" }}>
          <Box sx={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%", justifyContent: "center" }}>
            <Tooltip title={`${d.label}: ${d.value}`} arrow>
              <Box
                sx={{
                  width: "60%",
                  maxWidth: 40,
                  height: `${(d.value / max) * 100}%`,
                  minHeight: d.value > 0 ? 4 : 0,
                  bgcolor: color,
                  borderRadius: "4px 4px 0 0",
                  transition: "height 0.3s ease",
                }}
              />
            </Tooltip>
          </Box>
          <Typography variant="caption" color="text.secondary" noWrap>
            {d.label}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
