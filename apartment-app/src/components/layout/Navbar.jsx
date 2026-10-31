// Updated Navbar - replaces static NotificationsOutlinedIcon with FE-03 NotificationsPanel
import {
  AppBar,
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import { useAuth } from "../../hooks/useAuth";
import { NotificationsPanel } from "../../features/communication";

export default function Navbar({ className }) {
  const { toggleSidebar, appName } = useAppContext();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
    handleMenuClose();
  };

  return (
    <AppBar
      className={className}
      position="fixed"
      elevation={0}
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
        color: "text.primary",
      }}
    >
      <Toolbar sx={{ gap: 1 }}>
        <IconButton onClick={toggleSidebar} edge="start" size="small">
          <MenuIcon />
        </IconButton>

        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ flexGrow: 1, fontFamily: "var(--font-serif)", ml: 1 }}
        >
          {appName}
        </Typography>

        {/* FE-03: Notifications Panel (replaces static icon) */}
        <NotificationsPanel />

        <Tooltip title="Account">
          <IconButton onClick={handleMenuOpen} size="small" sx={{ ml: 0.5 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: 14 }}>
              {user?.name?.[0]?.toUpperCase() ?? "U"}
            </Avatar>
          </IconButton>
        </Tooltip>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          <MenuItem onClick={() => { navigate("/profile"); handleMenuClose(); }}>Profile</MenuItem>
          <MenuItem onClick={() => { navigate("/settings"); handleMenuClose(); }}>Settings</MenuItem>
          <MenuItem onClick={handleLogout}>Logout</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}

