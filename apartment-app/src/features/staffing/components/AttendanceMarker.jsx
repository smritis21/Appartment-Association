import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { DEPARTMENT, DEPARTMENT_META, SHIFT_META, staffByDepartment } from "../mock/staff";
import { ATTENDANCE, ATTENDANCE_META, attendanceStatus } from "../mock/attendance";
import { shiftsForStaffOnDay } from "../mock/roster";

const OPTIONS = [ATTENDANCE.PRESENT, ATTENDANCE.ABSENT, ATTENDANCE.LEAVE];

function StaffRow({ staff, date, onMark }) {
  const status = attendanceStatus(staff.id, date);
  const rostered = shiftsForStaffOnDay(staff.id, date);

  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="body2" fontWeight={600}>
          {staff.name}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "var(--font-mono)" }}>
          {staff.id}
        </Typography>
      </TableCell>
      <TableCell>
        {rostered.length > 0 ? (
          rostered.map((s) => (
            <Chip
              key={s}
              size="small"
              variant="outlined"
              label={SHIFT_META[s].label}
              sx={{ mr: 0.5 }}
            />
          ))
        ) : (
          <Typography variant="caption" color="text.disabled">
            Not rostered
          </Typography>
        )}
      </TableCell>
      <TableCell>
        {status ? (
          <Chip size="small" color={ATTENDANCE_META[status].color} label={ATTENDANCE_META[status].label} />
        ) : (
          <Chip size="small" variant="outlined" label="Unmarked" />
        )}
      </TableCell>
      <TableCell align="right">
        <ToggleButtonGroup
          size="small"
          exclusive
          value={status}
          onChange={(_e, val) => val && onMark(staff.id, val)}
        >
          {OPTIONS.map((opt) => (
            <ToggleButton key={opt} value={opt} sx={{ px: 1.5, textTransform: "none" }}>
              {ATTENDANCE_META[opt].label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </TableCell>
    </TableRow>
  );
}

// Per-staff, per-day attendance grid grouped by department. Marking is a single
// tap on Present / Absent / Leave; the parent persists it and shows a success
// state.
export default function AttendanceMarker({ date, onMark }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {Object.values(DEPARTMENT).map((department) => (
        <Box key={department}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Chip size="small" color={DEPARTMENT_META[department].color} label={DEPARTMENT_META[department].label} />
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, color: "text.secondary" } }}>
                  <TableCell>Staff</TableCell>
                  <TableCell>Rostered shift</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Mark</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {staffByDepartment(department).map((s) => (
                  <StaffRow key={s.id} staff={s} date={date} onMark={onMark} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}
    </Box>
  );
}
