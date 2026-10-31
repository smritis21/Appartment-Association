import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import { AVAILABILITY_META, categoryLabel } from "../mock/houseHelp";

const initials = (name) =>
  name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function HouseHelpCard({ help }) {
  const meta = AVAILABILITY_META[help.availability] || { label: "Available", color: "success" };

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        borderColor: "divider",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <Avatar sx={{ bgcolor: "primary.light", color: "primary.dark", fontWeight: 700 }}>
            {initials(help.name)}
          </Avatar>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography variant="subtitle1" fontWeight={700} color="text.primary" noWrap>
                {help.name}
              </Typography>
              {help.verified && (
                <VerifiedOutlinedIcon sx={{ fontSize: 16, color: "info.main" }} titleAccess="Verified" />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {categoryLabel(help.category)} · {help.experienceYears} yrs exp
            </Typography>
          </Box>
          <Chip size="small" label={meta.label} color={meta.color} variant="outlined" />
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          {help.bio}
        </Typography>

        {help.phone && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1.5 }}>
            <PhoneOutlinedIcon sx={{ fontSize: 15 }} color="action" />
            <Typography
              variant="body2"
              component="a"
              href={`tel:${help.phone}`}
              color="text.secondary"
              onClick={(e) => e.stopPropagation()}
              sx={{ textDecoration: "none", "&:hover": { color: "primary.main", textDecoration: "underline" } }}
            >
              {help.phone}
            </Typography>
          </Box>
        )}

        <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", gap: 0.5 }}>
          {help.languages.map((lang) => (
            <Chip key={lang} size="small" label={lang} variant="outlined" />
          ))}
        </Stack>
      </CardContent>

      {help.phone && (
        <>
          <Divider />
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "flex-end", p: 1.5 }}>
            <Button
              variant="outlined"
              size="small"
              startIcon={<PhoneOutlinedIcon />}
              component="a"
              href={`tel:${help.phone}`}
              fullWidth
            >
              Contact
            </Button>
          </Box>
        </>
      )}
    </Card>
  );
}
