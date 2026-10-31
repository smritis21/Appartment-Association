import {
  Box,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import LogoutOutlinedIcon from "@mui/icons-material/LogoutOutlined";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import EmptyState from "../../../components/common/EmptyState";
import { ATTENDANCE_STATUS } from "../mock/attendance";
import { categoryLabel } from "../mock/houseHelp";
import { formatDate } from "../../../utils/formatDate";

// Entry-log table. Open rows (checked in, no exit yet) show a Check-out action;
// closed rows show the computed hours. `onCheckOut` is optional (read-only in
// the management register).
export default function AttendanceTable({ logs, onCheckOut }) {
  if (logs.length === 0) {
    return (
      <EmptyState
        icon={EventBusyOutlinedIcon}
        title="No attendance logged"
        description="Entry and exit for house help will appear here once they check in."
      />
    );
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ "& th": { fontWeight: 700, color: "text.secondary" } }}>
            <TableCell>Worker</TableCell>
            <TableCell>Category</TableCell>
            <TableCell>Flat</TableCell>
            <TableCell>Date</TableCell>
            <TableCell>In</TableCell>
            <TableCell>Out</TableCell>
            <TableCell>Hours</TableCell>
            <TableCell>Status</TableCell>
            {onCheckOut && <TableCell align="right">Action</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {logs.map((r) => {
            const open = r.status === ATTENDANCE_STATUS.IN;
            return (
              <TableRow key={r.id} hover>
                <TableCell>{r.helpName}</TableCell>
                <TableCell>{categoryLabel(r.category)}</TableCell>
                <TableCell>{r.flat}</TableCell>
                <TableCell>{formatDate(r.date, { weekday: "short" })}</TableCell>
                <TableCell>{r.checkIn}</TableCell>
                <TableCell>{r.checkOut ?? "-"}</TableCell>
                <TableCell>{r.hours != null ? `${r.hours} h` : "-"}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={open ? "On premises" : "Checked out"}
                    color={open ? "success" : "default"}
                    variant={open ? "filled" : "outlined"}
                  />
                </TableCell>
                {onCheckOut && (
                  <TableCell align="right">
                    {open ? (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<LogoutOutlinedIcon />}
                        onClick={() => onCheckOut(r)}
                      >
                        Check out
                      </Button>
                    ) : (
                      <Box component="span" sx={{ color: "text.disabled", fontSize: 13 }}>
                        -
                      </Box>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

