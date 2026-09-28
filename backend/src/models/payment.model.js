import { query } from "../config/db.js";
import { PAYMENT_SQL } from "../scripts/payment.sql.js";

const db = (client) => client || { query };

export const expireStaleHolds = async () =>
  (
    await query(PAYMENT_SQL.EXPIRE_STALE_HOLDS, [
      "expired",
      false,
      true,
      ["created", "attempted"],
    ])
  ).rows;

export const activeDoctorHold = async (
  doctorId,
  date,
  startTime,
) =>
  (
    await query(PAYMENT_SQL.ACTIVE_DOCTOR_HOLD, [
      doctorId,
      date,
      startTime,
      true,
      1,
    ])
  ).rows[0] || null;

export const activePatientDoctorHold = async (
  patientId,
  doctorId,
) =>
  (
    await query(PAYMENT_SQL.ACTIVE_PATIENT_DOCTOR_HOLD, [
      patientId,
      doctorId,
      true,
      1,
    ])
  ).rows[0] || null;

export const insertPayment = async (
  client,
  {
    patientId,
    doctorId,
    bookedBy,
    date,
    startTime,
    endTime,
    amountPaise,
    currency,
    status,
    holdActive,
    holdMinutes,
  },
) =>
  (
    await client.query(PAYMENT_SQL.INSERT_PAYMENT, [
      patientId,
      doctorId,
      bookedBy,
      date,
      startTime,
      endTime,
      amountPaise,
      currency,
      status,
      holdActive,
      holdMinutes,
    ])
  ).rows[0];

export const byOrderId = async (orderId) =>
  (
    await query(PAYMENT_SQL.BY_ORDER_ID, [orderId, 1])
  ).rows[0] || null;

export const byIdForUpdate = async (client, id) =>
  (
    await client.query(PAYMENT_SQL.BY_ID_FOR_UPDATE, [id])
  ).rows[0] || null;

export const attachRazorpayOrder = async (
  client,
  id,
  orderId,
) =>
  (
    await client.query(PAYMENT_SQL.UPDATE_RAZORPAY_ORDER, [
      id,
      orderId,
    ])
  ).rows[0];

export const markCaptured = async (
  client,
  {
    id,
    appointmentId,
    paymentId,
    signature,
    status,
    holdActive,
  },
) =>
  (
    await client.query(PAYMENT_SQL.MARK_CAPTURED, [
      id,
      appointmentId,
      paymentId,
      signature,
      status,
      holdActive,
    ])
  ).rows[0];

export const markFailed = async (
  id,
  { paymentId, status, holdActive, failureCode, failureDescription },
) =>
  (
    await query(PAYMENT_SQL.MARK_FAILED, [
      id,
      paymentId,
      status,
      holdActive,
      failureCode,
      failureDescription,
    ])
  ).rows[0];

export const markRefunded = async (
  id,
  status,
  holdActive,
) =>
  (
    await query(PAYMENT_SQL.MARK_REFUNDED, [
      id,
      status,
      holdActive,
    ])
  ).rows[0];

export const webhookByEventId = async (eventId) =>
  (
    await query(PAYMENT_SQL.WEBHOOK_BY_EVENT_ID, [
      eventId,
      1,
    ])
  ).rows[0] || null;

export const insertWebhook = async ({
  eventId,
  eventType,
  payload,
}) =>
  (
    await query(PAYMENT_SQL.WEBHOOK_INSERT, [
      eventId,
      eventType,
      JSON.stringify(payload),
    ])
  ).rows[0] || null;

export const markWebhookProcessed = async (eventId) =>
  query(PAYMENT_SQL.WEBHOOK_MARK_PROCESSED, [
    eventId,
    true,
  ]);

export const markWebhookFailed = async (
  eventId,
  message,
) =>
  query(PAYMENT_SQL.WEBHOOK_MARK_FAILED, [
    eventId,
    false,
    message,
  ]);
