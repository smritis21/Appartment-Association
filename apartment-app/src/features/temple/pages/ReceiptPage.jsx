import { Box, Button, Grid } from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import VolunteerActivismOutlinedIcon from "@mui/icons-material/VolunteerActivismOutlined";
import { useLocation, useNavigate } from "react-router-dom";
import PageHeader from "../../../components/common/PageHeader";
import EmptyState from "../../../components/common/EmptyState";
import ReceiptCard from "../components/ReceiptCard";

export default function ReceiptPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const donation = state?.donation;

  return (
    <Box>
      <PageHeader
        title="Donation Receipt"
        subtitle="Your contribution has been recorded"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Temple", href: "/temple" },
          { label: "Receipt" },
        ]}
      />

      {!donation ? (
        <EmptyState
          icon={VolunteerActivismOutlinedIcon}
          title="No receipt to show"
          description="This receipt is no longer available. Make a donation to generate a new one."
          action={() => navigate("/temple/donate")}
          actionLabel="Make a Donation"
        />
      ) : (
        <Grid container justifyContent="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <ReceiptCard donation={donation} />
            <Box sx={{ display: "flex", gap: 1.5, mt: 2.5 }}>
              <Button
                variant="outlined"
                color="inherit"
                fullWidth
                startIcon={<HomeOutlinedIcon />}
                onClick={() => navigate("/temple")}
              >
                Back to Temple
              </Button>
              <Button
                variant="contained"
                fullWidth
                startIcon={<VolunteerActivismOutlinedIcon />}
                onClick={() => navigate("/temple/donate")}
              >
                Donate Again
              </Button>
            </Box>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
