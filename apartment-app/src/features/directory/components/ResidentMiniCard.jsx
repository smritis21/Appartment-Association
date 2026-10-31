import { Avatar, Box, Button, Paper, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { ROLE_LABELS } from "../../auth/mock/roles";

export default function ResidentMiniCard({ resident, label }) {
  const navigate = useNavigate();
  if (!resident) return null;

  const initials = resident.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, p: 2 }}>
      {label && (
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 1 }}>
          {label}
        </Typography>
      )}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ bgcolor: "primary.main", width: 40, height: 40, fontSize: 14, fontWeight: 700 }}>
          {initials}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} noWrap>{resident.name}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {ROLE_LABELS[resident.role] ?? resident.role}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" noWrap>
            {resident.phone} · {resident.email}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="outlined"
          onClick={() => navigate(`/residents/${resident.id}`)}
          sx={{ flexShrink: 0, fontSize: 11 }}
        >
          View
        </Button>
      </Box>
    </Paper>
  );
}
