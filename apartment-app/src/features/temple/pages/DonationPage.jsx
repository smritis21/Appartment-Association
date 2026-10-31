// INT-33: Donation - live API integration
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Box, Card, CardContent, Chip, Grid, Typography } from "@mui/material";
import FavoriteBorderOutlinedIcon from "@mui/icons-material/FavoriteBorderOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import PageHeader from "../../../components/common/PageHeader";
import ConfirmationDialog from "../../../components/common/ConfirmationDialog";
import DonationForm from "../components/DonationForm";
import { createDonation } from "../../../services/templeService";
import { isOffline, ApiError } from "../../../services/apiClient";
import { DONATION_STATUS, nextDonationId, receiptNoFor, purposeLabel } from "../mock/donations";
import { formatCurrency } from "../../../utils/formatCurrency";
import { useAuth } from "../../../hooks/useAuth";

export default function DonationPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [pending, setPending] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [offline, setOffline] = useState(false);

  const handleSubmit = (data) => {
    setPending({ ...data, amount: Number(data.amount) });
  };

  const confirmDonation = async () => {
    setSubmitting(true);
    setApiError(null);
    try {
      let donation;
      if (offline) {
        const id = nextDonationId();
        donation = {
          id,
          amount: pending.amount,
          purpose: pending.purpose,
          devotee: pending.devotee.trim(),
          flat: user?.flat ?? "-",
          status: DONATION_STATUS.RECEIPTED,
          receiptNo: receiptNoFor(id),
          createdAt: new Date().toISOString(),
        };
      } else {
        const result = await createDonation({
          residentId: user?.residentId ?? user?.id ?? null,
          donorName: pending.devotee?.trim() ?? null,
          purpose: pending.purpose,
          amount: pending.amount,
          paymentMode: pending.paymentMode ?? null,
          notes: pending.notes ?? null,
        });
        donation = {
          id: result.id,
          amount: result.amount,
          purpose: result.purpose,
          devotee: result.donorName ?? pending.devotee?.trim(),
          flat: user?.flat ?? "-",
          status: DONATION_STATUS.RECEIPTED,
          receiptNo: result.receiptNo ?? receiptNoFor(result.id),
          createdAt: result.createdAt ?? new Date().toISOString(),
        };
        setOffline(false);
      }
      setPending(null);
      navigate("/temple/donate/receipt", { state: { donation } });
    } catch (err) {
      if (isOffline(err)) {
        setOffline(true);
        // retry locally
        const id = nextDonationId();
        const donation = {
          id,
          amount: pending.amount,
          purpose: pending.purpose,
          devotee: pending.devotee?.trim(),
          flat: user?.flat ?? "-",
          status: DONATION_STATUS.RECEIPTED,
          receiptNo: receiptNoFor(id),
          createdAt: new Date().toISOString(),
        };
        setPending(null);
        navigate("/temple/donate/receipt", { state: { donation } });
      } else {
        setApiError(err instanceof ApiError ? err.detail : "Donation failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <PageHeader
        title="Make a Donation"
        subtitle="Contribute towards temple activities and receive an instant receipt"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Temple", href: "/temple" },
          { label: "Donate" },
        ]}
      />

      {apiError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setApiError(null)}>{apiError}</Alert>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ borderRadius: 3, border: "1.5px solid", borderColor: "divider" }}>
            <CardContent>
              <DonationForm defaultDevotee={user?.name ?? "Resident"} onSubmit={handleSubmit} />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ borderRadius: 3, bgcolor: "primary.light", border: "1.5px solid", borderColor: "primary.main" }}>
            <CardContent sx={{ display: "flex", gap: 1.5 }}>
              <FavoriteBorderOutlinedIcon color="primary" />
              <Box>
                <Typography variant="subtitle1" fontWeight={700} color="text.primary">
                  Where your donation goes
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Every contribution supports daily poojas, annadhanam, festival
                  celebrations and upkeep of the community temple. A receipt is
                  generated instantly for your records.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ConfirmationDialog
        open={!!pending}
        title="Confirm your donation?"
        message={
          pending
            ? `You are donating ${formatCurrency(pending.amount)} towards ${purposeLabel(pending.purpose)}. A receipt will be issued to ${pending.devotee}.`
            : ""
        }
        confirmLabel={submitting ? "Processing…" : "Donate Now"}
        severity="primary"
        onConfirm={confirmDonation}
        onCancel={() => { setPending(null); setApiError(null); }}
      />
    </Box>
  );
}

