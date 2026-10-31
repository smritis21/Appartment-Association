import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { fetchPreferences, updatePreferences } from "../services/settingsService";
import i18n from "../i18n";

const ThemeModeContext = createContext(null);

function prefersDarkSystem() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

/** Resolve "light" | "dark" | "system" down to the actual "light"/"dark" MUI palette to render. */
function resolveMode(preference) {
  if (preference === "system") return prefersDarkSystem() ? "dark" : "light";
  return preference === "dark" ? "dark" : "light";
}

/**
 * Single source of truth for the app's current theme mode:
 *   - on mount, it loads the saved preference from GET /settings/preferences
 *     (falls back to "light" if the user isn't logged in / the request fails)
 *   - setMode() updates local state immediately (so the UI re-renders in the
 *     new mode right away) AND persists the change via updatePreferences()
 *   - "system" is resolved live against prefers-color-scheme
 */
export function ThemeModeProvider({ children }) {
  // `preference` is the raw saved choice ("light" | "dark" | "system").
  // `resolvedMode` is what actually gets fed into createTheme().
  const [preference, setPreference] = useState("light");
  const [systemPrefersDark, setSystemPrefersDark] = useState(prefersDarkSystem());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPreferences()
      .then((prefs) => {
        if (cancelled) return;
        if (prefs?.theme === "dark" || prefs?.theme === "light" || prefs?.theme === "system") {
          setPreference(prefs.theme);
        }
        // Bug 23: apply the saved language preference on load too - same
        // source (GET /settings/preferences) as the theme above.
        if (prefs?.language) {
          i18n.changeLanguage(prefs.language);
        }
      })
      .catch(() => {
        // Not logged in / offline - default to light/English, silently.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => { cancelled = true; };
  }, []);

  // Track the OS-level preference live, for when preference === "system".
  useEffect(() => {
    let mql;
    try {
      mql = window.matchMedia("(prefers-color-scheme: dark)");
    } catch {
      return undefined;
    }
    const onChange = (e) => setSystemPrefersDark(e.matches);
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const resolvedMode = preference === "system"
    ? (systemPrefersDark ? "dark" : "light")
    : resolveMode(preference);

  /**
   * Updates the mode both locally (instant re-render) and on the backend
   * (persisted for next login). Accepts "light" | "dark" | "system".
   */
  const setMode = async (nextPreference) => {
    setPreference(nextPreference);
    try {
      // The backend only recognises a real Theme enum value ("light"/"dark"),
      // not "system" - mirrors the same guard AppearanceSettingsPage already
      // applied before this context existed.
      if (nextPreference === "light" || nextPreference === "dark") {
        await updatePreferences({ theme: nextPreference });
      }
    } catch {
      // Persisting failed (offline, logged out, etc.) - keep the local
      // change so the UI still reflects the user's choice this session.
    }
  };

  const value = useMemo(
    () => ({ preference, mode: resolvedMode, setMode, loaded }),
    [preference, resolvedMode, loaded]
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) throw new Error("useThemeMode must be used inside ThemeModeProvider");
  return ctx;
}

export default ThemeModeContext;
