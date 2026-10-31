import { Controller, useForm } from "react-hook-form";
import {
  Box,
  Button,
  Chip,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import VolunteerActivismOutlinedIcon from "@mui/icons-material/VolunteerActivismOutlined";
import { DONATION_PURPOSES, QUICK_AMOUNTS } from "../mock/donations";
import { formatCurrency } from "../../../utils/formatCurrency";

// Controlled donation form. Validation runs through react-hook-form and the
// parent receives a clean payload via onSubmit only when the form is valid.
export default function DonationForm({ defaultDevotee = "", onSubmit }) {
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: { amount: "", purpose: "", devotee: defaultDevotee },
  });

  const amount = watch("amount");

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
      <Typography variant="body2" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
        Quick amounts
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2.5 }}>
        {QUICK_AMOUNTS.map((amt) => (
          <Chip
            key={amt}
            label={formatCurrency(amt)}
            clickable
            color={Number(amount) === amt ? "primary" : "default"}
            variant={Number(amount) === amt ? "filled" : "outlined"}
            onClick={() => setValue("amount", amt, { shouldValidate: true })}
          />
        ))}
      </Box>

      <Controller
        name="amount"
        control={control}
        rules={{
          required: "Please enter a donation amount",
          min: { value: 1, message: "Amount must be greater than zero" },
        }}
        render={({ field }) => (
          <TextField
            {...field}
            label="Donation amount (INR)"
            type="number"
            fullWidth
            size="small"
            sx={{ mb: 2.5 }}
            error={!!errors.amount}
            helperText={errors.amount?.message}
          />
        )}
      />

      <Controller
        name="purpose"
        control={control}
        rules={{ required: "Please select a purpose" }}
        render={({ field }) => (
          <FormControl fullWidth size="small" sx={{ mb: 2.5 }} error={!!errors.purpose}>
            <InputLabel id="purpose-label">Purpose</InputLabel>
            <Select {...field} labelId="purpose-label" label="Purpose">
              {DONATION_PURPOSES.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </Select>
            {errors.purpose && <FormHelperText>{errors.purpose.message}</FormHelperText>}
          </FormControl>
        )}
      />

      <Controller
        name="devotee"
        control={control}
        rules={{ required: "Please enter the devotee name" }}
        render={({ field }) => (
          <TextField
            {...field}
            label="Devotee name"
            fullWidth
            size="small"
            sx={{ mb: 3 }}
            error={!!errors.devotee}
            helperText={errors.devotee?.message}
          />
        )}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        startIcon={<VolunteerActivismOutlinedIcon />}
      >
        Proceed to Donate
      </Button>
    </Box>
  );
}
