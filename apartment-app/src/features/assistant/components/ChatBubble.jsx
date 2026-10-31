import { Avatar, Box, Chip, Divider, Paper, Stack, Typography } from "@mui/material";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import FitnessCenterOutlinedIcon from "@mui/icons-material/FitnessCenterOutlined";

export default function ChatBubble({ message }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
        <Paper
          elevation={0}
          sx={{ px: 2, py: 1.25, maxWidth: "78%", bgcolor: "primary.main", color: "primary.contrastText", borderRadius: 3, borderTopRightRadius: 4 }}
        >
          <Typography variant="body2">{message.text}</Typography>
        </Paper>
      </Box>
    );
  }

  const a = message.answer;
  return (
    <Box sx={{ display: "flex", gap: 1.25, mb: 1.5 }}>
      <Avatar sx={{ bgcolor: "primary.light", color: "primary.main", width: 32, height: 32 }}>
        <SmartToyOutlinedIcon fontSize="small" />
      </Avatar>
      <Box sx={{ maxWidth: "82%" }}>
        <Paper elevation={0} sx={{ px: 2, py: 1.25, bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: 3, borderTopLeftRadius: 4 }}>
          <Typography variant="body2" color="text.primary">{a.text}</Typography>

          {(a.kind === "contact") && <ContactCards items={a.data} />}
          {(a.kind === "facility") && <FacilityRow fac={a.data} />}
          {(a.kind === "facilityList") && <Stack sx={{ mt: 1 }} spacing={0.75}>{a.data.map((f) => <FacilityRow key={f.key} fac={f} />)}</Stack>}
          {(a.kind === "dues") && <DuesRow d={a.data} />}

          {a.privacyNote && (
            <Box sx={{ display: "flex", gap: 0.75, alignItems: "center", mt: 1, color: "text.secondary" }}>
              <LockOutlinedIcon sx={{ fontSize: 15 }} />
              <Typography variant="caption">{a.privacyNote}</Typography>
            </Box>
          )}

          {a.sources?.length > 0 && (
            <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 1.25 }}>
              {a.sources.map((s) => (
                <Chip key={s} label={s} size="small" variant="outlined" sx={{ height: 20, fontSize: 10.5 }} />
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}

function ContactCards({ items = [] }) {
  return (
    <Stack spacing={0.75} sx={{ mt: 1 }}>
      {items.map((c, i) => (
        <Box key={i} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, p: 1, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.default" }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>{c.name}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>{c.label ?? `Flat ${c.flat}`}{c.role ? ` · ${c.role}` : ""}</Typography>
          </Box>
          {c.phone ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "primary.main" }}>
              <PhoneOutlinedIcon sx={{ fontSize: 16 }} />
              <Typography variant="body2" fontWeight={600} fontFamily="var(--font-mono)">{c.phone}</Typography>
            </Box>
          ) : (
            <Chip icon={<LockOutlinedIcon />} label="Private" size="small" variant="outlined" />
          )}
        </Box>
      ))}
    </Stack>
  );
}

function FacilityRow({ fac }) {
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start", mt: 1, p: 1, border: "1px solid", borderColor: "divider", borderRadius: 2, bgcolor: "background.default" }}>
      <FitnessCenterOutlinedIcon sx={{ fontSize: 18, color: "primary.main", mt: 0.25 }} />
      <Box>
        <Typography variant="body2" fontWeight={600}>{fac.label} · {fac.hours}</Typography>
        <Typography variant="caption" color="text.secondary">{fac.note}</Typography>
      </Box>
    </Box>
  );
}

function DuesRow({ d }) {
  return (
    <>
      <Divider sx={{ my: 1 }} />
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="caption" color="text.secondary">Flat {d.flat}</Typography>
        <Typography variant="body2" fontWeight={700} color="error.main">₹{d.amount.toLocaleString("en-IN")}</Typography>
      </Box>
      <Typography variant="caption" color="text.secondary">Due by {d.dueDate}</Typography>
    </>
  );
}
