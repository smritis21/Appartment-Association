import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Rating,
  Typography,
} from "@mui/material";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import {
  PROVIDER_AVAILABILITY_META,
  tradeLabel,
  getTrade,
} from "../mock/serviceProviders";

// Profile card for an empanelled service provider (plumber / electrician / …).
// Raising a job is always allowed; availability only sets expectations on when
// they can attend (shown as a chip).
export default function ServiceProviderCard({ provider, onRaise }) {
  const meta = PROVIDER_AVAILABILITY_META[provider.availability];
  const trade = getTrade(provider.trade);
  const TradeIcon = trade?.icon ?? BuildOutlinedIcon;

  return (
    <Card variant="outlined" sx={{ borderRadius: 3, borderColor: "divider", height: "100%", display: "flex", flexDirection: "column" }}>
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: "primary.light",
              color: "primary.dark",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <TradeIcon fontSize="small" />
          </Box>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography variant="subtitle1" fontWeight={700} color="text.primary" noWrap>
                {provider.name}
              </Typography>
              {provider.verified && (
                <VerifiedOutlinedIcon sx={{ fontSize: 16, color: "info.main" }} titleAccess="Verified" />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {tradeLabel(provider.trade)} · {provider.agency}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 1.5 }}>
          <Rating value={provider.rating} precision={0.1} size="small" readOnly />
          <Typography variant="body2" fontWeight={600} color="text.primary">
            {provider.rating.toFixed(1)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            · {provider.jobsDone} jobs done
          </Typography>
        </Box>

        <Chip size="small" label={meta.label} color={meta.color} variant="outlined" sx={{ mt: 1.5 }} />

        {provider.phone && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 1.5 }}>
            <PhoneOutlinedIcon sx={{ fontSize: 15 }} color="action" />
            <Typography
              variant="body2"
              component="a"
              href={`tel:${provider.phone}`}
              color="text.secondary"
              onClick={(e) => e.stopPropagation()}
              sx={{ textDecoration: "none", "&:hover": { color: "primary.main", textDecoration: "underline" } }}
            >
              {provider.phone}
            </Typography>
          </Box>
        )}
      </CardContent>

      <Divider />
      <Box sx={{ p: 2 }}>
        <Button fullWidth variant="contained" size="small" onClick={() => onRaise(provider)}>
          Raise a Job
        </Button>
      </Box>
    </Card>
  );
}
