import {
  Alert, Box, Button, Chip, MenuItem, Paper, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import AddOutlinedIcon from "@mui/icons-material/AddOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import SearchBar from "../../../components/common/SearchBar";
import EmptyState from "../../../components/common/EmptyState";
import { useAuth } from "../../../hooks/useAuth";
import { useComplaints } from "../../../context/ComplaintContext";
import { fetchResidentComplaints } from "../../../services/complaintService";
import { isOffline } from "../../../services/apiClient";
import { RESIDENT_ROLES } from "../../../constants/roles";
import {
  COMPLAINT_CATEGORIES, COMPLAINT_STATUS, STATUS_LABELS,
} from "../mock/complaints";
import { formatDate } from "../../../utils/formatDate";
import ComplaintStatusChip from "../components/ComplaintStatusChip";

// FE-10 - Complaint History Screen. Residents see their own complaints;
// management roles see everything. Selecting a row opens the detail /
// tracking view (FE-02).
export default function ComplaintHistoryPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { complaints: mockComplaints } = useComplaints();

  // INT-10: a resident's history comes from the API. Management roles have no
  // society-wide endpoint yet, so they keep the in-memory list for now.
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const isResident = RESIDENT_ROLES.includes(user?.role);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!isResident) { setComplaints(mockComplaints); setLoading(false); return; }
      setLoading(true);
      try {
        const rows = await fetchResidentComplaints(user?.residentId);
        if (active) { setComplaints(rows); setOffline(false); setLoadError(""); }
      } catch (err) {
        if (!active) return;
        if (isOffline(err)) { setComplaints(mockComplaints); setOffline(true); setLoadError(""); }
        else { setComplaints([]); setOffline(false); setLoadError(err?.message || "Could not load your complaints."); }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [isResident, user?.residentId, mockComplaints]);

  const visible = useMemo(() => {
    const base = complaints;
    const q = search.toLowerCase();
    return base.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        c.id.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q) ||
        (c.reference || "").toLowerCase().includes(q) ||
        (c.residentName || "").toLowerCase().includes(q)
      );
    });
  }, [complaints, search, statusFilter, categoryFilter]);

  return (
    <Box>
      <PageHeader
        title={isResident ? "My Complaints" : "All Complaints"}
        subtitle="Review past complaints and their resolutions"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Complaints" }]}
        action={
          <Button
            variant="contained"
            startIcon={<AddOutlinedIcon />}
            onClick={() => navigate("/complaints/new")}
            sx={{ fontWeight: 600 }}
          >
            Raise Complaint
          </Button>
        }
      />

      {offline && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Showing sample complaints - the server is unreachable.
        </Alert>
      )}
      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError("")}>
          {loadError}
        </Alert>
      )}

      {/* Filters */}
      <Paper elevation={1} sx={{ borderRadius: 2, p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <SearchBar
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ID, description or location..."
            sx={{ flex: 1, minWidth: 220 }}
          />
          <TextField select size="small" label="Status" value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 150 }}>
            <MenuItem value="all">All Statuses</MenuItem>
            {Object.values(COMPLAINT_STATUS).map((s) => (
              <MenuItem key={s} value={s}>{STATUS_LABELS[s]}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Category" value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)} sx={{ minWidth: 170 }}>
            <MenuItem value="all">All Categories</MenuItem>
            {COMPLAINT_CATEGORIES.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </TextField>
        </Box>
      </Paper>

      {loading ? (
        <Paper elevation={1} sx={{ borderRadius: 2, p: 6, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">Loading your complaints…</Typography>
        </Paper>
      ) : visible.length === 0 ? (
        <Paper elevation={1} sx={{ borderRadius: 2 }}>
          <EmptyState
            icon={ReportProblemOutlinedIcon}
            title="No complaints found"
            description="No complaints match the current filters. Raise a new complaint to get started."
            action={() => navigate("/complaints/new")}
            actionLabel="Raise Complaint"
          />
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Complaint ID</TableCell>
                <TableCell>Category</TableCell>
                {!isResident && <TableCell>Raised By</TableCell>}
                <TableCell>Location</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((c) => (
                <TableRow
                  key={c.id}
                  hover
                  sx={{ cursor: "pointer" }}
                  onClick={() => navigate(`/complaints/${c.id}`)}
                >
                  <TableCell sx={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>{c.reference || c.id}</TableCell>
                  <TableCell>
                    <Chip label={c.category} size="small" variant="outlined" />
                  </TableCell>
                  {!isResident && <TableCell>{c.residentName} ({c.flat})</TableCell>}
                  <TableCell>{c.location}</TableCell>
                  <TableCell>{formatDate(c.createdAt)}</TableCell>
                  <TableCell><ComplaintStatusChip status={c.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

