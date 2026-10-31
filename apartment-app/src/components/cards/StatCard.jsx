import { Box, Card, CardContent, Typography } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";

export default function StatCard({ label, value, trend, trendLabel, sx = {} }) {
  const isPositive = trend >= 0;

  return (
    <Card
      sx={{
        "&:hover": {
          transform: "translateY(-3px)",
          boxShadow: "var(--shadow-lg)",
          borderColor: "rgba(47,82,51,0.25)",
        },
        ...sx,
      }}
    >
      <CardContent>
        <Typography
          variant="body2"
          color="text.secondary"
          gutterBottom
          sx={{ fontWeight: 500 }}
        >
          {label}
        </Typography>
        <Typography variant="h4" fontWeight={700} color="text.primary" sx={{ fontFamily: "var(--font-serif)" }}>
          {value}
        </Typography>
        {trend !== undefined && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1 }}>
            {isPositive ? (
              <TrendingUpIcon fontSize="small" sx={{ color: "success.main" }} />
            ) : (
              <TrendingDownIcon fontSize="small" sx={{ color: "error.main" }} />
            )}
            <Typography
              variant="caption"
              sx={{ color: isPositive ? "success.main" : "error.main", fontWeight: 600 }}
            >
              {trendLabel}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
