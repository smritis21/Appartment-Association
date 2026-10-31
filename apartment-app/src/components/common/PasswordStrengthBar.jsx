import { Box, Typography } from "@mui/material";

function getStrength(password) {
  if (!password) return { score: 0, label: "", color: "inherit" };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: "Too short", color: "#a83b3b" },
    { label: "Weak",      color: "#a83b3b" },
    { label: "Fair",      color: "#b5721f" },
    { label: "Good",      color: "#2f5aa8" },
    { label: "Strong",    color: "#2f7a3f" },
  ];
  return { score, ...levels[score] };
}

export default function PasswordStrengthBar({ password }) {
  const { score, label, color } = getStrength(password);
  if (!password) return null;

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: "flex", gap: 0.5 }}>
        {[1, 2, 3, 4].map((seg) => (
          <Box
            key={seg}
            sx={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              bgcolor: seg <= score ? color : "divider",
              transition: "background-color 0.25s ease",
            }}
          />
        ))}
      </Box>
      <Typography variant="caption" sx={{ mt: 0.5, display: "block", color, fontWeight: 500 }}>
        {label}
      </Typography>
    </Box>
  );
}
