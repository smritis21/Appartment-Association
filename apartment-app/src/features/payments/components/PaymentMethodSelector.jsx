import {
  Box, FormControl, FormControlLabel, Grid, InputLabel,
  MenuItem, Radio, RadioGroup, Select, TextField, Typography,
} from "@mui/material";
import { PAYMENT_METHODS } from "../mock/payments";

const BANKS = ["HDFC Bank", "SBI", "ICICI Bank", "Axis Bank", "Kotak Bank", "PNB", "Bank of Baroda"];
const WALLETS = ["Paytm", "PhonePe", "Google Pay", "Amazon Pay", "Mobikwik"];

export default function PaymentMethodSelector({ method, setMethod, fields, setFields, errors }) {
  const handleField = (key, value) => setFields((prev) => ({ ...prev, [key]: value }));

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Select Payment Method</Typography>
      <RadioGroup
        row
        value={method}
        onChange={(e) => { setMethod(e.target.value); setFields({}); }}
        sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}
      >
        {Object.values(PAYMENT_METHODS).map((m) => (
          <FormControlLabel
            key={m}
            value={m}
            control={<Radio size="small" />}
            label={<Typography variant="body2">{m}</Typography>}
            sx={{
              border: "1px solid",
              borderColor: method === m ? "primary.main" : "divider",
              borderRadius: 2,
              px: 1.5,
              py: 0.5,
              m: 0,
              bgcolor: method === m ? "primary.light" : "transparent",
            }}
          />
        ))}
      </RadioGroup>

      {/* UPI */}
      {method === PAYMENT_METHODS.UPI && (
        <TextField
          fullWidth size="small" label="UPI ID"
          placeholder="yourname@upi"
          value={fields.upiId ?? ""}
          onChange={(e) => handleField("upiId", e.target.value)}
          error={!!errors?.upiId}
          helperText={errors?.upiId}
        />
      )}

      {/* Credit / Debit Card */}
      {(method === PAYMENT_METHODS.CREDIT_CARD || method === PAYMENT_METHODS.DEBIT_CARD) && (
        <Grid container spacing={2}>
          <Grid size={12}>
            <TextField
              fullWidth size="small" label="Card Number"
              placeholder="1234 5678 9012 3456"
              inputProps={{ maxLength: 19 }}
              value={fields.cardNumber ?? ""}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 16);
                handleField("cardNumber", v.replace(/(.{4})/g, "$1 ").trim());
              }}
              error={!!errors?.cardNumber}
              helperText={errors?.cardNumber}
            />
          </Grid>
          <Grid size={6}>
            <TextField
              fullWidth size="small" label="Expiry (MM/YY)"
              placeholder="MM/YY"
              inputProps={{ maxLength: 5 }}
              value={fields.expiry ?? ""}
              onChange={(e) => {
                let v = e.target.value.replace(/\D/g, "").slice(0, 4);
                if (v.length > 2) v = v.slice(0, 2) + "/" + v.slice(2);
                handleField("expiry", v);
              }}
              error={!!errors?.expiry}
              helperText={errors?.expiry}
            />
          </Grid>
          <Grid size={6}>
            <TextField
              fullWidth size="small" label="CVV"
              placeholder="123"
              type="password"
              inputProps={{ maxLength: 3 }}
              value={fields.cvv ?? ""}
              onChange={(e) => handleField("cvv", e.target.value.replace(/\D/g, "").slice(0, 3))}
              error={!!errors?.cvv}
              helperText={errors?.cvv}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              fullWidth size="small" label="Name on Card"
              value={fields.nameOnCard ?? ""}
              onChange={(e) => handleField("nameOnCard", e.target.value)}
              error={!!errors?.nameOnCard}
              helperText={errors?.nameOnCard}
            />
          </Grid>
        </Grid>
      )}

      {/* Net Banking */}
      {method === PAYMENT_METHODS.NET_BANKING && (
        <FormControl fullWidth size="small" error={!!errors?.bank}>
          <InputLabel>Select Bank</InputLabel>
          <Select
            label="Select Bank"
            value={fields.bank ?? ""}
            onChange={(e) => handleField("bank", e.target.value)}
          >
            {BANKS.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
          </Select>
          {errors?.bank && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{errors.bank}</Typography>}
        </FormControl>
      )}

      {/* Wallet */}
      {method === PAYMENT_METHODS.WALLET && (
        <FormControl fullWidth size="small" error={!!errors?.wallet}>
          <InputLabel>Select Wallet</InputLabel>
          <Select
            label="Select Wallet"
            value={fields.wallet ?? ""}
            onChange={(e) => handleField("wallet", e.target.value)}
          >
            {WALLETS.map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
          </Select>
          {errors?.wallet && <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>{errors.wallet}</Typography>}
        </FormControl>
      )}

      {/* Cash - no extra fields */}
      {method === PAYMENT_METHODS.CASH && (
        <Typography variant="body2" color="text.secondary">
          Cash payment will be recorded as received at the office.
        </Typography>
      )}
    </Box>
  );
}

