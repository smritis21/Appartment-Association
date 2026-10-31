import { Box, Card, CardContent, Typography } from "@mui/material";

export default function DashboardCard({ title, value, subtitle, icon: Icon, color = "primary.main", onClick, sx = {} }) {
  return (
    <Card
      onClick={onClick}
      sx={{
        cursor: onClick ? "pointer" : "default",
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: "var(--shadow-lg)",
          borderColor: "rgba(47,82,51,0.25)",
        },
        "&:hover .dash-icon": { transform: "scale(1.08) rotate(-3deg)" },
        ...sx,
      }}
    >
      <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
        {Icon && (
          <Box
            className="dash-icon"
            sx={{
              width: 50,
              height: 50,
              borderRadius: 2.5,
              background: "linear-gradient(135deg, #eef3ed 0%, #e2ebe0 100%)",
              border: "1px solid rgba(47,82,51,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "transform 0.25s cubic-bezier(0.22,1,0.36,1)",
            }}
          >
            <Icon sx={{ color }} />
          </Box>
        )}
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            {title}
          </Typography>
          <Typography variant="h5" fontWeight={700} color="text.primary" sx={{ fontFamily: "var(--font-serif)" }}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
