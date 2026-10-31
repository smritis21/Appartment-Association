import { Box, Paper, Typography } from "@mui/material";
import { Outlet } from "react-router-dom";
import appConfig from "../config/appConfig";
import PublicNavbar from "../components/layout/PublicNavbar";

export default function AuthLayout() {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>
      <PublicNavbar />
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <Box className="anim-fade-in-up" sx={{ width: "100%", maxWidth: 440 }}>
          <Box sx={{ textAlign: "center", mb: 3 }}>
            <Typography
              variant="h5"
              fontWeight={700}
              sx={{ fontFamily: "var(--font-serif)", color: "primary.main" }}
            >
              {appConfig.appName}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Apartment Association Management
            </Typography>
          </Box>
          <Paper elevation={0} sx={{ borderRadius: 4, p: 4, border: "1px solid", borderColor: "divider", boxShadow: "var(--shadow-lg)" }}>
            <Outlet />
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
