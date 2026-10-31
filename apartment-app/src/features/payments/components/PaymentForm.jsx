import { Box, Button, CircularProgress } from "@mui/material";
import { useState } from "react";
import PaymentMethodSelector from "./PaymentMethodSelector";
import { PAYMENT_METHODS } from "../mock/payments";

function validate(method, fields) {
  const errors = {};
  if (method === PAYMENT_METHODS.UPI) {
    if (!fields.upiId?.trim()) errors.upiId = "UPI ID is required";
    else if (!/^[\w.\-_]+@[\w]+$/.test(fields.upiId)) errors.upiId = "Invalid UPI ID format";
  }
  if (method === PAYMENT_METHODS.CREDIT_CARD || method === PAYMENT_METHODS.DEBIT_CARD) {
    if (!fields.cardNumber || fields.cardNumber.replace(/\s/g, "").length < 16) errors.cardNumber = "Enter valid 16-digit card number";
    if (!fields.expiry || fields.expiry.length < 5) errors.expiry = "Enter valid expiry MM/YY";
    if (!fields.cvv || fields.cvv.length < 3) errors.cvv = "Enter valid 3-digit CVV";
    if (!fields.nameOnCard?.trim()) errors.nameOnCard = "Name on card is required";
  }
  if (method === PAYMENT_METHODS.NET_BANKING) {
    if (!fields.bank) errors.bank = "Please select a bank";
  }
  if (method === PAYMENT_METHODS.WALLET) {
    if (!fields.wallet) errors.wallet = "Please select a wallet";
  }
  return errors;
}

export default function PaymentForm({ onSubmit, loading }) {
  const [method, setMethod] = useState(PAYMENT_METHODS.UPI);
  const [fields, setFields] = useState({});
  const [errors, setErrors] = useState({});

  const handlePay = () => {
    const errs = validate(method, fields);
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});
    onSubmit({ method, fields });
  };

  return (
    <Box>
      <PaymentMethodSelector
        method={method}
        setMethod={setMethod}
        fields={fields}
        setFields={setFields}
        errors={errors}
      />
      <Button
        fullWidth
        variant="contained"
        size="large"
        sx={{ mt: 3, fontWeight: 700, py: 1.5 }}
        onClick={handlePay}
        disabled={loading}
        startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
      >
        {loading ? "Processing Payment..." : "Pay Now"}
      </Button>
    </Box>
  );
}
