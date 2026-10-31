import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import AssignmentOutlinedIcon from "@mui/icons-material/AssignmentOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import { useState, useMemo, useEffect, useRef } from "react";
import { APPLICATION_STATUS } from "../mock/onboarding";
import { useOnboarding } from "../../../context/OnboardingContext";
import { ROLE_LABELS } from "../../auth/mock/roles";
import { formatDate } from "../../../utils/formatDate";
import * as onboardingService from "../../../services/onboardingService";
import { toUiApplicationRow as toRow } from "../../../services/onboardingService";
import apiClient, { isOffline } from "../../../services/apiClient";
import PageHeader from "../../../components/common/PageHeader";
import DocumentPreviewModal from "../components/DocumentPreviewModal";
import SearchBar from "../../../components/common/SearchBar";
import DashboardCard from "../../../components/cards/DashboardCard";
import ConfirmationDialog from "../../../components/common/ConfirmationDialog";
import EmptyState from "../../../components/common/EmptyState";

const STATUS_CHIP = {
  [APPLICATION_STATUS.PENDING]:  { label: "Pending",  color: "warning" },
  [APPLICATION_STATUS.APPROVED]: { label: "Approved", color: "success" },
  [APPLICATION_STATUS.REJECTED]: { label: "Rejected", color: "error"   },
  pending:                       { label: "Pending",  color: "warning" },
  approved:                      { label: "Approved", color: "success" },
  rejected:                      { label: "Rejected", color: "error"   },
};

const DOC_LABEL_MAP = {
  aadhaar:           "Aadhaar Card",
  pan:               "PAN Card",
  sale_deed:         "Sale Deed",
  ownership_deed:    "Sale Deed",
  rental_agreement:  "Rental Agreement",
  id_proof:          "ID Proof",
  address_proof:     "Address Proof",
  photo:             "Passport Photo",
  other:             "Uploaded Document",
};

// Fix 7: animated counter hook
function useAnimatedCount(target) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (prev.current === target) return;
    const start = prev.current;
    const diff = target - start;
    const steps = 20;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      setDisplay(Math.round(start + (diff * step) / steps));
      if (step >= steps) { clearInterval(timer); prev.current = target; }
    }, 18);
    return () => clearInterval(timer);
  }, [target]);
  return display;
}

function AnimatedStatCard({ title, value, icon, color }) {
  const animated = useAnimatedCount(value);
  return <DashboardCard title={title} value={animated} icon={icon} color={color} />;
}

