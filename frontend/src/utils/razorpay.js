import { Checkout } from "capacitor-razorpay";

export async function openRazorpayCheckout(
  order,
) {
  const result =
    await Checkout.open({
      key: order.keyId,
      amount: String(
        order.amount,
      ),
      currency:
        order.currency,
      name:
        "West Bengal Forum for Mental Health",
      description:
        order.description,
      order_id:
        order.orderId,

      prefill: {
        name:
          order.prefill?.name || "",
        email:
          order.prefill?.email || "",
        contact:
          order.prefill?.contact || "",
      },

      notes: {
        payment_id:
          String(
            order.paymentId,
          ),
      },

      theme: {
        color: "#2f7d32",
      },
    });

  const response =
    result?.response ?? result;

  if (
    typeof response ===
    "string"
  ) {
    return JSON.parse(
      response,
    );
  }

  return response;
}
