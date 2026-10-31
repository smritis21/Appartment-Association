export function formatCurrency(amount, currency = "INR") {
  if (amount === null || amount === undefined) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

