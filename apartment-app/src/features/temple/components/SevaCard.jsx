import { Box, Card, CardContent, Chip, Typography } from "@mui/material";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { formatCurrency } from "../../../utils/formatCurrency";

export default function SevaCard({ seva, selected, onSelect }) {
  return (
    <Card
      onClick={() => onSelect(seva)}
      sx={{
        borderRadius: 3,
        cursor: "pointer",
        height: "100%",
        border: "1.5px solid",
        borderColor: selected ? "primary.main" : "divider",
        bgcolor: selected ? "primary.light" : "background.paper",
        transition: "border-color .15s, background-color .15s, box-shadow .15s",
        "&:hover": { borderColor: "primary.main", boxShadow: 2 },
      }}
    >
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Typography variant="h6" fontWeight={700} color="text.primary">
            {seva.name}
          </Typography>
          {selected && <CheckCircleIcon color="primary" fontSize="small" />}
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mt: 1, mb: 1.5 }}>
          <Chip
            label={formatCurrency(seva.price)}
            size="small"
            color="secondary"
            sx={{ fontWeight: 600 }}
          />
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
            <AccessTimeOutlinedIcon fontSize="inherit" />
            <Typography variant="caption">{seva.duration}</Typography>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary">
          {seva.description}
        </Typography>
      </CardContent>
    </Card>
  );
}
