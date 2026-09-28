import Razorpay from "razorpay";
import env from "../config/env.js";

let razorpayClient = null;

function client() {
  if (!env.razorpay.keyId || !env.razorpay.keySecret) {
    throw new Error("Razorpay keys are not configured");
  }

  if (!razorpayClient) {
    razorpayClient = new Razorpay({
      key_id: env.razorpay.keyId,
      key_secret: env.razorpay.keySecret,
    });
  }

  return razorpayClient;
}

export const createOrder = (payload) =>
  client().orders.create(payload);

export const fetchPayment = (paymentId) =>
  client().payments.fetch(paymentId);

export const refundPayment = (
  paymentId,
  amount,
) =>
  client().payments.refund(paymentId, {
    amount,
  });
