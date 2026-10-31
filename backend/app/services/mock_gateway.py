"""Mock payment gateway for BE-11.

Simulates a real gateway without external calls or real financial data -
the single seam where a real provider (Razorpay, Stripe, etc.) would be
plugged in for production. Never accepts or stores card/bank details.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass
class GatewayResult:
    success:         bool
    transaction_ref: str
    message:         str


def process(
    amount: float,
    payment_method: str,
    mock_reference: str | None = None,
    simulate_failure: bool = False,
    simulate_timeout: bool = False,
) -> GatewayResult:
    """Simulate payment gateway processing.

    payment_method is one of: upi, online_transfer, cheque, cash.
    simulate_failure and simulate_timeout force those outcomes for testing.
    """
    if simulate_timeout:
        return GatewayResult(
            success=False,
            transaction_ref="",
            message="Gateway timeout: payment interrupted. Please retry.",
        )

    if simulate_failure:
        return GatewayResult(
            success=False,
            transaction_ref="",
            message="Gateway declined: simulated failure.",
        )

    # Generate a unique transaction reference
    ts   = datetime.now(timezone.utc).replace(tzinfo=None).strftime("%Y%m%d%H%M%S")
    uid  = uuid.uuid4().hex[:8].upper()
    ref  = mock_reference or f"TXN-{ts}-{uid}"

    method_labels = {
        "upi":             "UPI",
        "online_transfer": "Online Transfer",
        "cheque":          "Cheque",
        "cash":            "Cash",
    }
    label = method_labels.get(payment_method, payment_method.upper())

    return GatewayResult(
        success=True,
        transaction_ref=ref,
        message=f"Payment of ₹{amount:.2f} via {label} processed successfully.",
    )
