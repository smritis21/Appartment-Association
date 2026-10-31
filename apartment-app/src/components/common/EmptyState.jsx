import { Box, Typography, Button } from "@mui/material";
import InboxIcon from "@mui/icons-material/Inbox";

export default function EmptyState({
  icon: Icon = InboxIcon,
  title = "Nothing here yet",
  description = "",
  action,
  actionLabel,
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 8,
        gap: 1.5,
        color: "text.secondary",
      }}
    >
      <Box
        className="anim-float"
        sx={{
          width: 96,
          height: 96,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #eef3ed 0%, #e2ebe0 100%)",
          border: "1px solid rgba(47,82,51,0.12)",
          mb: 0.5,
        }}
      >
        <Icon sx={{ fontSize: 44, color: "primary.main", opacity: 0.6 }} />
      </Box>
      <Typography variant="h6" fontWeight={600} color="text.primary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", maxWidth: 360 }}>
          {description}
        </Typography>
      )}
      {action && actionLabel && (
        <Button variant="contained" onClick={action} sx={{ mt: 1 }}>
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}
