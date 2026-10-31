import { useMemo } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { BrowserRouter } from "react-router-dom";
import themeConfig, { lightPalette, darkPalette } from "./config/themeConfig";
import { AuthProvider } from "./context/AuthContext";
import { AppProvider } from "./context/AppContext";
import { OnboardingProvider } from "./context/OnboardingContext";
import { ResidentProvider, useResidents } from "./context/ResidentContext";
import { ComplaintProvider } from "./context/ComplaintContext";
import { VisitorProvider } from "./context/VisitorContext";
import { NotificationProvider } from "./context/NotificationContext";
import { ThemeModeProvider, useThemeMode } from "./context/ThemeModeContext";
import AppRoutes from "./routes/AppRoutes";
import "./styles/global.css";

// Inner component so useResidents can access ResidentContext
function OnboardingBridge({ children }) {
  const { addResident } = useResidents();
  return (
    <OnboardingProvider onApprove={addResident}>
      {children}
    </OnboardingProvider>
  );
}

// Reads the live mode from ThemeModeContext and (re)builds the MUI theme
// whenever it changes, so the Appearance settings' theme toggle actually
// has a live theme to act on.
function ThemedApp({ children }) {
  const { mode } = useThemeMode();
  const theme = useMemo(
    () => createTheme({ ...themeConfig, palette: mode === "dark" ? darkPalette : lightPalette }),
    [mode]
  );
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeModeProvider>
          <ThemedApp>
            <NotificationProvider>
              <AppProvider>
                <ResidentProvider>
                  <ComplaintProvider>
                    <VisitorProvider>
                      <OnboardingBridge>
                        <AppRoutes />
                      </OnboardingBridge>
                    </VisitorProvider>
                  </ComplaintProvider>
                </ResidentProvider>
              </AppProvider>
            </NotificationProvider>
          </ThemedApp>
        </ThemeModeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
