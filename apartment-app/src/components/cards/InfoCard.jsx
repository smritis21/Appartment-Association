import { Box, Card, CardContent, Divider, Typography } from "@mui/material";

export default function InfoCard({ title, children, action, sx = {} }) {
  return (
    <Card sx={{ "&:hover": { boxShadow: "var(--shadow-md)" }, ...sx }}>
      <CardContent>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700} color="text.primary">
            {title}
          </Typography>
          {action && <Box>{action}</Box>}
        </Box>
        <Divider sx={{ mb: 2 }} />
        {children}
      </CardContent>
    </Card>
  );
}
