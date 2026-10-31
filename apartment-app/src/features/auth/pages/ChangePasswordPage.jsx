import { Box, Paper, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { useNavigate } from "react-router-dom";
import ChangePasswordForm from "../components/ChangePasswordForm";
import PageHeader from "../../../components/common/PageHeader";

export default function ChangePasswordPage() {
  const navigate = useNavigate();

  return (
    <Box>
      <PageHeader
        title="Change Password"
        subtitle="Update your account password"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Profile", href: "/profile" },
          { label: "Change Password" },
        ]}
      />

      <Paper
        elevation={1}
        sx={{ borderRadius: 3, p: 4, maxWidth: 480 }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: "primary.light",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LockOutlinedIcon sx={{ color: "primary.main" }} />
          </Box>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Security
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Choose a strong password
            </Typography>
          </Box>
        </Box>

        <ChangePasswordForm onSuccess={() => setTimeout(() => navigate("/profile"), 1500)} />
      </Paper>
    </Box>
  );
}
