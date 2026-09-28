import express, {
  Router,
} from "express";
import h from "../utils/asyncHandler.js";
import * as c from "../controllers/webhook.controller.js";
import * as paymentController from "../controllers/payment.controller.js";

const r = Router();

r.post(
  "/jaas",
  express.raw({
    type: "*/*",
    limit: "1mb",
  }),
  h(c.jaasWebhook),
);

r.post(
  "/razorpay",
  express.raw({
    type: "application/json",
    limit: "1mb",
  }),
  h(paymentController.razorpayWebhook),
);

export default r;
