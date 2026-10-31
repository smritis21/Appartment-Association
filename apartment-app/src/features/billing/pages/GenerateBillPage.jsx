import {
  Alert, Box, Button, CircularProgress, Divider,
  Grid, MenuItem, Paper, Snackbar, TextField, Typography,
} from "@mui/material";
import CalculateOutlinedIcon from "@mui/icons-material/CalculateOutlined";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useResidents } from "../../../context/ResidentContext";
import { BILL_STATUS, BILLING_MONTHS, addRuntimeBill } from "../mock/bills";
import { formatCurrency } from "../../../utils/formatCurrency";
import PageHeader from "../../../components/common/PageHeader";
import BillStatusChip from "../components/BillStatusChip";
import { RESIDENT_STATUS } from "../../residents/mock/residents";

const GST_RATE = 0.18;

function num(v) { return parseFloat(v) || 0; }

export default function GenerateBillPage() {
  const navigate = useNavigate();
  const { residents } = useResidents();
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "" });

  const activeResidents = useMemo(
    () => residents.filter((r) => r.status === RESIDENT_STATUS.ACTIVE),
    [residents]
  );

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm({
    defaultValues: {
      residentId: "", billingMonth: "", dueDate: "",
      maintenance: 3500, water: "", parking: "", miscellaneous: "", discount: "",
    },
  });

  const watched = useWatch({ control });

  const subtotal = num(watched.maintenance) + num(watched.water) + num(watched.parking) + num(watched.miscellaneous);
  const discount = num(watched.discount);
  const gst      = Math.round((subtotal - discount) * GST_RATE);
  const total    = subtotal - discount + gst;

  const onSubmit = (data) => {
    setLoading(true);
    setTimeout(() => {
      const newBill = {
        id:            `BILL-${Date.now().toString().slice(-8)}`,
        residentId:    data.residentId,
        billingMonth:  data.billingMonth,
        maintenance:   num(data.maintenance),
        water:         num(data.water),
        parking:       num(data.parking),
        miscellaneous: num(data.miscellaneous),
        discount:      num(data.discount),
        gst,
        dueDate:       data.dueDate,
        paidDate:      null,
        status:        BILL_STATUS.PENDING,
        paymentRef:    null,
      };
      addRuntimeBill(newBill);
      setLoading(false);
      setSnackbar({ open: true, message: `Bill ${newBill.id} generated.` });
      setTimeout(() => navigate("/billing"), 1200);
    }, 700);
  };

  return (
    <Box>
      <PageHeader
        title="Generate Bill"
        subtitle="Create a new maintenance bill for a resident"
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Billing", href: "/billing" },
          { label: "Generate Bill" },
        ]}
      />

      <Box sx={{ maxWidth: 760 }}>
        <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <Paper elevation={1} sx={{ borderRadius: 3, p: 3, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Resident & Period</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="residentId" control={control}
                  rules={{ required: "Resident is required" }}
                  render={({ field }) => (
                    <TextField select label="Resident" fullWidth size="small"
                      error={!!errors.residentId} helperText={errors.residentId?.message} {...field}>
                      {activeResidents.map((r) => (
                        <MenuItem key={r.id} value={r.id}>
                          {r.name} - Wing {r.wing} · {r.flat}
                        </MenuItem>
                      ))}
                    </TextField>
                  )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller name="billingMonth" control={control}
                  rules={{ required: "Billing month is required" }}
                  render={({ field }) => (
                    <TextField select label="Billing Month" fullWidth size="small"
                      error={!!errors.billingMonth} helperText={errors.billingMonth?.message} {...field}>
                      {BILLING_MONTHS.map((m) => (
                        <MenuItem key={m} value={m}>{m}</MenuItem>
                      ))}
                    </TextField>
                  )} />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField label="Due Date" type="date" fullWidth size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={!!errors.dueDate} helperText={errors.dueDate?.message}
                  {...register("dueDate", { required: "Due date is required" })} />
              </Grid>
            </Grid>
          </Paper>

          <Paper elevation={1} sx={{ borderRadius: 3, p: 3, mb: 3 }}>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Charges</Typography>
            <Grid container spacing={2}>
              {[
                { name: "maintenance",   label: "Maintenance Fee",  required: true  },
                { name: "water",         label: "Water Charges",    required: false },
                { name: "parking",       label: "Parking Charges",  required: false },
                { name: "miscellaneous", label: "Miscellaneous",    required: false },
                { name: "discount",      label: "Discount",         required: false },
              ].map(({ name, label, required }) => (
                <Grid size={{ xs: 12, sm: 6 }} key={name}>
                  <TextField
                    label={label} type="number" fullWidth size="small"
                    inputProps={{ min: 0 }}
                    error={!!errors[name]} helperText={errors[name]?.message}
                    {...register(name, {
                      ...(required ? { required: `${label} is required` } : {}),
                      min: { value: 0, message: "Cannot be negative" },
                    })}
                  />
                </Grid>
              ))}
            </Grid>
          </Paper>

          {/* Auto-calculated summary */}
          <Paper elevation={1} sx={{ borderRadius: 3, p: 3, mb: 3, bgcolor: "primary.light" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <CalculateOutlinedIcon sx={{ color: "primary.main" }} />
              <Typography variant="subtitle1" fontWeight={700} color="primary.main">
                Auto-Calculated Total
              </Typography>
            </Box>
            <Divider sx={{ mb: 1.5 }} />
            {[
              ["Subtotal",    formatCurrency(subtotal)],
              ["Discount",    discount > 0 ? `− ${formatCurrency(discount)}` : "-"],
              ["GST (18%)",   formatCurrency(gst)],
            ].map(([label, value]) => (
              <Box key={label} sx={{ display: "flex", justifyContent: "space-between", py: 0.5 }}>
                <Typography variant="body2" color="text.secondary">{label}</Typography>
                <Typography variant="body2">{value}</Typography>
              </Box>
            ))}
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="subtitle1" fontWeight={700}>Grand Total</Typography>
              <Typography variant="h5" fontWeight={700} color="primary.main">
                {formatCurrency(total)}
              </Typography>
            </Box>
            <Box sx={{ mt: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="caption" color="text.secondary">Initial status:</Typography>
              <BillStatusChip status={BILL_STATUS.PENDING} />
            </Box>
          </Paper>

          <Box sx={{ display: "flex", gap: 2 }}>
            <Button variant="outlined" color="inherit" onClick={() => navigate("/billing")} sx={{ flex: 1 }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={loading} sx={{ flex: 2, fontWeight: 600 }}>
              {loading ? <CircularProgress size={22} color="inherit" /> : "Generate Bill"}
            </Button>
          </Box>
        </Box>
      </Box>

      <Snackbar open={snackbar.open} autoHideDuration={3000}
        onClose={() => setSnackbar((p) => ({ ...p, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
        <Alert severity="success" variant="filled"
          onClose={() => setSnackbar((p) => ({ ...p, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

