import { useMemo, useState } from "react";
import { Alert, Box, Chip, Divider, Grid, Snackbar } from "@mui/material";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import PageHeader from "../../../components/common/PageHeader";
import DaySelector from "../components/DaySelector";
import AttendanceMarker from "../components/AttendanceMarker";
import CoverageSummary from "../components/CoverageSummary";
import { staff, staffName } from "../mock/staff";
import { ATTENDANCE_META, getCoverageByShift, getDaySummary, markAttendance as mockMarkAttendance } from "../mock/attendance";
import { assignedTo, dayLabel, todayISO } from "../mock/roster";
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

export default function AttendancePage() {
  const [date, setDate] = useState(todayISO());
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [version, setVersion] = useState(0);

  const { offline, error, markAttendance: apiMarkAttendance } = useStaffShifts(date);

  const bump = () => setVersion((v) => v + 1);
  const toast = (message, severity = "success") => setSnackbar({ open: true, message, severity });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => getDaySummary(date, staff), [date, version]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const coverage = useMemo(() => getCoverageByShift(date, assignedTo), [date, version]);

  const handleMark = async (staffId, status) => {
    if (!offline) {
      const res = await apiMarkAttendance({ staffId, date, status });
      if (!res.ok) {
        toast(res.error || "Failed to mark attendance", "error");
        return;
      }
    }
    const res = mockMarkAttendance({ staffId, date, status });
    if (!res.ok && offline) {
      toast(res.error, "error");
      return;
    }
    toast(`${staffName(staffId)} marked ${ATTENDANCE_META[status]?.label?.toLowerCase() ?? status}`);
    bump();
  };

  return (
    <Box>
      <PageHeader
        title="Staff Attendance"
        subtitle="Mark daily presence and track shift coverage"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Staff Attendance" }]}
      />

      {offline && (
        <Chip
          icon={<CloudOffOutlinedIcon />}
          label="Backend unreachable - showing local attendance"
          color="warning"
          variant="outlined"
          size="small"
          sx={{ mb: 2 }}
        />
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load attendance: {error}
        </Alert>
      )}

      <DaySelector value={date} onChange={setDate} />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <StatTile label="Present" value={summary.present} color="success.main" />
        <StatTile label="Absent" value={summary.absent} color={summary.absent ? "error.main" : "text.primary"} />
        <StatTile label="On leave" value={summary.leave} color={summary.leave ? "warning.main" : "text.primary"} />
        <StatTile label="Unmarked" value={summary.unmarked} color="text.secondary" />
      </Grid>

      {summary.unmarked > 0 && (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          {summary.unmarked} of {summary.totalStaff} staff still need marking for {dayLabel(date)}.
        </Alert>
      )}

      <CoverageSummary key={`cov-${date}-${version}`} coverage={coverage} />

      <Divider sx={{ my: 3 }} />

      <AttendanceMarker key={`mark-${date}-${version}`} date={date} onMark={handleMark} />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={2500}
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

