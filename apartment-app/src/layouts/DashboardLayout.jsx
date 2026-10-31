import { useEffect } from "react";
import { Box, Toolbar } from "@mui/material";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/layout/Navbar";
import Sidebar from "../components/layout/Sidebar";

export default function DashboardLayout() {
  const { pathname } = useLocation();

  // Bug 35: without this, navigating from a long, scrolled-down page (e.g.
  // Residents list) into a shorter one (e.g. a resident's detail view)
  // leaves the browser at the old scroll offset, producing a jarring snap
  // once the shorter page's content underflows the viewport. Reset to the
  // top on every route change, alongside the pathname-keyed enter animation
  // below.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Navbar className="no-print" />
      {/* The docked drawer already reserves its own width in this flex row,
          so the main area needs no extra left margin. */}
      <Sidebar className="no-print" />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          bgcolor: "transparent",
        }}
      >
        <Toolbar className="no-print" />
        {/* key on pathname so the container re-mounts and re-animates per route */}
        <Box
          key={pathname}
          className="page-enter app-main-content"
          sx={{ p: { xs: 2, sm: 3 } }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
