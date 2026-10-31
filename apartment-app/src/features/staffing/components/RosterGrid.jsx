import {
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Tooltip,
  Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import { DEPARTMENT, DEPARTMENT_META, SHIFT_META, SHIFT_ORDER } from "../mock/staff";
import { slotCoverage } from "../mock/roster";

// One department + shift slot: the assigned staff as chips, a headcount badge,
// and an understaffed flag when fewer than required are on. Conflicted staff
// (double-booked that day) are outlined in red.
function ShiftSlot({ date, department, shift, conflictIds, onAssign, onUnassign }) {
  const cov = slotCoverage(date, department, shift);
  const runs = cov.required > 0;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        height: "100%",
        borderRadius: 2,
        borderColor: cov.understaffed ? "error.main" : "divider",
        bgcolor: cov.understaffed ? "rgba(211,47,47,0.04)" : "background.paper",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
        <Box>
          <Typography variant="subtitle2" fontWeight={700}>
            {SHIFT_META[shift].label}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {SHIFT_META[shift].time}
          </Typography>
        </Box>
        {runs ? (
          <Chip
            size="small"
            color={cov.understaffed ? "error" : "success"}
            variant={cov.understaffed ? "filled" : "outlined"}
            label={`${cov.count}/${cov.required}`}
          />
        ) : (
          <Chip size="small" variant="outlined" label="No shift" />
        )}
      </Box>

      {cov.understaffed && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            color: "error.main",
            fontSize: 12,
            fontWeight: 600,
            mb: 1,
          }}
        >
          <WarningAmberOutlinedIcon sx={{ fontSize: 15 }} />
          Understaffed · short {cov.short}
        </Box>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: runs ? 1 : 0 }}>
        {cov.assigned.length === 0 && runs && (
          <Typography variant="caption" color="text.disabled">
            No one assigned
          </Typography>
        )}
        {cov.assigned.map((a) => {
          const conflicted = conflictIds.has(a.staffId);
          const chip = (
            <Chip
              key={a.id}
              size="small"
              label={a.staffId}
              onDelete={() => onUnassign(a)}
              variant="outlined"
              color={conflicted ? "error" : "default"}
              icon={conflicted ? <ErrorOutlineOutlinedIcon /> : undefined}
              sx={{ fontFamily: "var(--font-mono)", fontSize: 11 }}
            />
          );
          return conflicted ? (
            <Tooltip key={a.id} title="Shift conflict: double-booked on this day">
              {chip}
            </Tooltip>
          ) : (
            chip
          );
        })}
      </Box>

      {runs && (
        <Button
          size="small"
          startIcon={<AddOutlinedIcon />}
          onClick={() => onAssign({ date, department, shift })}
          sx={{ mt: 0.5 }}
        >
          Assign
        </Button>
      )}
    </Paper>
  );
}

// The full roster for a day: one row per department, three shift slots across.
export default function RosterGrid({ date, conflictIds, onAssign, onUnassign }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
      {Object.values(DEPARTMENT).map((department) => (
        <Box key={department}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Chip size="small" color={DEPARTMENT_META[department].color} label={DEPARTMENT_META[department].label} />
          </Box>
          <Grid container spacing={2}>
            {SHIFT_ORDER.map((shift) => (
              <Grid size={{ xs: 12, md: 4 }} key={shift}>
                <ShiftSlot
                  date={date}
                  department={department}
                  shift={shift}
                  conflictIds={conflictIds}
                  onAssign={onAssign}
                  onUnassign={onUnassign}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
}
