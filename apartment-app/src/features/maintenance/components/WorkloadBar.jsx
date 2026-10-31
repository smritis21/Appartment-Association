import { Box, Tooltip } from "@mui/material";

// A single staff member's workload as a horizontal stacked bar. The track length
// is scaled to `maxTotal` (the busiest person's task count) so bars are directly
// comparable across staff - a longer bar means a heavier load. Each bar splits
// into active vs completed; the overdue slice of active is tinted red so trouble
// stands out.
export default function WorkloadBar({ active, completed, overdue = 0, maxTotal }) {
  const total = active + completed;
  const denom = Math.max(maxTotal, 1);
  const pct = (n) => `${(n / denom) * 100}%`;

  const activeOnTime = Math.max(active - overdue, 0);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        height: 12,
        width: "100%",
        borderRadius: 999,
        bgcolor: "rgba(0,0,0,0.05)",
        overflow: "hidden",
      }}
    >
      {overdue > 0 && (
        <Tooltip title={`${overdue} overdue`} arrow>
          <Box sx={{ height: "100%", width: pct(overdue), bgcolor: "error.main" }} />
        </Tooltip>
      )}
      {activeOnTime > 0 && (
        <Tooltip title={`${activeOnTime} active`} arrow>
          <Box sx={{ height: "100%", width: pct(activeOnTime), bgcolor: "warning.main" }} />
        </Tooltip>
      )}
      {completed > 0 && (
        <Tooltip title={`${completed} completed`} arrow>
          <Box sx={{ height: "100%", width: pct(completed), bgcolor: "success.main" }} />
        </Tooltip>
      )}
      {total === 0 && (
        <Box sx={{ px: 1, fontSize: 10, color: "text.disabled", lineHeight: "12px" }}>
          No tasks
        </Box>
      )}
    </Box>
  );
}

