import { useMemo, useState } from "react";
import { Alert, Box, Chip, Grid, Snackbar } from "@mui/material";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import PageHeader from "../../../components/common/PageHeader";
import DaySelector from "../components/DaySelector";
import RosterGrid from "../components/RosterGrid";
import AssignShiftDialog from "../components/AssignShiftDialog";
import { SHIFT_META, staffName } from "../mock/staff";
import {
  assignShift,
  conflictsOnDay,
  dayLabel,
  getRosterStats,
  todayISO,
  unassignShift,
} from "../mock/roster";
import { useStaffShifts } from "../../../hooks/useStaffShifts";

function StatTile({ label, value, color = "primary.main" }) {
  return (
    <Grid size={{ xs: 6, sm: 3 }}>
      <Box sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", p: 2, height: "100%" }}>
        <Box sx={{ fontSize: 28, fontWeight: 700, color, fontFamily: "var(--font-serif)" }}>{value}</Box>
        <Box sx={{ fontSize: 13.5, color: "text.secondary" }}>{label}</Box>
      </Box>
    </Grid>
  );
}

export default function RosterPage() {
  const [date, setDate] = useState(todayISO());
  const [assignSlot, setAssignSlot] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [version, setVersion] = useState(0);

  const { shifts, loading, offline, error, allocateShift } = useStaffShifts(date);

  const bump = () => setVersion((v) => v + 1);
  const toast = (message, severity = "success") => setSnackbar({ open: true, message, severity });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stats = useMemo(() => getRosterStats(date), [date, version, shifts]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const conflicts = useMemo(() => conflictsOnDay(date), [date, version, shifts]);
  const conflictIds = useMemo(() => new Set(conflicts.map((c) => c.staffId)), [conflicts]);

  const handleAssign = async ({ staffId, date: d, shift }) => {
    if (!offline) {
      const res = await allocateShift({
        staffId,
        date: d,
        shiftType: shift,
        startTime: SHIFT_META[shift]?.time?.split("–")[0] ?? "06:00",
        endTime: SHIFT_META[shift]?.time?.split("–")[1] ?? "14:00",
      });
      if (!res.ok) {
        toast(res.error || "Failed to allocate shift", "error");
        return;
      }
    }
    const res = assignShift({ staffId, date: d, shift });
    if (!res.ok && offline) {
      toast(res.error, "error");
      return;
    }
    toast(`${staffName(staffId)} assigned to ${SHIFT_META[shift]?.label ?? shift} shift`);
    setAssignSlot(null);
    bump();
  };

  const handleUnassign = (a) => {
    unassignShift(a.id);
    toast(`${staffName(a.staffId)} removed from ${SHIFT_META[a.shift]?.label ?? a.shift} shift`, "info");
    bump();
  };

  return (
    <Box>
      <PageHeader
        title="Staff Roster"
        subtitle="Assign maintenance, security and housekeeping staff to shifts by day"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Staff Roster" }]}
      />

      {offline && (
        <Chip
          icon={<CloudOffOutlinedIcon />}
          label="Backend unreachable - showing local roster"
          color="warning"
          variant="outlined"
          size="small"
          sx={{ mb: 2 }}
        />
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load roster: {error}
        </Alert>
      )}

      <DaySelector value={date} onChange={setDate} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <StatTile label="People rostered" value={stats.assigned} color="text.primary" />
        <StatTile label="Slots filled" value={`${stats.filled}/${stats.required}`} />
        <StatTile
          label="Understaffed slots"
          value={stats.understaffed}
          color={stats.understaffed ? "error.main" : "success.main"}
        />
        <StatTile
          label="Conflicts"
          value={stats.conflicts}
          color={stats.conflicts ? "error.main" : "success.main"}
        />
      </Grid>

      {conflicts.length > 0 && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          Shift conflict on {dayLabel(date)}:{" "}
          {conflicts
            .map((c) => `${staffName(c.staffId)} (${c.shifts.map((s) => SHIFT_META[s]?.label ?? s).join(" + ")})`)
            .join(", ")}
          . Remove the extra shift to resolve.
        </Alert>
      )}

      <RosterGrid
        key={`${date}-${version}`}
        date={date}
        conflictIds={conflictIds}
        onAssign={setAssignSlot}
        onUnassign={handleUnassign}
      />

      <AssignShiftDialog
        open={!!assignSlot}
        slot={assignSlot}
        onClose={() => setAssignSlot(null)}
        onAssign={handleAssign}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

