import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import TempleHinduOutlinedIcon from "@mui/icons-material/TempleHinduOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import { Navigate, useNavigate } from "react-router-dom";
import appConfig from "../../../config/appConfig";
import { useAuthContext } from "../../../context/AuthContext";
import PublicNavbar from "../../../components/layout/PublicNavbar";

const HIGHLIGHTS = [
  { icon: MeetingRoomOutlinedIcon, label: "Visitor & gate approvals" },
  { icon: PaymentsOutlinedIcon, label: "Payments & billing" },
  { icon: TempleHinduOutlinedIcon, label: "Temple poojas & events" },
];

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuthContext();

  // Already signed in - skip the landing page.
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100vh",
        bgcolor: "background.default",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Soft ambient gradient glow behind the hero */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: -160,
          left: "50%",
          transform: "translateX(-50%)",
          width: 720,
          height: 720,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(47,82,51,0.12) 0%, rgba(168,130,60,0.08) 45%, transparent 70%)",
          filter: "blur(20px)",
          pointerEvents: "none",
        }}
      />

      <PublicNavbar />

      {/* Centered hero content */}
      <Box
        sx={{
          position: "relative",
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          px: 3,
          py: 8,
        }}
      >
        <Chip
          className="anim-fade-in-down"
          label={`${appConfig.appShortName} · Community Portal`}
          color="secondary"
          size="small"
          sx={{ fontWeight: 600, mb: 3 }}
        />
        <Typography
          className="anim-fade-in-up"
          variant="h2"
          fontWeight={700}
          sx={{
            fontFamily: "var(--font-serif)",
            color: "primary.main",
            lineHeight: 1.12,
            maxWidth: 760,
            fontSize: { xs: "2.25rem", sm: "3rem", md: "3.4rem" },
          }}
        >
          {appConfig.appName}
        </Typography>
        <Typography
          className="anim-fade-in-up"
          variant="h6"
          color="text.secondary"
          fontWeight={400}
          sx={{ mt: 2, maxWidth: 560, animationDelay: "0.08s" }}
        >
          One place to manage your home, payments, visitors and temple
          activities across the community.
        </Typography>

        <Stack
          className="anim-fade-in-up"
          direction={{ xs: "column", sm: "row" }}
          spacing={1.5}
          sx={{ mt: 4, animationDelay: "0.16s" }}
        >
          <Button
            variant="contained"
            size="large"
            startIcon={<LoginOutlinedIcon />}
            onClick={() => navigate("/login")}
          >
            Login
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<PersonAddAltOutlinedIcon />}
            onClick={() => navigate("/signup")}
          >
            Register
          </Button>
        </Stack>

        <Stack
          className="stagger"
          direction={{ xs: "column", sm: "row" }}
          spacing={{ xs: 1.5, sm: 2 }}
          sx={{ mt: 6, alignItems: "center" }}
        >
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <Box
              key={label}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1.5,
                py: 1,
                borderRadius: 2.5,
                bgcolor: "rgba(255,255,255,0.7)",
                border: "1px solid",
                borderColor: "divider",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
                "&:hover": { transform: "translateY(-2px)", boxShadow: "var(--shadow-sm)" },
              }}
            >
              <Box sx={{ bgcolor: "primary.light", color: "primary.main", borderRadius: 2, p: 0.75, display: "flex" }}>
                <Icon fontSize="small" />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                {label}
              </Typography>
            </Box>
          ))}
        </Stack>

        <Typography className="anim-fade-in" variant="caption" color="text.secondary" sx={{ mt: 6, animationDelay: "0.4s" }}>
          New resident? Register and complete onboarding to get access.
        </Typography>
      </Box>
    </Box>
  );
}

