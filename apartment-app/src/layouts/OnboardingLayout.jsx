import { useEffect } from "react";
import { Box } from "@mui/material";
import { Outlet, useLocation } from "react-router-dom";
import PublicNavbar from "../components/layout/PublicNavbar";

// Bug 3: layout for the public resident-onboarding wizard. This flow has to
// be reachable by a brand-new, logged-out visitor (they have no account yet,
// and even after registering their account stays "pending" until approved -
// see backend/app/services/auth_service.py::login), so it can't live behind
// ProtectedRoute/DashboardLayout. Unlike AuthLayout's narrow centered card
// (built for a single login/signup form), the wizard's forms and document
// grids are laid out for the full content width DashboardLayout normally
// gives a page, so it gets its own simple shell: the same PublicNavbar used
// on the landing page, plus a wide, padded content area for the <Outlet/>.
export default function OnboardingLayout() {
  const { pathname } = useLocation();

  // Bug 35: same scroll-reset as DashboardLayout - stepping through the
  // wizard (e.g. a long registration form -> a shorter status page) would
  // otherwise keep the previous step's scroll offset.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
      <PublicNavbar />
      <Box sx={{ flexGrow: 1, width: "100%", maxWidth: 1120, mx: "auto", p: { xs: 2, sm: 3 } }}>
        <Outlet />
      </Box>
    </Box>
  );
}
