import { Box, Card, CardContent, Chip, Divider, Typography } from "@mui/material";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDateTime } from "../../../utils/formatDate";
import { purposeLabel } from "../mock/donations";

function Row({ label, value }) {
  return (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ textAlign: "right" }}>
        {value}
      </Typography>
    </Box>
  );
}

// Renders the donation receipt in its issued state. Used on the receipt page.
export default function ReceiptCard({ donation }) {
  return (
    <Card sx={{ borderRadius: 3, border: "1.5px solid", borderColor: "success.main" }}>
      <Box
        sx={{
          bgcolor: "primary.light",
          px: 3,
          py: 2,
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <VerifiedOutlinedIcon color="primary" />
        <Box>
          <Typography variant="subtitle1" fontWeight={700} color="text.primary">
            Donation Receipt
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {donation.receiptNo}
          </Typography>
        </Box>
        <Chip label="Issued" color="success" size="small" sx={{ ml: "auto", fontWeight: 600 }} />
      </Box>

      <CardContent>
        <Box sx={{ textAlign: "center", py: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            Amount Received
          </Typography>
          <Typography variant="h4" fontWeight={700} color="primary.main">
            {formatCurrency(donation.amount)}
          </Typography>
        </Box>

        <Divider sx={{ my: 1 }} />

        <Row label="Purpose" value={purposeLabel(donation.purpose)} />
        <Row label="Devotee" value={donation.devotee} />
        <Row label="Flat" value={donation.flat} />
        <Row label="Reference No." value={donation.id} />
        <Row label="Date" value={formatDateTime(donation.createdAt)} />

        <Divider sx={{ my: 1.5 }} />
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", textAlign: "center" }}>
          Thank you for your generous contribution. This receipt is
          computer-generated and does not require a signature.
        </Typography>
      </CardContent>
    </Card>
  );
}
