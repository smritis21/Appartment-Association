import { createContext, useContext, useEffect, useState } from "react";
import { setAuthToken } from "../services/apiClient";
import { fetchProfile } from "../services/authService";
import { fetchResident } from "../services/residentService";

const AuthContext = createContext(null);

const STORAGE_KEY = "jkr_user";
const TOKEN_KEY = "jkr_token";

/**
 * Where the session is kept depends on "Remember me":
 *
 *   sessionStorage - the default. Survives a page refresh but is dropped when
 *                    the tab closes. Without this a reload logged the user
 *                    straight back out, which also meant a deep link could
 *                    never be opened directly.
 *   localStorage   - chosen via "Remember me". Survives closing the browser.
 *
 * Reads check sessionStorage first so that a "remember me" session from a
 * previous visit does not override the account signed in on this tab.
 */
function readStored(key) {
  try {
    return sessionStorage.getItem(key) ?? localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key, value, remember) {
  try {
    const store = remember ? localStorage : sessionStorage;
    store.setItem(key, value);
    // Never leave the same key behind in the other store, or a later read
    // could resurrect a stale identity.
    (remember ? sessionStorage : localStorage).removeItem(key);
  } catch {
    /* storage unavailable (private mode) - the session stays in memory */
  }
}

function clearStored(key) {
  try {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  } catch {
    /* nothing to clear */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = readStored(STORAGE_KEY);
      const token = readStored(TOKEN_KEY);
      if (token) setAuthToken(token);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = (userData, token, remember = false) => {
    setUser(userData);
    setAuthToken(token);
    writeStored(STORAGE_KEY, JSON.stringify(userData), remember);
    if (token) writeStored(TOKEN_KEY, token, remember);
  };

  const logout = () => {
    setUser(null);
    setAuthToken(null);
    clearStored(STORAGE_KEY);
    clearStored(TOKEN_KEY);
  };

  // A request that comes back unauthorised means the token has expired. The
  // session is cleared here so the app falls back to the login screen on its
  // own, rather than leaving the user on a page that can no longer load.
  useEffect(() => {
    const onExpired = () => {
      setUser(null);
      setAuthToken(null);
      clearStored(STORAGE_KEY);
      clearStored(TOKEN_KEY);
    };
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, []);

  const updateUser = (updates) => {
    setUser((prev) => {
      const updated = { ...prev, ...updates };
      // Rewrite into whichever store this session already lives in, so a
      // profile edit does not silently promote a session to "remembered".
      try {
        const remembered = localStorage.getItem(STORAGE_KEY) !== null;
        writeStored(STORAGE_KEY, JSON.stringify(updated), remembered);
      } catch {
        /* storage unavailable - in-memory update still applies */
      }
      return updated;
    });
  };

  /**
   * Re-fetches the signed-in user's profile and, when it's linked to a
   * resident record, resolves that resident's flat/wing/phone and folds them
   * into the shared `user` object. This is the single place that does that
   * lookup - pages that need `user.flat` (facility/temple booking, workforce
   * dialogs, house-help directory, etc.) just read it off `useAuth().user`
   * instead of each fetching the resident themselves.
   *
   * Call this once right after login and whenever the profile screen wants a
   * fresh copy - never per-page.
   */
  const refreshProfile = async () => {
    const profile = await fetchProfile();
    let merged = profile;
    if (profile.residentId) {
      try {
        const resident = await fetchResident(profile.residentId);
        merged = {
          ...profile,
          flat: `${resident.wing}-${resident.flat}`,
          wing: resident.wing,
          phone: resident.phone,
        };
      } catch {
        // Resident lookup failed (offline / not found) - keep the profile
        // fields we do have rather than failing the whole refresh.
      }
    }
    updateUser(merged);
    return merged;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used inside AuthProvider");
  return ctx;
}

export default AuthContext;

