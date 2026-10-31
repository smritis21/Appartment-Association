import { Box, Card, Chip, Divider, Grid, Stack, Typography } from "@mui/material";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import PageHeader from "../../../components/common/PageHeader";
import MaintenanceCalendar from "../components/MaintenanceCalendar";
import { FREQUENCY_META, getUpcomingOccurrences } from "../mock/preventiveTasks";
import { PRIORITY_META, staffName } from "../mock/workOrders";
import { formatDate } from "../../../utils/formatDate";

// Preventive-maintenance calendar. The grid shows every recurring task on its
// scheduled day linked to the asset it maintains; the side panel lists what's
// coming up next so the Manager can plan ahead.
export default function MaintenanceCalendarPage() {
  const upcoming = getUpcomingOccurrences(new Date(), 7);

  return (
    <Box>
      <PageHeader
        title="Maintenance Calendar"
        subtitle="Recurring preventive tasks scheduled against each asset"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Maintenance Calendar" }]}
      />

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider", p: 2.5 }}>
            <MaintenanceCalendar />
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider", p: 2.5 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
              <EventRepeatOutlinedIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={700}>
                Upcoming preventive tasks
              </Typography>
            </Stack>
            <Divider sx={{ mb: 1.5 }} />
            <Stack spacing={1.25}>
              {upcoming.map((occ) => {
                const freq = FREQUENCY_META[occ.frequency];
                const prio = PRIORITY_META[occ.priority];
                return (
                  <Box
                    key={occ.key}
                    sx={{
                      p: 1.25,
                      borderRadius: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      borderLeft: "4px solid",
                      borderLeftColor: `${freq.color}.main`,
                    }}
                  >
                    <Typography variant="body2" fontWeight={700} color="text.primary">
                      {occ.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                      {occ.assetName}
                    </Typography>
                    <Stack direction="row" spacing={0.75} flexWrap="wrap" gap={0.5}>
                      <Chip size="small" label={formatDate(occ.date, { weekday: "short" })} />
                      <Chip size="small" label={freq.label} color={freq.color} variant="outlined" />
                      <Chip size="small" label={prio.label} color={prio.color} variant="outlined" />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                      Owner: {staffName(occ.assignee) ?? "Unassigned"}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
