import { Card, CardActionArea, CardContent, Typography, Box } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

export default function SettingsCard({ label, subtitle, icon: Icon, onClick }) {
  return (
    <Card sx={{ borderRadius: 2, boxShadow: 1, height: "100%" }}>
      <CardActionArea onClick={onClick} sx={{ height: "100%" }}>
        <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          {Icon && (
            <Box sx={{
              width: 44, height: 44, borderRadius: 2,
              bgcolor: "primary.light", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <Icon sx={{ color: "primary.main", fontSize: 22 }} />
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body1" fontWeight={600}>{label}</Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" noWrap>{subtitle}</Typography>
            )}
          </Box>
          <ChevronRightIcon sx={{ color: "text.disabled" }} />
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
