import {
  Alert,
  Box,
  Grid,
  Snackbar,
  Tab,
  Tabs,
} from "@mui/material";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import { useMemo, useState } from "react";
import { VISITOR_STATUS, getStatusCounts } from "../mock/visitors";
import VisitorRequestCard from "../components/VisitorRequestCard";
import PageHeader from "../../../components/common/PageHeader";
import StatCard from "../../../components/cards/StatCard";
import EmptyState from "../../../components/common/EmptyState";
import LoadingSpinner from "../../../components/common/LoadingSpinner";
import ConfirmationDialog from "../../../components/common/ConfirmationDialog";
import { useVisitors } from "../../../context/VisitorContext";
import { useAuth } from "../../../hooks/useAuth";

const TABS = [
  { value: VISITOR_STATUS.PENDING, label: "Pending" },
  { value: VISITOR_STATUS.APPROVED, label: "Approved" },
  { value: VISITOR_STATUS.LEFT_AT_GATE, label: "Left at Gate" },
  { value: VISITOR_STATUS.REJECTED, label: "Rejected" },
];

const CONFIRM_COPY = {
  [VISITOR_STATUS.APPROVED]: {
    title: "Allow this visitor?",
    message: (name) => `${name} will be allowed in and the guard notified.`,
    confirmLabel: "Approve",
    severity: "success",
  },
  [VISITOR_STATUS.REJECTED]: {
    title: "Reject this visitor?",
    message: (name) => `${name} will be turned away at the gate.`,
    confirmLabel: "Reject",
    severity: "error",
  },
  [VISITOR_STATUS.LEFT_AT_GATE]: {
    title: "Leave delivery at the gate?",
    message: (name) => `${name} will hand the delivery to the guard for you to collect later.`,
    confirmLabel: "Leave at Gate",
    severity: "primary",
  },
};

const SNACKBAR_MESSAGE = {
  [VISITOR_STATUS.APPROVED]: (name) => `${name} has been allowed in.`,
  [VISITOR_STATUS.REJECTED]: (name) => `${name} has been turned away.`,
  [VISITOR_STATUS.LEFT_AT_GATE]: (name) => `${name} left the delivery at the gate for collection.`,
};

export default function VisitorApprovalPage() {
  const { user } = useAuth();
  const { requests, loading, offline, loadError, decide } = useVisitors();

  const [tab, setTab] = useState(VISITOR_STATUS.PENDING);
  const [confirm, setConfirm] = useState({ open: false, request: null, action: null });
  const [submitting, setSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const counts = useMemo(() => getStatusCounts(requests), [requests]);
  const visible = useMemo(() => requests.filter((r) => r.status === tab), [requests, tab]);

  const requestAction = (request, action) => setConfirm({ open: true, request, action });

  const closeConfirm = () => setConfirm({ open: false, request: null, action: null });

  // Sends the decision to POST /visitors/{id}/decision (BE-05).
  const confirmAction = async () => {
    const { request, action } = confirm;
    if (!request || !action || submitting) return;

    let result;
    setSubmitting(true);
    try {
      result = await decide(request.id, action, { decidedBy: user?.residentId });
      closeConfirm();
    } finally {
      setSubmitting(false);
    }

    if (result.ok) {
      setSnackbar({
        open: true,
        message: SNACKBAR_MESSAGE[action]?.(request.name) ?? "Decision recorded.",
        severity: action === VISITOR_STATUS.REJECTED ? "error" : "success",
      });
    } else {
      // Duplicate (409), expired/invalid (400) or missing (404) - show the
      // backend's own message, it explains exactly what went wrong.
      setSnackbar({
        open: true,
        message: result.error ?? "Could not record that decision.",
        severity: result.status === 409 ? "warning" : "error",
      });
    }
  };

  return (
    <Box>
      <PageHeader
        title="Visitor Approvals"
        subtitle="Review and respond to visitor requests for your flat"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Visitor Approvals" }]}
      />

      {offline && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Showing sample data - the backend isn&apos;t reachable, so decisions won&apos;t
          be saved. Start it with <code>uvicorn app.main:app --reload</code>.
        </Alert>
      )}

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Couldn&apos;t load visitor requests: {loadError}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Pending" value={counts[VISITOR_STATUS.PENDING]} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Approved" value={counts[VISITOR_STATUS.APPROVED]} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Left at Gate" value={counts[VISITOR_STATUS.LEFT_AT_GATE]} />
        </Grid>
        <Grid size={{ xs: 6, sm: 3 }}>
          <StatCard label="Rejected" value={counts[VISITOR_STATUS.REJECTED]} />
        </Grid>
      </Grid>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        sx={{ mb: 2, borderBottom: "1px solid", borderColor: "divider" }}
      >
        {TABS.map((t) => (
          <Tab key={t.value} value={t.value} label={`${t.label} (${counts[t.value]})`} />
        ))}
      </Tabs>

      {loading ? (
        <LoadingSpinner message="Loading visitor requests..." />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={HowToRegOutlinedIcon}
          title="No requests here"
          description={
            tab === VISITOR_STATUS.PENDING
              ? "You're all caught up - there are no visitors waiting for approval."
              : `You have no ${TABS.find((t) => t.value === tab)?.label.toLowerCase()} visitor requests yet.`
          }
        />
      ) : (
        <Grid container spacing={2}>
          {visible.map((request) => (
            <Grid size={{ xs: 12, md: 6 }} key={request.id}>
              <VisitorRequestCard
                request={request}
                onApprove={(r) => requestAction(r, VISITOR_STATUS.APPROVED)}
                onReject={(r) => requestAction(r, VISITOR_STATUS.REJECTED)}
                onLeaveAtGate={(r) => requestAction(r, VISITOR_STATUS.LEFT_AT_GATE)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      <ConfirmationDialog
        open={confirm.open}
        title={CONFIRM_COPY[confirm.action]?.title}
        message={CONFIRM_COPY[confirm.action]?.message(confirm.request?.name ?? "This visitor")}
        confirmLabel={submitting ? "Saving..." : CONFIRM_COPY[confirm.action]?.confirmLabel}
        severity={CONFIRM_COPY[confirm.action]?.severity}
        onConfirm={confirmAction}
        onCancel={closeConfirm}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
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

