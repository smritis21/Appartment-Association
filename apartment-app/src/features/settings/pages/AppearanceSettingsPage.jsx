import { useEffect, useState } from "react";
import { Box, Paper, Button, Snackbar, Alert, Grid } from "@mui/material";
import PageHeader from "../../../components/common/PageHeader";
import SettingsSection from "../components/SettingsSection";
import { SettingsSelect } from "../components/SettingsFields";
import { defaultAppearance } from "../mock/settings";
import { fetchPreferences, updatePreferences } from "../../../services/settingsService";
import { isOffline } from "../../../services/apiClient";
import { useThemeMode } from "../../../context/ThemeModeContext";
import i18n from "../../../i18n";

const THEME_OPTIONS    = [{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System Default" }];
const ACCENT_OPTIONS   = [{ value: "green", label: "Green" }, { value: "blue", label: "Blue" }, { value: "purple", label: "Purple" }, { value: "orange", label: "Orange" }];
const FONT_OPTIONS     = [{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }];
const DENSITY_OPTIONS  = [{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }];
const LANGUAGE_OPTIONS = [{ value: "en", label: "English" }, { value: "ta", label: "தமிழ்" }, { value: "hi", label: "हिन्दी" }];

export default function AppearanceSettingsPage() {
  const [appearance, setAppearance] = useState({ ...defaultAppearance });
  const [toast, setToast] = useState({ open: false, msg: "", sev: "success" });
  const [saving, setSaving] = useState(false);
  // Bug 22/23: setMode() drives the live theme; i18n.changeLanguage() drives
  // the live translated strings. Both are applied immediately on save, not
  // just persisted for next login.
  const { setMode } = useThemeMode();

  useEffect(() => {
    fetchPreferences()
      .then((prefs) => {
        setAppearance((p) => ({ ...p, theme: prefs.theme, language: prefs.language }));
      })
      .catch(() => {});
  }, []);

  const set = (key) => (val) => setAppearance((p) => ({ ...p, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      // accentColor/fontSize/density have no backend field yet - only
      // theme and language (when it's a real Theme enum value, not "system")
      // are persisted server-side.
      const payload = { language: appearance.language };
      if (appearance.theme === "light" || appearance.theme === "dark") {
        payload.theme = appearance.theme;
      }
      await updatePreferences(payload);
      // Apply immediately so the app actually re-renders in the new
      // mode/language right away.
      await setMode(appearance.theme);
      await i18n.changeLanguage(appearance.language);
      setToast({ open: true, msg: "Appearance settings saved.", sev: "success" });
    } catch (err) {
      setToast({
        open: true,
        msg: isOffline(err) ? "Could not reach the server. Please try again." : err.detail || err.message,
        sev: "error",
      });
    } finally {
      setSaving(false);
    }
  };
  const handleReset = () => { setAppearance({ ...defaultAppearance }); setToast({ open: true, msg: "Appearance reset to defaults.", sev: "info" }); };

  return (
    <Box>
      <PageHeader
        title="Appearance Settings"
        subtitle="Customise the look and feel of the application."
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Settings", href: "/settings" }, { label: "Appearance" }]}
      />

      <Paper sx={{ p: 3, borderRadius: 2, boxShadow: 1, mb: 3 }}>
        <SettingsSection title="Theme & Colors" description="Choose your preferred visual theme.">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <SettingsSelect label="Theme"        value={appearance.theme}       options={THEME_OPTIONS}   onChange={set("theme")} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <SettingsSelect label="Accent Color" value={appearance.accentColor} options={ACCENT_OPTIONS}  onChange={set("accentColor")} />
            </Grid>
          </Grid>
        </SettingsSection>

        <SettingsSection title="Typography & Layout" description="Adjust text size and layout density.">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <SettingsSelect label="Font Size"       value={appearance.fontSize} options={FONT_OPTIONS}    onChange={set("fontSize")} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <SettingsSelect label="Layout Density"  value={appearance.density}  options={DENSITY_OPTIONS} onChange={set("density")} />
            </Grid>
          </Grid>
        </SettingsSection>

        <SettingsSection title="Language" description="Select your preferred display language. (Coverage is limited to a subset of screens for now - the sidebar, dashboard, and login page - more strings are added incrementally.)">
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <SettingsSelect label="Language" value={appearance.language} options={LANGUAGE_OPTIONS} onChange={set("language")} />
            </Grid>
          </Grid>
        </SettingsSection>

        <Box sx={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
          <Button variant="outlined" color="inherit" sx={{ textTransform: "none" }} onClick={handleReset}>Reset Defaults</Button>
          <Button variant="contained" sx={{ textTransform: "none" }} disabled={saving} onClick={handleSave}>Save Changes</Button>
        </Box>
      </Paper>

      <Snackbar open={toast.open} autoHideDuration={3000} onClose={() => setToast((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={toast.sev} onClose={() => setToast((p) => ({ ...p, open: false }))} sx={{ width: "100%" }}>
          {toast.msg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
