import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Rating,
  Stack,
  Typography,
} from "@mui/material";
import { getRatingsForHelp } from "../mock/ratings";
import { formatDate } from "../../../utils/formatDate";

// Read-only feed of the comments a worker has received. Opened from a card's
// rating row.
export default function RatingsDialog({ open, help, onClose }) {
  if (!help) return null;
  const ratings = getRatingsForHelp(help.id);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {help.name}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.5 }}>
          <Rating value={help.rating} precision={0.1} size="small" readOnly />
          <Typography variant="body2" color="text.secondary">
            {help.rating.toFixed(1)} · {help.ratingCount} ratings
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {ratings.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
            No written reviews yet.
          </Typography>
        ) : (
          <Stack spacing={1.5} divider={<Divider flexItem />}>
            {ratings.map((r) => (
              <Box key={r.id}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Rating value={r.stars} size="small" readOnly />
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(r.createdAt)}
                  </Typography>
                </Box>
                {r.comment && (
                  <Typography variant="body2" color="text.primary" sx={{ mt: 0.5 }}>
                    “{r.comment}”
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary">
                  - {r.by}, {r.flat}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

