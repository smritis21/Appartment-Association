import { Chip } from "@mui/material";
import { DOC_CATEGORIES } from "../mock/documents";

const COLORS = {
  [DOC_CATEGORIES.APARTMENT_RULES]:      "#2f5233",
  [DOC_CATEGORIES.AGM_MINUTES]:          "#2f5aa8",
  [DOC_CATEGORIES.CIRCULARS]:            "#a8823c",
  [DOC_CATEGORIES.SOCIETY_CERTIFICATES]: "#7a3ca8",
  [DOC_CATEGORIES.OWNER_DOCUMENTS]:      "#2f7a3f",
  [DOC_CATEGORIES.TENANT_DOCUMENTS]:     "#a83b3b",
  [DOC_CATEGORIES.SALE_DEED]:            "#1e6b8a",
  [DOC_CATEGORIES.RENTAL_AGREEMENT]:     "#7a5e28",
  [DOC_CATEGORIES.KYC_DOCUMENTS]:        "#5a3ca8",
  [DOC_CATEGORIES.INVOICES]:             "#3c7a6b",
  [DOC_CATEGORIES.RECEIPTS]:             "#6b7a3c",
  [DOC_CATEGORIES.OTHER]:                "#5b6472",
};

export default function DocumentCategoryChip({ category, size = "small" }) {
  const color = COLORS[category] ?? "#5b6472";
  return (
    <Chip
      label={category}
      size={size}
      sx={{
        bgcolor: `${color}18`,
        color,
        fontWeight: 600,
        border: `1px solid ${color}40`,
      }}
    />
  );
}
