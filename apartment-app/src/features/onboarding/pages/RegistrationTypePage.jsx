import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
} from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import OnboardingStepperHeader from "../components/OnboardingStepperHeader";
import PageHeader from "../../../components/common/PageHeader";

const TYPES = [
  {
    value: "owner",
    label: "Owner",
    icon: HomeOutlinedIcon,
    description: "I own a flat in this apartment complex and wish to register as a resident owner.",
    path: "/onboarding/owner",
  },
  {
    value: "tenant",
    label: "Tenant",
    icon: PersonOutlinedIcon,
    description: "I am renting a flat in this apartment complex and wish to register as a tenant.",
    path: "/onboarding/tenant",
  },
];

export default function RegistrationTypePage() {
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();

  return (
    <Box>
      <PageHeader
        title="Resident Onboarding"
        subtitle="Register as a new resident of Jains Kences Retreat"
        breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Onboarding" }]}
      />

      <OnboardingStepperHeader activeStep={0} />

      <Box sx={{ maxWidth: 640, mx: "auto" }}>
        <Typography variant="h6" fontWeight={700} gutterBottom sx={{ textAlign: "center" }}>
          How would you like to register?
        </Typography>
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
          Select your registration type to continue
        </Typography>

        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, mb: 4 }}>
          {TYPES.map(({ value, label, icon: Icon, description }) => (
            <Card
              key={value}
              onClick={() => setSelected(value)}
              sx={{
                borderRadius: 3,
                border: "2px solid",
                borderColor: selected === value ? "primary.main" : "divider",
                bgcolor: selected === value ? "primary.light" : "background.paper",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: selected === value ? 3 : 1,
                "&:hover": { borderColor: "primary.main", boxShadow: 3 },
              }}
            >
              <CardContent sx={{ textAlign: "center", p: 3 }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    bgcolor: selected === value ? "primary.main" : "primary.light",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mx: "auto",
                    mb: 2,
                  }}
                >
                  <Icon sx={{ fontSize: 32, color: selected === value ? "white" : "primary.main" }} />
                </Box>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  {label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {description}
                </Typography>
              </CardContent>
            </Card>
          ))}
        </Box>

        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={!selected}
          onClick={() => navigate(TYPES.find((t) => t.value === selected)?.path)}
          sx={{ fontWeight: 600, py: 1.5 }}
        >
          Continue as {selected ? (selected === "owner" ? "Owner" : "Tenant") : "..."}
        </Button>
      </Box>
    </Box>
  );
}
