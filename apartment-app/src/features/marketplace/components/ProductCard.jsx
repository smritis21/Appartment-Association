import { Box, Card, CardActionArea, CardContent, Chip, IconButton, Typography } from "@mui/material";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import FavoriteIcon from "@mui/icons-material/Favorite";
import ChairOutlinedIcon from "@mui/icons-material/ChairOutlined";
import DevicesOutlinedIcon from "@mui/icons-material/DevicesOutlined";
import MenuBookOutlinedIcon from "@mui/icons-material/MenuBookOutlined";
import ToysOutlinedIcon from "@mui/icons-material/ToysOutlined";
import KitchenOutlinedIcon from "@mui/icons-material/KitchenOutlined";
import SportsTennisOutlinedIcon from "@mui/icons-material/SportsTennisOutlined";
import CategoryOutlinedIcon from "@mui/icons-material/CategoryOutlined";
import { PRODUCT_STATUS } from "../mock/products";
import { formatCurrency } from "../../../utils/formatCurrency";
import { formatDate } from "../../../utils/formatDate";

const CATEGORY_ICONS = {
  Furniture: ChairOutlinedIcon,
  Electronics: DevicesOutlinedIcon,
  Books: MenuBookOutlinedIcon,
  "Kids & Toys": ToysOutlinedIcon,
  Kitchen: KitchenOutlinedIcon,
  Sports: SportsTennisOutlinedIcon,
};

export default function ProductCard({ product, wished, onOpen, onToggleWish }) {
  const sold = product.status === PRODUCT_STATUS.SOLD;
  const Icon = CATEGORY_ICONS[product.category] ?? CategoryOutlinedIcon;

  return (
    <Card sx={{ borderRadius: 3, height: "100%", position: "relative", opacity: sold ? 0.75 : 1 }}>
      <CardActionArea onClick={() => onOpen(product)} sx={{ height: "100%", alignItems: "stretch" }}>
        {/* Image stand-in - category art block */}
        <Box
          sx={{
            height: 110,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: "primary.light",
            color: "primary.main",
          }}
        >
          <Icon sx={{ fontSize: 44, opacity: 0.75 }} />
        </Box>
        <CardContent sx={{ pb: 2 }}>
          <Typography variant="subtitle2" fontWeight={700} noWrap>
            {product.title}
          </Typography>
          <Typography variant="h6" fontWeight={700} color="primary.main">
            {formatCurrency(product.price)}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", mt: 0.5, flexWrap: "wrap" }}>
            <Chip label={product.category} size="small" variant="outlined" />
            {sold && <Chip label="Sold" size="small" color="default" />}
          </Box>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
            {/* Real API listings (services/marketplaceService.js::toUiListing) never carry a
                `seller` object - only mock/offline data does - so this must not assume one exists. */}
            Flat {product.seller?.flat ?? "-"} · {formatDate(product.listedAt)}
          </Typography>
        </CardContent>
      </CardActionArea>

      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); onToggleWish(product); }}
        sx={{ position: "absolute", top: 6, right: 6, bgcolor: "background.paper", "&:hover": { bgcolor: "background.paper" } }}
      >
        {wished ? <FavoriteIcon fontSize="small" color="error" /> : <FavoriteBorderIcon fontSize="small" />}
      </IconButton>
    </Card>
  );
}

