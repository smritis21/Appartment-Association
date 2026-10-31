import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import PageHeader from "../../../components/common/PageHeader";
import EmptyState from "../../../components/common/EmptyState";
import WorkloadBar from "../components/WorkloadBar";
import { WORKLOAD_TRADES, WORKLOAD_SORTS } from "../mock/workload";
import { useWorkload } from "../../../hooks/useWorkload";

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

function LegendDot({ color, label }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Box>
  );
}

export default function WorkloadDashboardPage() {
  const [sortKey, setSortKey] = useState("active");
  const [tradeFilter, setTradeFilter] = useState("all");
  const [onlyActive, setOnlyActive] = useState(false);

  const { rows: workloadRows, summary: workloadSummary, loading, offline, error } = useWorkload();

  const summary = workloadSummary ?? { staffCount: 0, active: 0, overdue: 0, completed: 0 };
  const maxTotal = useMemo(
    () => (workloadRows ?? []).reduce((m, r) => Math.max(m, r.total), 0),
    [workloadRows]
  );

  const rows = useMemo(() => {
    return (workloadRows ?? [])
      .filter((r) => tradeFilter === "all" || r.trade === tradeFilter)
      .filter((r) => !onlyActive || r.active > 0)
      .sort(WORKLOAD_SORTS[sortKey]?.cmp ?? (() => 0));
  }, [workloadRows, sortKey, tradeFilter, onlyActive]);

  return (
    <Box>
      <PageHeader
        title="Staff Workload"
        subtitle="Tasks assigned to each maintenance staff member - active, completed and overdue"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Staff Workload" }]}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load staff workload: {error}
        </Alert>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {loading ? (
          <>
            <Grid size={{ xs: 6, sm: 3 }}><Skeleton variant="rounded" height={90} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><Skeleton variant="rounded" height={90} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><Skeleton variant="rounded" height={90} /></Grid>
            <Grid size={{ xs: 6, sm: 3 }}><Skeleton variant="rounded" height={90} /></Grid>
          </>
        ) : (
          <>
            <StatTile label="Staff members" value={summary.staffCount} color="text.primary" />
            <StatTile label="Active tasks" value={summary.active} color="warning.main" />
            <StatTile label="Overdue tasks" value={summary.overdue} color="error.main" />
            <StatTile label="Completed tasks" value={summary.completed} color="success.main" />
          </>
        )}
      </Grid>

      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 2,
          mb: 2.5,
        }}
      >
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel id="sort-f">Sort by</InputLabel>
          <Select
            labelId="sort-f"
            label="Sort by"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value)}
          >
            {Object.entries(WORKLOAD_SORTS).map(([key, { label }]) => (
              <MenuItem key={key} value={key}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 170 }}>
          <InputLabel id="trade-f">Trade</InputLabel>
          <Select
            labelId="trade-f"
            label="Trade"
            value={tradeFilter}
            onChange={(e) => setTradeFilter(e.target.value)}
          >
            <MenuItem value="all">All trades</MenuItem>
            {WORKLOAD_TRADES.map((t) => (
              <MenuItem key={t} value={t}>{t}</MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControlLabel
          control={<Switch checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />}
          label="Only staff with active tasks"
        />

        <Box sx={{ display: "flex", gap: 2, ml: { sm: "auto" }, flexWrap: "wrap" }}>
          <LegendDot color="error.main" label="Overdue" />
          <LegendDot color="warning.main" label="Active" />
          <LegendDot color="success.main" label="Completed" />
        </Box>
      </Box>

      {loading ? (
        <Skeleton variant="rounded" height={240} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No staff match this filter"
          description="Try clearing the trade filter or the active-only toggle."
        />
      ) : (
        <TableContainer
          sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}
        >
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: "rgba(47,82,51,0.04)" }}>
                <TableCell sx={{ fontWeight: 700 }}>Staff member</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Trade</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Active</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Completed</TableCell>
                <TableCell align="center" sx={{ fontWeight: 700 }}>Overdue</TableCell>
                <TableCell sx={{ fontWeight: 700, minWidth: 220 }}>Workload</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.staffId} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {r.total} task{r.total === 1 ? "" : "s"} · {r.completionRate}% done
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip label={r.trade} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={700} color={r.active ? "warning.main" : "text.disabled"}>
                      {r.active}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={700} color={r.completed ? "success.main" : "text.disabled"}>
                      {r.completed}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2" fontWeight={700} color={r.overdue ? "error.main" : "text.disabled"}>
                      {r.overdue}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <WorkloadBar
                      active={r.active}
                      completed={r.completed}
                      overdue={r.overdue}
                      maxTotal={maxTotal}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