export default function ApprovalQueuePage() {
  const { applications: mockApplications, updateApplicationStatus } = useOnboarding();
  const [apiApplications, setApiApplications] = useState(null);
  const [offline, setOffline] = useState(false);
  // GET /onboarding/pending only ever returns pending applications - there's
  // no "list all" endpoint, so approved/rejected counts reflect actions
  // taken in this session rather than full history once live.
  const [sessionCounts, setSessionCounts] = useState({ approved: 0, rejected: 0 });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [viewApp, setViewApp] = useState(null);
  const [docsApp, setDocsApp] = useState(null);
  const [previewDocState, setPreviewDocState] = useState({ open: false, doc: null, app: null });
  const [confirm, setConfirm] = useState({ open: false, id: null, action: null });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const loadPending = () => {
    onboardingService
      .fetchPending()
      .then((apps) => {
        if (Array.isArray(apps)) {
          setApiApplications(apps.map(toRow));
        }
        setOffline(false);
      })
      .catch((err) => {
        if (isOffline(err)) setOffline(true);
      });
  };

  useEffect(loadPending, []);

  const applications = apiApplications ?? mockApplications ?? [];

  const counts = useMemo(() => {
    if (apiApplications) {
      const pendingCount = apiApplications.filter((a) => (a.status || "").toLowerCase() === "pending").length;
      return {
        total: apiApplications.length + (sessionCounts.approved || 0) + (sessionCounts.rejected || 0),
        pending: pendingCount,
        approved: sessionCounts.approved || 0,
        rejected: sessionCounts.rejected || 0,
      };
    }
    const apps = Array.isArray(applications) ? applications : [];
    return {
      total:    apps.length,
      pending:  apps.filter((a) => (a.status || "").toLowerCase() === "pending" || a.status === APPLICATION_STATUS.PENDING).length,
      approved: apps.filter((a) => (a.status || "").toLowerCase() === "approved" || a.status === APPLICATION_STATUS.APPROVED).length,
      rejected: apps.filter((a) => (a.status || "").toLowerCase() === "rejected" || a.status === APPLICATION_STATUS.REJECTED).length,
    };
  }, [apiApplications, applications, sessionCounts]);

  const filtered = useMemo(() => {
    const apps = Array.isArray(applications) ? applications : [];
    return apps.filter((a) => {
      const q = (search || "").toLowerCase().trim();
      const name = (a.name || a.applicantName || "").toLowerCase();
      const id = (a.id || "").toLowerCase();
      const flat = `${a.wing || a.block || ""}-${a.flat || a.flatNumber || ""}`.toLowerCase();
      const matchSearch = !q || name.includes(q) || id.includes(q) || flat.includes(q);
      const appStatus = (a.status || "").toLowerCase();
      const filterStatus = (statusFilter || "").toLowerCase();
      return matchSearch && (filterStatus === "all" || appStatus === filterStatus);
    });
  }, [applications, search, statusFilter]);

  const paginated = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  /** Summary rows from GET /onboarding/pending lack phone/occupation/documents - fetch full detail on demand. */
  const withDetail = async (app, setter) => {
    setter(app);
    if (!app?.id) return;
    try {
      const full = await onboardingService.fetchApplication(app.id);
      if (full) {
        const row = toRow(full);
        setter((prev) => (prev && prev.id === app.id ? { ...prev, ...row, documents: row.documents?.length ? row.documents : (prev.documents || []) } : row));
      }
    } catch {
      // Keep existing row view if detail fetch fails
    }
  };

  const requestAction = (id, action) => setConfirm({ open: true, id, action });

  const confirmAction = async () => {
    const { id, action } = confirm;

    if (!apiApplications) {
      updateApplicationStatus(id, action);
      setSnackbar({
        open: true,
        message: `Application ${id} has been ${action}.`,
        severity: action === APPLICATION_STATUS.APPROVED ? "success" : "error",
      });
      setConfirm({ open: false, id: null, action: null });
      setViewApp(null);
      return;
    }

    try {
      if (action === APPLICATION_STATUS.APPROVED) {
        await onboardingService.approveApplication(id);
        setSessionCounts((p) => ({ ...p, approved: p.approved + 1 }));
      } else {
        await onboardingService.rejectApplication(id, "Rejected by reviewer.");
        setSessionCounts((p) => ({ ...p, rejected: p.rejected + 1 }));
      }
      setApiApplications((prev) => prev.filter((a) => a.id !== id));
      setSnackbar({
        open: true,
        message: `Application ${id} has been ${action}.`,
        severity: action === APPLICATION_STATUS.APPROVED ? "success" : "error",
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message,
        severity: "error",
      });
    }
    setConfirm({ open: false, id: null, action: null });
    setViewApp(null);
  };

  return (
    <Box>
      <PageHeader
        title="Approval Queue"
        subtitle="Review and manage resident registration applications"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Approval Queue" }]}
      />

      {/* Fix 7: animated stat cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {[
          { title: "Total Applications", value: counts.total,    icon: PeopleOutlinedIcon,         color: "primary.main" },
          { title: "Pending Review",     value: counts.pending,  icon: HourglassEmptyOutlinedIcon, color: "warning.main" },
          { title: "Approved",           value: counts.approved, icon: TaskAltOutlinedIcon,        color: "success.main" },
          { title: "Rejected",           value: counts.rejected, icon: BlockOutlinedIcon,          color: "error.main"   },
        ].map((card) => (
          <Grid size={{ xs: 6, md: 3 }} key={card.title}>
            <AnimatedStatCard {...card} />
          </Grid>
        ))}
      </Grid>

      {/* Filters */}
      <Paper elevation={0} sx={{ borderRadius: 3, p: 2, mb: 2, border: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <SearchBar
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search by name, ID or flat..."
            sx={{ flex: 1, minWidth: 200 }}
          />
          <TextField select size="small" label="Status" value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            sx={{ minWidth: 150 }}>
            <MenuItem value="all">All Statuses</MenuItem>
            <MenuItem value={APPLICATION_STATUS.PENDING}>Pending</MenuItem>
            <MenuItem value={APPLICATION_STATUS.APPROVED}>Approved</MenuItem>
            <MenuItem value={APPLICATION_STATUS.REJECTED}>Rejected</MenuItem>
          </TextField>
        </Box>
      </Paper>

      {/* Fix 10: responsive table with horizontal scroll on mobile */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
        <TableContainer sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 640 }}>
            <TableHead>
              <TableRow>
                {["Application ID", "Resident Name", "Role", "Flat", "Submitted", "Status", "Actions"].map((h) => (
                  <TableCell key={h} sx={{ whiteSpace: "nowrap" }}>
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} sx={{ border: 0 }}>
                    <EmptyState
                      icon={AssignmentOutlinedIcon}
                      title="No Applications Found"
                      description="Try adjusting your search or status filter."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((app) => {
                  const chip = STATUS_CHIP[app.status?.toLowerCase()] || STATUS_CHIP[app.status] || { label: app.status || "Pending", color: "default" };
                  const isPending = (app.status || "").toLowerCase() === "pending" || app.status === APPLICATION_STATUS.PENDING;
                  return (
                    <TableRow key={app.id} hover>
                      <TableCell>
                        <Typography variant="caption" fontFamily="monospace" fontWeight={600} noWrap>
                          {app.id}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{app.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{app.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={ROLE_LABELS[app.role] ?? app.role} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap>{app.wing}-{app.flat}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap>{formatDate(app.submittedAt)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={chip.label} color={chip.color} size="small" />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => withDetail(app, setViewApp)}>
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {/* Fix 4: view documents button */}
                          <Tooltip title="View Documents">
                            <IconButton size="small" onClick={() => withDetail(app, setDocsApp)}>
                              <InsertDriveFileOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {/* Fix 6: disable instead of hide after decision */}
                          <Tooltip title="Approve">
                            <span>
                              <IconButton size="small" color="success" disabled={!isPending}
                                onClick={() => requestAction(app.id, APPLICATION_STATUS.APPROVED)}>
                                <CheckCircleOutlinedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Reject">
                            <span>
                              <IconButton size="small" color="error" disabled={!isPending}
                                onClick={() => requestAction(app.id, APPLICATION_STATUS.REJECTED)}>
                                <CancelOutlinedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[5, 10, 25]}
        />
      </Paper>

      {/* View Details Dialog */}
      <Dialog open={!!viewApp} onClose={() => setViewApp(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Application Details
          <Typography variant="caption" color="text.secondary" display="block">{viewApp?.id}</Typography>
        </DialogTitle>
        <DialogContent dividers>
          {viewApp && (
            <Grid container spacing={2}>
              {[
                ["Name", viewApp.name],
                ["Email", viewApp.email],
                ["Phone", viewApp.phone],
                ["Role", ROLE_LABELS[viewApp.role] ?? viewApp.role],
                ["Flat", `Wing ${viewApp.wing} • Flat ${viewApp.flat}`],
                ["Occupation", viewApp.occupation],
                ["Submitted", formatDate(viewApp.submittedAt)],
                ["Status", STATUS_CHIP[viewApp.status]?.label],
                ...(viewApp.ownerName ? [["Owner Name", viewApp.ownerName]] : []),
                ...(viewApp.leaseStart ? [["Lease Period", `${formatDate(viewApp.leaseStart)} – ${formatDate(viewApp.leaseEnd)}`]] : []),
                ...(viewApp.remarks ? [["Remarks", viewApp.remarks]] : []),
              ].map(([label, value]) => (
                <Grid size={{ xs: 12, sm: 6 }} key={label}>
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                  <Typography variant="body2" fontWeight={600}>{value}</Typography>
                </Grid>
              ))}
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={() => setViewApp(null)} color="inherit" variant="outlined">Close</Button>
          {viewApp?.status === APPLICATION_STATUS.PENDING && (
            <>
              <Button color="error" variant="outlined" startIcon={<CancelOutlinedIcon />}
                onClick={() => requestAction(viewApp.id, APPLICATION_STATUS.REJECTED)}>
                Reject
              </Button>
              <Button color="success" variant="contained" startIcon={<CheckCircleOutlinedIcon />}
                onClick={() => requestAction(viewApp.id, APPLICATION_STATUS.APPROVED)}>
                Approve
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Fix 4: Document Viewer Dialog */}
      <Dialog open={!!docsApp} onClose={() => setDocsApp(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Documents Submitted
          <Typography variant="caption" color="text.secondary" display="block">{docsApp?.name}</Typography>
        </DialogTitle>
        <DialogContent dividers>
          {docsApp?.documents?.length > 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {docsApp.documents.map((doc) => {
                // Live documents are DocumentOut objects (type/fileName); the
                // mock dataset is just bare type-key strings.
                const type = typeof doc === "string" ? doc : doc.type;
                const key = typeof doc === "string" ? doc : doc.id;
                const fileName = typeof doc === "string" ? null : doc.fileName;
                return (
                  <Box key={key} sx={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2,
                    bgcolor: "background.default",
                  }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <InsertDriveFileOutlinedIcon sx={{ color: "primary.main" }} />
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {DOC_LABEL_MAP[type] ?? type}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {fileName ?? (type.includes("photo") ? "JPG" : "PDF")} • Uploaded
                        </Typography>
                      </Box>
                    </Box>
                    <Tooltip title="Preview & Download Document">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => {
                          const docObj = typeof doc === "object" ? doc : { type: doc, id: doc };
                          const dataUrl = docObj.dataUrl || (docObj.fileReference?.startsWith("data:") ? docObj.fileReference : null);
                          const mimeType = docObj.mimeType;
                          const fileUrl = docObj.fileUrl || (docObj.id ? `${apiClient.baseUrl}/onboarding/documents/${docObj.id}/file` : null);
                          setPreviewDocState({
                            open: true,
                            doc: {
                              ...docObj,
                              id: docObj.id || key,
                              type,
                              fileName: fileName || `${type}.pdf`,
                              fileReference: docObj.fileReference,
                              fileUrl,
                              downloadUrl: docObj.downloadUrl,
                              dataUrl,
                              mimeType,
                            },
                            app: docsApp,
                          });
                        }}
                      >
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">No documents uploaded.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDocsApp(null)} variant="outlined" color="inherit">Close</Button>
        </DialogActions>
      </Dialog>

      {/* Document Preview & Download Modal */}
      <DocumentPreviewModal
        open={previewDocState.open}
        onClose={() => setPreviewDocState((prev) => ({ ...prev, open: false }))}
        doc={previewDocState.doc}
        application={previewDocState.app}
      />

      {/* Fix 3: ConfirmationDialog for approve/reject */}
      <ConfirmationDialog
        open={confirm.open}
        title={confirm.action === APPLICATION_STATUS.APPROVED ? "Approve Application?" : "Reject Application?"}
        message={
          confirm.action === APPLICATION_STATUS.APPROVED
            ? "This will approve the resident's registration. They will be notified and granted access."
            : "This will reject the resident's registration. This action can be reviewed later."
        }
        confirmLabel={confirm.action === APPLICATION_STATUS.APPROVED ? "Approve" : "Reject"}
        severity={confirm.action === APPLICATION_STATUS.APPROVED ? "success" : "error"}
        onConfirm={confirmAction}
        onCancel={() => setConfirm({ open: false, id: null, action: null })}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} variant="filled"
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

