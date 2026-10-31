import {
  Alert, Box, Chip, MenuItem, Paper, Snackbar, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import EmptyState from "../../../components/common/EmptyState";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import { useAuth } from "../../../hooks/useAuth";
import { useAssignmentDesk } from "../../../hooks/useAssignmentDesk";
import { formatDateTime } from "../../../utils/formatDate";
import ComplaintStatusChip from "../components/ComplaintStatusChip";

// Maps a complaint's category (backend/app/schemas/complaint.py's
// COMPLAINT_CATEGORIES, the only values a complaint can actually carry) to
// the Staff.role that handles it (backend/app/models/complaint.py: "e.g.
// 'maintenance', 'electrician', 'plumber', 'security'"). A category with no
// entry here - or one whose mapped role has nobody in the staff list - falls
// through to the full, unfiltered staff list rather than an unusable dropdown.
const CATEGORY_TO_ROLE = {
  "Plumbing": "plumber",
  "Water Supply": "plumber",
  "Electrical": "electrician",
  "Security": "security",
  "Lift Maintenance": "maintenance",
  // "Other" is deliberately absent: an uncategorised complaint could belong to
  // any trade, so the admin gets the whole staff list to choose from rather
  // than a filtered one that hides the right person.
};

// FE-06 - Complaint Assignment Interface (Admin). Open complaints and the
// assignable staff list come from the live backend (BE-06/BE-14/BE-15);
// assigning calls PUT /complaints/{id}/assign, and the row re-displays the
// staff name and timestamp the API persisted. Falls back to local mock data
// when the backend is unreachable.
export default function ComplaintAssignmentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { rows, staff, loading, offline, error, assign } = useAssignmentDesk();
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [busyId, setBusyId] = useState(null);

  const notify = (message, severity = "success") =>
    setSnackbar({ open: true, message, severity });

  const handleAssign = async (row, staffId) => {
    if (!staffId || staffId === row.assignedTo) return;
    setBusyId(row.id);
    try {
      const result = await assign(row.id, staffId, user?.id ?? user?.name);
      const name = result?.assignedStaffName
        ?? staff.find((s) => s.id === staffId)?.name
        ?? "staff";
      notify(`${row.id} assigned to ${name}.`);
    } catch (err) {
      // A backend rejection (404 unknown, 400 inactive staff) carries a message.
      notify(err.detail ?? err.message ?? "Assignment failed.", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Complaint Assignment"
        subtitle="Allocate open complaints to maintenance staff"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Complaint Desk", href: "/complaints/monitoring" },
          { label: "Assignment" },
        ]}
      />

      {offline && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Showing local data - the server could not be reached, so assignments
          will not be saved to the backend.
        </Alert>
      )}

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : loading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <Paper elevation={1} sx={{ borderRadius: 2 }}>
          <EmptyState
            icon={AssignmentIndOutlinedIcon}
            title="No open complaints"
            description="Every complaint has been resolved or closed. New complaints will appear here."
          />
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Complaint</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Raised By</TableCell>
                <TableCell>Status</TableCell>
                <TableCell sx={{ minWidth: 220 }}>Assign To</TableCell>
                <TableCell>Assigned At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((c) => {
                const assigned = !!c.assignedTo;
                const matchingRole = CATEGORY_TO_ROLE[c.category];
                const filteredStaff = matchingRole
                  ? staff.filter((s) => s.role === matchingRole)
                  : staff;
                // No staff with the matching role currently in the system -
                // fall back to the full list rather than an unusable empty
                // dropdown.
                const noMatch = matchingRole && filteredStaff.length === 0;
                const rowStaff = noMatch ? staff : filteredStaff;
                return (
                  <TableRow
                    key={c.id}
                    hover
                    sx={{
                      // Assigned complaints are visually flagged
                      borderLeft: assigned ? "3px solid" : "3px solid transparent",
                      borderLeftColor: assigned ? "success.main" : "transparent",
                    }}
                  >
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        fontFamily="var(--font-mono)"
                        sx={{ cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
                        onClick={() => navigate(`/complaints/${c.id}`)}
                      >
                        {c.id}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", maxWidth: 260 }}>
                        {c.description}
                      </Typography>
                    </TableCell>
                    <TableCell><Chip label={c.category} size="small" variant="outlined" /></TableCell>
                    <TableCell>{c.raisedBy || "-"}{c.location ? ` (${c.location})` : ""}</TableCell>
                    <TableCell><ComplaintStatusChip status={c.status} /></TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        fullWidth
                        value={c.assignedTo ?? ""}
                        disabled={busyId === c.id}
                        onChange={(e) => handleAssign(c, e.target.value)}
                        placeholder="Select staff"
                      >
                        <MenuItem value="" disabled sx={noMatch ? { fontStyle: "italic" } : undefined}>
                          {noMatch ? "(no matching staff - showing all)" : "Select staff…"}
                        </MenuItem>
                        {rowStaff.map((s) => (
                          <MenuItem key={s.id} value={s.id}>
                            {s.name}{s.role ? ` - ${s.role}` : ""}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {assigned && c.assignedAt ? formatDateTime(c.assignedAt) : "-"}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          variant="filled"
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
