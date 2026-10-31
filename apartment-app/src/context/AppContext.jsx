import { createContext, useContext, useState } from "react";
import appConfig from "../config/appConfig";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [appName] = useState(appConfig.appName);
  // Start closed on phones so the drawer doesn't cover the whole screen.
  const [sidebarOpen, setSidebarOpen] = useState(
    () => window.matchMedia("(min-width: 900px)").matches
  );

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);

  return (
    <AppContext.Provider value={{ appName, sidebarOpen, toggleSidebar }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used inside AppProvider");
  return ctx;
}

export default AppContext;
