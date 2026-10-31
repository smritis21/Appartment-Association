import { Box, Card, CardActionArea, CardContent, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import FlatStatusChip from "./FlatStatusChip";

export default function FlatCard({ flat, owner, tenant }) {
  const navigate = useNavigate();

  return (
    <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
      <CardActionArea onClick={() => navigate(`/directory/flat/${flat.id}`)}>
        <CardContent sx={{ pb: "12px !important" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              {flat.wing}-{flat.flat}
            </Typography>
            <FlatStatusChip status={flat.status} />
          </Box>
          <Typography variant="caption" color="text.secondary" display="block">
            Floor {flat.floor}
          </Typography>
          {owner && (
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              Owner: {owner.name}
            </Typography>
          )}
          {tenant && (
            <Typography variant="caption" color="text.secondary" display="block" noWrap>
              Tenant: {tenant.name}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
}
