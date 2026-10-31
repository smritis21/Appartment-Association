import { Box, Chip, Grid, Paper, Typography } from "@mui/material";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import { DEPARTMENT_META, SHIFT_META } from "../mock/staff";

// Operational coverage for the day: for each department + shift that runs, how
// many rostered staff are actually present against the required headcount. A
// slot short of its requirement is flagged - this is presence-aware, so a slot
// can be full on the roster yet short here once leave and absence are counted.
export default function CoverageSummary({ coverage }) {
  return (
    <Box>
      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 0.5 }}>
        Daily coverage
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Present staff against required headcount, per shift.
      </Typography>
      <Grid container spacing={2}>
        {coverage.map((c) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={`${c.department}-${c.shift}`}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.75,
                borderRadius: 2,
                borderColor: c.covered ? "divider" : "error.main",
                bgcolor: c.covered ? "background.paper" : "rgba(211,47,47,0.04)",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Chip size="small" color={DEPARTMENT_META[c.department].color} label={DEPARTMENT_META[c.department].label} />
                <Chip
                  size="small"
                  icon={c.covered ? <CheckCircleOutlineOutlinedIcon /> : <WarningAmberOutlinedIcon />}
                  color={c.covered ? "success" : "error"}
                  variant={c.covered ? "outlined" : "filled"}
                  label={`${c.present}/${c.required}`}
                />
              </Box>
              <Typography variant="subtitle2" fontWeight={700}>
                {SHIFT_META[c.shift].label}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {c.rostered} rostered · {c.present} present
                {c.short > 0 ? ` · short ${c.short}` : ""}
              </Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

