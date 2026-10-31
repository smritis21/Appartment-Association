import { Box, Button, Card, CardContent, Typography } from "@mui/material";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import { useNavigate } from "react-router-dom";
import FlatStatusChip from "./FlatStatusChip";

export default function HouseholdCard({ flat, owner, tenant, household }) {
  const navigate = useNavigate();

  return (
    <Card sx={{ borderRadius: 2, boxShadow: 2, height: "100%" }}>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <HomeOutlinedIcon sx={{ color: "primary.main" }} />
            <Typography variant="subtitle1" fontWeight={700}>
              Wing {flat.wing} · {flat.flat}
            </Typography>
          </Box>
          <FlatStatusChip status={flat.status} />
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Owner: <strong>{owner?.name ?? "-"}</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Tenant: <strong>{tenant?.name ?? "-"}</strong>
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
            <PeopleOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary">
              {household?.memberCount ?? 0} member{(household?.memberCount ?? 0) !== 1 ? "s" : ""}
            </Typography>
          </Box>
        </Box>

        <Button
          size="small"
          variant="outlined"
          fullWidth
          onClick={() => navigate(`/directory/flat/${flat.id}`)}
        >
          View Household
        </Button>
      </CardContent>
    </Card>
  );
}

