import { useMemo, useState } from "react";
import { Box, Chip, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { FREQUENCY_META, getOccurrenceMap } from "../mock/preventiveTasks";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const pad = (n) => String(n).padStart(2, "0");
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

// Frequency legend so the colored dots on each occurrence are readable.
function Legend() {
  return (
    <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
      {Object.entries(FREQUENCY_META).map(([key, meta]) => (
        <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: `${meta.color}.main` }} />
          <Typography variant="caption" color="text.secondary">
            {meta.label}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

// Month calendar of recurring preventive tasks. Each day cell lists the tasks
// scheduled that day, colour-coded by cadence and labelled with the asset they
// belong to. Clicking a task bubbles up via `onSelectTask`.
export default function MaintenanceCalendar({ onSelectTask }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const occurrenceMap = useMemo(
    () => getOccurrenceMap(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  const todayISOStr = toISO(today.getFullYear(), today.getMonth(), today.getDate());

  // Build the grid: leading blanks so the 1st lands under the right weekday
  // (Mon-first), then the days of the month.
  const firstDay = new Date(cursor.year, cursor.month, 1);
  const leadBlanks = (firstDay.getDay() + 6) % 7; // convert Sun=0 to Mon=0 index
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: leadBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const step = (delta) =>
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });

  const goToday = () =>
    setCursor({ year: today.getFullYear(), month: today.getMonth() });

  return (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton size="small" onClick={() => step(-1)} aria-label="Previous month">
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={700} sx={{ minWidth: 170, textAlign: "center" }}>
            {MONTHS[cursor.month]} {cursor.year}
          </Typography>
          <IconButton size="small" onClick={() => step(1)} aria-label="Next month">
            <ChevronRightIcon />
          </IconButton>
        </Stack>
        <Chip label="Today" size="small" variant="outlined" onClick={goToday} clickable />
      </Box>

      <Legend />

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.75 }}>
        {WEEKDAYS.map((w) => (
          <Typography
            key={w}
            variant="caption"
            align="center"
            sx={{ fontWeight: 700, color: "text.secondary", py: 0.5 }}
          >
            {w}
          </Typography>
        ))}

        {cells.map((day, i) => {
          if (day === null) return <Box key={`b-${i}`} />;
          const iso = toISO(cursor.year, cursor.month, day);
          const items = occurrenceMap[iso] ?? [];
          const isToday = iso === todayISOStr;
          return (
            <Box
              key={iso}
              sx={{
                minHeight: 96,
                borderRadius: 2,
                border: "1px solid",
                borderColor: isToday ? "primary.main" : "divider",
                bgcolor: isToday ? "primary.light" : "background.paper",
                p: 0.75,
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
              }}
            >
              <Typography
                variant="caption"
                sx={{ fontWeight: isToday ? 700 : 500, color: isToday ? "primary.dark" : "text.secondary" }}
              >
                {day}
              </Typography>
              <Stack spacing={0.4}>
                {items.map((occ) => {
                  const meta = FREQUENCY_META[occ.frequency];
                  return (
                    <Tooltip
                      key={occ.key}
                      arrow
                      title={`${occ.title} · ${occ.assetName} (${meta.label})`}
                    >
                      <Box
                        role="button"
                        onClick={() => onSelectTask?.(occ)}
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          gap: 0.5,
                          px: 0.6,
                          py: 0.35,
                          borderRadius: 1,
                          cursor: "pointer",
                          bgcolor: "background.default",
                          border: "1px solid",
                          borderColor: "divider",
                          "&:hover": { borderColor: `${meta.color}.main` },
                        }}
                      >
                        <Box
                          sx={{
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            bgcolor: `${meta.color}.main`,
                            flexShrink: 0,
                          }}
                        />
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{ fontSize: 10.5, lineHeight: 1.2, color: "text.primary" }}
                        >
                          {occ.assetName.replace(/^.*-\s*/, "")}
                        </Typography>
                      </Box>
                    </Tooltip>
                  );
                })}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

