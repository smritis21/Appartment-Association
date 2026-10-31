import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Typography,
} from "@mui/material";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import DirectionsCarOutlinedIcon from "@mui/icons-material/DirectionsCarOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import { VISITOR_STATUS } from "../mock/visitors";
import { formatDateTime } from "../../../utils/formatDate";

const STATUS_CONFIG = {
  [VISITOR_STATUS.APPROVED]: { label: "Approved", color: "success", tint: "#f0faf2", border: "#2f7a3f" },
  [VISITOR_STATUS.REJECTED]: { label: "Rejected", color: "error", tint: "#fff5f5", border: "#a83b3b" },
  [VISITOR_STATUS.LEFT_AT_GATE]: { label: "Left at Gate", color: "info", tint: "#eef2fb", border: "#2f5aa8" },
};

function initials(name) {
  return name
    .replace(/[^a-zA-Z ]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function VisitorRequestCard({ request, onApprove, onReject, onLeaveAtGate }) {
  const isPending = request.status === VISITOR_STATUS.PENDING;
  const isDelivery = request.purpose === "Delivery";
  const leftAtGate = request.status === VISITOR_STATUS.LEFT_AT_GATE;
  const decided = STATUS_CONFIG[request.status];
  const accent = isPending ? "#b5721f" : decided?.border ?? "#b5721f";

  return (
    <Card
      sx={{
        position: "relative",
        overflow: "hidden",
        height: "100%",
        bgcolor: decided ? decided.tint : "background.paper",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: "var(--shadow-lg)",
          borderColor: accent,
        },
      }}
    >
      {/* Status accent bar */}
      <Box sx={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, bgcolor: accent }} />

      <CardContent sx={{ p: 2.5, pl: 3 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 2 }}>
          <Avatar
            sx={{
              width: 44,
              height: 44,
              fontWeight: 700,
              fontSize: 16,
              color: "#fff",
              background: "var(--gradient-primary)",
              boxShadow: "0 2px 8px -2px rgba(47,82,51,0.5)",
            }}
          >
            {initials(request.name) || "?"}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {request.name}
            </Typography>
            <Chip label={request.purpose} size="small" variant="outlined" sx={{ mt: 0.5 }} />
          </Box>
          {decided && <Chip label={decided.label} color={decided.color} size="small" />}
        </Box>

        <Divider sx={{ mb: 1.5 }} />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Detail icon={AccessTimeOutlinedIcon} text={`Requested ${formatDateTime(request.requestedAt)}`} />
          <Detail icon={MeetingRoomOutlinedIcon} text={`${request.gate} · Flat ${request.flat}`} />
          <Detail icon={PhoneOutlinedIcon} text={request.phone} />
          {request.vehicle && <Detail icon={DirectionsCarOutlinedIcon} text={request.vehicle} />}
        </Box>

        {isPending ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 2.5 }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                fullWidth
                color="error"
                variant="outlined"
                startIcon={<CancelOutlinedIcon />}
                onClick={() => onReject(request)}
              >
                Reject
              </Button>
              <Button
                fullWidth
                color="success"
                variant="contained"
                startIcon={<CheckCircleOutlinedIcon />}
                onClick={() => onApprove(request)}
              >
                Approve
              </Button>
            </Box>
            {isDelivery && (
              <Button
                fullWidth
                color="info"
                variant="outlined"
                startIcon={<Inventory2OutlinedIcon />}
                onClick={() => onLeaveAtGate(request)}
              >
                Leave at Gate
              </Button>
            )}
          </Box>
        ) : (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary" display="block">
              {decided.label} on {formatDateTime(request.decidedAt)}
            </Typography>
            {leftAtGate && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: 1 }}>
                <Detail icon={MeetingRoomOutlinedIcon} text={`Left at ${request.gate}`} />
                <Detail icon={BadgeOutlinedIcon} text={`Received by ${request.collectedBy}`} />
                <Detail icon={PlaceOutlinedIcon} text={`Collect from ${request.pickupLocation}`} />
              </Box>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

function Detail({ icon: Icon, text }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      <Icon sx={{ fontSize: 18, color: "primary.main", opacity: 0.55, flexShrink: 0 }} />
      <Typography variant="body2" color="text.secondary" noWrap>
        {text}
      </Typography>
    </Box>
  );
}
