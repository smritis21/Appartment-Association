import { useMemo, useState } from "react";
import { Alert, Box, Grid, Snackbar, Typography } from "@mui/material";
import HandymanOutlinedIcon from "@mui/icons-material/HandymanOutlined";
import PageHeader from "../../../components/common/PageHeader";
import EmptyState from "../../../components/common/EmptyState";
import ConfirmationDialog from "../../../components/common/ConfirmationDialog";
import CategoryChips from "../components/CategoryChips";
import ServiceProviderCard from "../components/ServiceProviderCard";
import ServiceRequestDialog from "../components/ServiceRequestDialog";
import JobCard from "../components/JobCard";
import {
  SERVICE_PROVIDERS,
  TRADES,
  addJob,
  cancelJob,
  getJobsForUser,
  tradeLabel,
} from "../mock/serviceProviders";
import { useAuth } from "../../../hooks/useAuth";

// Resident service-provider screen: browse plumbers / electricians / etc. by
// trade, raise a job, and track your own jobs + service history.
export default function ServiceProvidersPage() {
  const { user } = useAuth();
  const [trade, setTrade] = useState("all");
  const [raiseTarget, setRaiseTarget] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [lastJob, setLastJob] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [version, setVersion] = useState(0);

  const toast = (message, severity = "success") => setSnackbar({ open: true, message, severity });

  const providers = useMemo(
    () => SERVICE_PROVIDERS.filter((p) => trade === "all" || p.trade === trade),
    [trade],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const myJobs = useMemo(() => getJobsForUser(user), [user, version]);

  const handleRaise = (form) => {
    const created = addJob({
      trade: raiseTarget.trade,
      description: form.description,
      priority: form.priority,
      raisedBy: user?.name ?? "Resident",
      flat: user?.flat ?? "-",
      role: user?.role ?? "owner",
      preferredProviderId: raiseTarget.id,
    });
    setLastJob(created);
    setRaiseTarget(null);
    toast(`${tradeLabel(created.trade)} job raised · ${created.id}`);
    setVersion((v) => v + 1);
  };

  const handleCancel = () => {
    if (cancelTarget) {
      cancelJob(cancelTarget.id);
      toast(`Job ${cancelTarget.id} cancelled`, "info");
      setCancelTarget(null);
      setVersion((v) => v + 1);
    }
  };

  const tradeOptions = [{ id: "all", label: "All" }, ...TRADES];

  return (
    <Box>
      <PageHeader
        title="Service Providers"
        subtitle="Raise a job for a plumber, electrician, carpenter and more, and track its progress"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Service Providers" }]}
      />

      {lastJob && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setLastJob(null)}>
          Job raised - <strong>{tradeLabel(lastJob.trade)}</strong>. Reference <strong>{lastJob.id}</strong>. Management
          will assign a provider shortly.
        </Alert>
      )}

      <Box sx={{ mb: 2.5 }}>
        <CategoryChips value={trade} options={tradeOptions} onChange={setTrade} />
      </Box>

      {providers.length === 0 ? (
        <EmptyState icon={HandymanOutlinedIcon} title="No providers for this trade" description="Try another trade." />
      ) : (
        <Grid container spacing={2}>
          {providers.map((p) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
              <ServiceProviderCard provider={p} onRaise={setRaiseTarget} />
            </Grid>
          ))}
        </Grid>
      )}

      <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ mt: 4, mb: 1.5 }}>
        My Jobs &amp; Service History
      </Typography>
      {myJobs.length === 0 ? (
        <EmptyState icon={HandymanOutlinedIcon} title="No jobs raised yet" description="Raise a job from a provider above." />
      ) : (
        <Grid container spacing={2}>
          {myJobs.map((job) => (
            <Grid size={{ xs: 12, md: 6 }} key={job.id}>
              <JobCard job={job} onCancel={setCancelTarget} />
            </Grid>
          ))}
        </Grid>
      )}

      <ServiceRequestDialog
        open={!!raiseTarget}
        provider={raiseTarget}
        user={user}
        onClose={() => setRaiseTarget(null)}
        onConfirm={handleRaise}
      />

      <ConfirmationDialog
        open={!!cancelTarget}
        title="Cancel this job?"
        message={cancelTarget ? `This cancels job ${cancelTarget.id} (${tradeLabel(cancelTarget.trade)}).` : ""}
        confirmLabel="Cancel Job"
        cancelLabel="Keep it"
        severity="error"
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} variant="filled" onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

