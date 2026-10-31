import { Box, Card, CardContent, Typography } from "@mui/material";

export default function AuditActivityCard({ label, value, icon: Icon, color = "primary.main" }) {
  return (
    <Card sx={{ borderRadius: 2, boxShadow: 1, height: "100%" }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          {Icon && <Icon sx={{ color, fontSize: 22 }} />}
        </Box>
        <Typography variant="h4" fontWeight={700} color="text.primary">{value}</Typography>
      </CardContent>
    </Card>
  );
}
