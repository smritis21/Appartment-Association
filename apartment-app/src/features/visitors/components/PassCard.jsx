import { Box, Card, CardContent, Chip, Divider, Typography } from "@mui/material";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import QrCode from "./QrCode";
import { PASS_STATE, PASS_TYPE, ENTRY_STATE, computePassState } from "../mock/passes";
import { formatDateTime } from "../../../utils/formatDate";

const STATE_CONFIG = {
  [PASS_STATE.ACTIVE]: { label: "Active", color: "success", tint: "#f0faf2", border: "#2f7a3f" },
  [PASS_STATE.UPCOMING]: { label: "Upcoming", color: "info", tint: "#eef2fb", border: "#2f5aa8" },
  [PASS_STATE.EXPIRED]: { label: "Expired", color: "default", tint: "#f4f3ef", border: "#d9d5cb" },
};

const ENTRY_LABEL = {
  [ENTRY_STATE.AWAITING]: "Not yet arrived",
  [ENTRY_STATE.ON_PREMISE]: "On premises",
  [ENTRY_STATE.EXITED]: "Checked out",
  [ENTRY_STATE.DENIED]: "Entry denied",
};

export default function PassCard({ pass }) {
  const state = computePassState(pass);
  const cfg = STATE_CONFIG[state];
  const isDelivery = pass.type === PASS_TYPE.DELIVERY;
  const TypeIcon = isDelivery ? LocalShippingOutlinedIcon : PersonOutlineIcon;

  return (
    <Card
      sx={{
        borderRadius: 3,
        border: "1.5px solid",
        borderColor: cfg.border,
        bgcolor: cfg.tint,
        boxShadow: 2,
        height: "100%",
        opacity: state === PASS_STATE.EXPIRED ? 0.85 : 1,
      }}
    >
      <CardContent sx={{ p: 2.5, display: "flex", gap: 2 }}>
        <QrCode value={pass.code} size={132} />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap>
                {pass.visitorName}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
                <TypeIcon fontSize="small" />
                <Typography variant="body2" color="text.secondary" noWrap>
                  {pass.purpose}
                </Typography>
              </Box>
            </Box>
            <Chip label={cfg.label} color={cfg.color} size="small" />
          </Box>

          <Typography
            variant="h6"
            fontFamily="var(--font-mono)"
            fontWeight={700}
            letterSpacing={2}
            sx={{ mt: 1 }}
          >
            {pass.code}
          </Typography>

          <Divider sx={{ my: 1 }} />

          <Typography variant="caption" color="text.secondary" display="block">
            Flat {pass.flat} · Host {pass.host}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block">
            Valid {formatDateTime(pass.validFrom)} - {formatDateTime(pass.validTo)}
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, fontWeight: 600 }}>
            {ENTRY_LABEL[pass.entry]}
            {pass.entry === ENTRY_STATE.ON_PREMISE && ` · in since ${formatDateTime(pass.entryAt)}`}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

