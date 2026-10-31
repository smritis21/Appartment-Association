import { useState, useMemo } from "react";
import { Box, Grid, TextField, InputAdornment, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import SettingsCard from "../components/SettingsCard";
import { SETTINGS_NAV } from "../mock/settings";

const ICON_MAP = {
  PersonOutlined:        PersonOutlinedIcon,
  NotificationsOutlined: NotificationsOutlinedIcon,
  LockOutlined:          LockOutlinedIcon,
  PaletteOutlined:       PaletteOutlinedIcon,
  ApartmentOutlined:     ApartmentOutlinedIcon,
  SettingsOutlined:      SettingsOutlinedIcon,
  InfoOutlined:          InfoOutlinedIcon,
};

export default function SettingsDashboardPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const items = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return SETTINGS_NAV;
    return SETTINGS_NAV.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        item.keywords.some((k) => k.includes(q))
    );
  }, [search]);

  return (
    <Box>
      <PageHeader
        title="Settings"
        subtitle="Manage your profile, preferences, and system configuration."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }]}
      />

      <TextField
        fullWidth size="small"
        placeholder="Search settings - try 'password', 'theme', 'maintenance'…"
        value={search} onChange={(e) => setSearch(e.target.value)}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
        sx={{ mb: 3 }}
      />

      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 6 }}>
          No settings found for &quot;{search}&quot;.
        </Typography>
      ) : (
        <Grid container spacing={2}>
          {items.map((item) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.path}>
              <SettingsCard
                label={item.label}
                subtitle={item.subtitle}
                icon={ICON_MAP[item.icon]}
                onClick={() => navigate(item.path)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

