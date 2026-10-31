import { Box, Typography, Divider } from "@mui/material";

export default function SettingsSection({ title, description, children, sx = {} }) {
  return (
    <Box sx={{ mb: 4, ...sx }}>
      {title && (
        <>
          <Typography variant="subtitle1" fontWeight={700} color="text.primary">{title}</Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, mb: 1 }}>{description}</Typography>
          )}
          <Divider sx={{ mb: 2 }} />
        </>
      )}
      {children}
    </Box>
  );
}
