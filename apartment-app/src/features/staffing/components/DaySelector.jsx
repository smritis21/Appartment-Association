import { Box, Chip, Typography } from "@mui/material";
import { getWeekDays, todayISO, weekdayLabel } from "../mock/roster";

// Week-strip day picker. Shows the seven days of the current week; the selected
// day drives whichever screen it sits on. Today is subtly marked.
export default function DaySelector({ value, onChange }) {
  const days = getWeekDays();
  const today = todayISO();

  return (
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2.5 }}>
      {days.map((iso) => {
        const selected = iso === value;
        const d = new Date(iso);
        return (
          <Chip
            key={iso}
            onClick={() => onChange(iso)}
            variant={selected ? "filled" : "outlined"}
            color={selected ? "primary" : "default"}
            label={
              <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", py: 0.25 }}>
                <Typography component="span" sx={{ fontSize: 11, lineHeight: 1.1, opacity: 0.85 }}>
                  {weekdayLabel(iso)}
                </Typography>
                <Typography component="span" sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>
                  {d.getDate()}
                </Typography>
              </Box>
            }
            sx={{
              height: "auto",
              borderRadius: 2,
              px: 0.5,
              ...(iso === today && !selected && { borderColor: "primary.main" }),
            }}
          />
        );
      })}
    </Box>
  );
}
