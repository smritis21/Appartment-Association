import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import ExpandMoreOutlinedIcon from "@mui/icons-material/ExpandMoreOutlined";
import { useState } from "react";
import {
  JOB_STATUS,
  JOB_STATUS_META,
  tradeLabel,
  getProviderById,
} from "../mock/serviceProviders";
import { formatDateTime } from "../../../utils/formatDate";

const PRIORITY_COLOR = { high: "error", medium: "warning", low: "default" };

// Resident view of a service job: trade, description, assigned provider, live
// status and an expandable service-history timeline. Cancel is available while
// the job is not yet completed/cancelled.
export default function JobCard({ job, onCancel }) {
  const [open, setOpen] = useState(false);
  const meta = JOB_STATUS_META[job.status];
  const provider = getProviderById(job.providerId);
  const canCancel = job.status !== JOB_STATUS.COMPLETED && job.status !== JOB_STATUS.CANCELLED;

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider" }}>
      <CardContent sx={{ "&:last-child": { pb: 2 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                {tradeLabel(job.trade)}
              </Typography>
              <Chip size="small" label={job.priority} color={PRIORITY_COLOR[job.priority]} variant="outlined" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {job.description}
            </Typography>
          </Box>
          <Chip size="small" label={meta.label} color={meta.color} variant={job.status === JOB_STATUS.COMPLETED ? "outlined" : "filled"} />
        </Box>

        <Divider sx={{ my: 1.25 }} />

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <Typography variant="caption" color="text.secondary" fontFamily="var(--font-mono)">
            {job.id} · {provider ? provider.name : "Awaiting assignment"}
            {provider?.phone && (
              <>
                {" · "}
                <Typography
                  component="a"
                  href={`tel:${provider.phone}`}
                  variant="caption"
                  color="primary.main"
                  sx={{ textDecoration: "none", "&:hover": { textDecoration: "underline" } }}
                >
                  {provider.phone}
                </Typography>
              </>
            )}
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              variant="text"
              endIcon={<ExpandMoreOutlinedIcon sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
              onClick={() => setOpen((o) => !o)}
            >
              History
            </Button>
            {canCancel && onCancel && (
              <Button size="small" color="error" variant="outlined" onClick={() => onCancel(job)}>
                Cancel
              </Button>
            )}
          </Box>
        </Box>

        <Collapse in={open}>
          <Stack spacing={1} sx={{ mt: 1.5, pl: 1, borderLeft: "2px solid", borderColor: "divider" }}>
            {job.history.map((h, i) => (
              <Box key={i} sx={{ pl: 1.5 }}>
                <Typography variant="body2" color="text.primary">
                  {h.text}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDateTime(h.at)}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Collapse>
      </CardContent>
    </Card>
  );
}
