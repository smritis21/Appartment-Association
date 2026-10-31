import { Box, Card, CardActionArea, CardContent, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDate } from "../../../utils/formatDate";
import { getBillTotal } from "../mock/bills";
import BillStatusChip from "./BillStatusChip";

export default function BillCard({ bill, residentName }) {
  const navigate = useNavigate();
  return (
    <Card sx={{ borderRadius: 2, boxShadow: 1 }}>
      <CardActionArea onClick={() => navigate(`/billing/invoice/${bill.id}`)}>
        <CardContent>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
            <Typography variant="caption" fontFamily="monospace" fontWeight={600} color="text.secondary">
              {bill.id}
            </Typography>
            <BillStatusChip status={bill.status} />
          </Box>
          <Typography variant="subtitle2" fontWeight={700} noWrap>{residentName ?? "-"}</Typography>
          <Typography variant="caption" color="text.secondary">{bill.billingMonth}</Typography>
          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1.5 }}>
            <Typography variant="body2" color="text.secondary">Due {formatDate(bill.dueDate)}</Typography>
            <Typography variant="body2" fontWeight={700}>{formatCurrency(getBillTotal(bill))}</Typography>
          </Box>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

