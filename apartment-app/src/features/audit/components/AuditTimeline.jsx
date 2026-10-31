import {
  Box, Typography, Paper, Divider,
} from "@mui/material";
import { formatDate } from "../../../utils/formatDate";
import AuditSeverityChip from "./AuditSeverityChip";
import AuditStatusChip from "./AuditStatusChip";

function groupByDay(logs) {
  const groups = {};
  logs.forEach((log) => {
    const day = log.timestamp.split("T")[0];
    if (!groups[day]) groups[day] = [];
    groups[day].push(log);
  });
  return groups;
}

function dayLabel(dateStr) {
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (dateStr === today) return "Today";
  if (dateStr === yesterday) return "Yesterday";
  return formatDate(dateStr);
}

export default function AuditTimeline({ logs }) {
  const groups = groupByDay(logs);
  const days = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  if (days.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
        No activity to display.
      </Typography>
    );
  }

  return (
    <Box>
      {days.map((day) => (
        <Box key={day} sx={{ mb: 4 }}>
          <Typography variant="subtitle1" fontWeight={700} color="text.primary" sx={{ mb: 1.5 }}>
            {dayLabel(day)}
          </Typography>
          <Box sx={{ borderLeft: "2px solid", borderColor: "divider", pl: 2.5 }}>
            {groups[day].map((log, i) => (
              <Box key={log.id} sx={{ position: "relative", mb: i < groups[day].length - 1 ? 2 : 0 }}>
                {/* dot */}
                <Box sx={{
                  position: "absolute", left: -18, top: 6,
                  width: 10, height: 10, borderRadius: "50%",
                  bgcolor: log.severity === "Critical" ? "error.main"
                    : log.severity === "Warning" ? "warning.main"
                    : "primary.main",
                  border: "2px solid white",
                  boxShadow: 1,
                }} />

                <Paper elevation={0} sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "var(--font-mono, monospace)", minWidth: 42 }}>
                      {log.timestamp.split("T")[1].slice(0, 5)}
                    </Typography>
                    <Typography variant="body2" fontWeight={600}>{log.action}</Typography>
                    <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
                      <AuditSeverityChip severity={log.severity} />
                      <AuditStatusChip status={log.status} />
                    </Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {log.performedBy} · {log.module}
                    {log.residentName ? ` · ${log.residentName}` : ""}
                    {log.wing ? ` · Wing ${log.wing}, Flat ${log.flat}` : ""}
                  </Typography>
                  <Divider sx={{ my: 0.75 }} />
                  <Typography variant="caption" color="text.secondary">{log.description}</Typography>
                </Paper>
              </Box>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
