import { Box, Button, InputAdornment, MenuItem, TextField } from "@mui/material";
import { useForm } from "react-hook-form";
import { PRODUCT_CATEGORIES } from "../mock/products";
import { validators } from "../../../utils/validators";

export default function ListProductForm({ onList, onCancel }) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: { title: "", category: "Furniture", price: "", description: "" },
  });

  const submit = (data) => {
    onList({
      title: data.title.trim(),
      category: data.category,
      price: Number(data.price),
      description: data.description.trim(),
    });
  };

  return (
    <Box component="form" onSubmit={handleSubmit(submit)} noValidate sx={{ pt: 1 }}>
      <TextField
        label="Item Title"
        fullWidth
        size="small"
        sx={{ mb: 2 }}
        error={!!errors.title}
        helperText={errors.title?.message}
        {...register("title", validators.required("Title"))}
      />

      <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
        <TextField
          select
          label="Category"
          size="small"
          fullWidth
          defaultValue="Furniture"
          {...register("category")}
        >
          {PRODUCT_CATEGORIES.map((c) => (
            <MenuItem key={c} value={c}>
              {c}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Price"
          type="number"
          size="small"
          fullWidth
          slotProps={{ input: { startAdornment: <InputAdornment position="start">₹</InputAdornment> } }}
          error={!!errors.price}
          helperText={errors.price?.message}
          {...register("price", {
            required: "Price is required",
            min: { value: 1, message: "Enter a valid price" },
          })}
        />
      </Box>

      <TextField
        label="Description"
        fullWidth
        multiline
        minRows={3}
        size="small"
        sx={{ mb: 3 }}
        error={!!errors.description}
        helperText={errors.description?.message ?? "Mention condition, age and pickup details"}
        {...register("description", validators.required("Description"))}
      />

      <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1 }}>
        <Button onClick={onCancel} color="inherit" variant="outlined">
          Cancel
        </Button>
        <Button type="submit" variant="contained">
          List Item
        </Button>
      </Box>
    </Box>
  );
}
