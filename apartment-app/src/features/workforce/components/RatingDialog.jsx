import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Rating,
  TextField,
  Typography,
} from "@mui/material";
import StarBorderOutlinedIcon from "@mui/icons-material/StarBorderOutlined";

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

// Star-rating + comment captured after a completed booking. A star value is
// required; the comment is optional. Reused for house-help feedback.
export default function RatingDialog({ open, booking, onClose, onSubmit }) {
  const [stars, setStars] = useState(0);
  const [hover, setHover] = useState(-1);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setStars(0);
      setHover(-1);
      setComment("");
      setError("");
    }
  }, [open, booking]);

  if (!booking) return null;

  const handleSubmit = () => {
    if (stars < 1) {
      setError("Please select at least one star.");
      return;
    }
    onSubmit({ stars, comment });
  };

  const shown = hover !== -1 ? hover : stars;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Rate {booking.helpName}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          How was the service on booking {booking.id}?
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
          <Rating
            value={stars}
            onChange={(_, v) => {
              setStars(v ?? 0);
              setError("");
            }}
            onChangeActive={(_, v) => setHover(v)}
            emptyIcon={<StarBorderOutlinedIcon fontSize="inherit" />}
            size="large"
          />
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 72 }}>
            {STAR_LABELS[shown] ?? ""}
          </Typography>
        </Box>
        {error && (
          <Typography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>
            {error}
          </Typography>
        )}

        <TextField
          label="Comment (optional)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          multiline
          minRows={3}
          placeholder="Share a few words about the service"
          fullWidth
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSubmit} variant="contained">
          Submit Rating
        </Button>
      </DialogActions>
    </Dialog>
  );
}
