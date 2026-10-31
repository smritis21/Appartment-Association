import { AppBar, Button, Stack, Toolbar, Typography } from "@mui/material";
import LoginOutlinedIcon from "@mui/icons-material/LoginOutlined";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import { useNavigate } from "react-router-dom";
import appConfig from "../../config/appConfig";

// Top navigation for the public (logged-out) pages: home, login, register.
export default function PublicNavbar() {
  const navigate = useNavigate();

  return (
    <AppBar
      position="static"
      elevation={0}
      color="transparent"
      sx={{ borderBottom: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}
    >
      <Toolbar sx={{ maxWidth: 1120, width: "100%", mx: "auto", px: { xs: 2, md: 3 } }}>
        <Typography
          variant="h6"
          fontWeight={700}
          onClick={() => navigate("/")}
          sx={{ flexGrow: 1, fontFamily: "var(--font-serif)", color: "primary.main", cursor: "pointer" }}
        >
          {appConfig.appName}
        </Typography>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="text"
            color="primary"
            startIcon={<LoginOutlinedIcon />}
            onClick={() => navigate("/login")}
          >
            Login
          </Button>
          <Button
            variant="contained"
            startIcon={<PersonAddAltOutlinedIcon />}
            onClick={() => navigate("/signup")}
          >
            Register
          </Button>
        </Stack>
      </Toolbar>
    </AppBar>
  );
}
