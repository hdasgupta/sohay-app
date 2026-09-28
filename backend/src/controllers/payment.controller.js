import crypto from "node:crypto";
import env from "../config/env.js";
import { withTransaction } from "../config/db.js";
import AppError from "../utils/AppError.js";
import { ok, created } from "../utils/response.js";
import {
  requireFields,
  toId,
} from "../utils/validators.js";
import {
  normaliseTime,
} from "../utils/date.js";
import {
  APPOINTMENT_STATUS,
  ACTIVE_APPOINTMENT_STATUSES,
  PAYMENT_STATUS,
} from "../config/constants.js";
import {
  todayInKolkata,
  addDays,
  isValidIsoDate,
  isFutureSlot,
  formatDisplayDate,
  formatDisplayTime,
} from "../utils/date.js";
import {
  assertSlotBookable,
  getDoctorForBooking,
  slotEnd,
} from "../services/slot.service.js";
import { sendEmail } from "../services/email.service.js";
import { appointmentBookedEmail } from "../templates/emailTemplates.js";
import * as common from "../models/common.model.js";
import * as patientModel from "../models/patient.model.js";
import * as paymentModel from "../models/payment.model.js";
import {
  createOrder as createRazorpayOrder,
  fetchPayment,
  refundPayment,
} from "../services/razorpay.service.js";

const BOOKING_WINDOW_DAYS = 90;
const CURRENCY = "INR";

function verifyCheckoutSignature(orderId, paymentId, signature) {
  const digest = crypto
    .createHmac(
      "sha256",
      env.razorpay.keySecret,
    )
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(String(signature || ""), "utf8");

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

function verifyWebhookSignature(rawBody, signature) {
  const digest = crypto
    .createHmac(
      "sha256",
      env.razorpay.webhookSecret,
    )
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(String(signature || ""), "utf8");

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(a, b)
  );
}

async function assertCanBookFor(userId, patientId) {
  if (Number(userId) === Number(patientId)) {
    return;
  }

  const me = await common.getPatientProfile(userId);

  if (!me) {
    throw AppError.notFound("Patient profile not found");
  }

  if (!me.family_id) {
    throw AppError.forbidden(
      "You can book only for yourself or your family members",
    );
  }

  const members = await patientModel.familyMembers(
    me.family_id,
  );

  if (
    !members.some(
      (m) => Number(m.id) === Number(patientId),
    )
  ) {
    throw AppError.forbidden(
      "You can book only for yourself or your family members",
    );
  }
}

async function checkoutPayload(payment, doctor, patient) {
  return {
    paymentId: Number(payment.id),
    keyId: env.razorpay.keyId,
    orderId: payment.razorpay_order_id,
    amount: Number(payment.amount_paise),
    currency: payment.currency,
    expiresAt: payment.expires_at,
    description: `Mental health consultation with ${doctor.name}`,
    prefill: {
      name: patient.name,
      email: patient.email,
      contact: patient.contact_number,
    },
  };
}

export async function createPaymentOrder(req, res) {
  requireFields(req.body, [
    "doctorId",
    "date",
    "startTime",
  ]);

  if (!env.razorpay.appointmentFeePaise) {
    throw AppError.badRequest(
      "Online appointment payment is not configured",
    );
  }

  const doctorId = toId(
    req.body.doctorId,
    "doctor id",
  );

  const patientId = req.body.patientId
    ? toId(req.body.patientId, "patient id")
    : Number(req.user.id);

  const date = req.body.date;
  const startTime = normaliseTime(req.body.startTime);

  if (!isValidIsoDate(date)) {
    throw AppError.badRequest("Invalid date");
  }

  const today = todayInKolkata();
  const tomorrow = addDays(today, 1);

  if (
    date < tomorrow ||
    date >
      addDays(today, BOOKING_WINDOW_DAYS)
  ) {
    throw AppError.badRequest(
      `Appointments can be booked from tomorrow up to ${BOOKING_WINDOW_DAYS} days ahead`,
    );
  }

  await assertCanBookFor(
    req.user.id,
    patientId,
  );

  const patient =
    await common.getPatientProfile(patientId);

  if (!patient) {
    throw AppError.notFound("Patient profile not found");
  }

  const doctor =
    await getDoctorForBooking(doctorId);

  const existingAppointment =
    await patientModel.openAppointmentForPatientDoctor(
      patientId,
      doctorId,
    );

  if (existingAppointment) {
    throw AppError.conflict(
      "This patient already has an open appointment with this doctor. Please cancel or complete the existing appointment before booking another one.",
    );
  }

  await paymentModel.expireStaleHolds();

  const activeDoctorHold =
    await paymentModel.activeDoctorHold(
      doctorId,
      date,
      startTime,
    );

  if (activeDoctorHold) {
    if (
      Number(activeDoctorHold.booked_by) ===
        Number(req.user.id) &&
      Number(activeDoctorHold.patient_id) ===
        Number(patientId) &&
      activeDoctorHold.razorpay_order_id
    ) {
      return ok(
        res,
        await checkoutPayload(
          activeDoctorHold,
          doctor,
          patient,
        ),
        "Existing payment session returned",
      );
    }

    throw AppError.conflict(
      "This slot is currently being paid for. Please choose another slot.",
    );
  }

  await assertSlotBookable({
    doctorId,
    patientId,
    date,
    startTime,
  });

  const endTime = slotEnd(startTime);

  let payment;

  try {
    payment = await withTransaction(
      async (client) =>
        paymentModel.insertPayment(
          client,
          {
            patientId,
            doctorId,
            bookedBy: req.user.id,
            date,
            startTime,
            endTime,
            amountPaise:
              env.razorpay
                .appointmentFeePaise,
            currency: CURRENCY,
            status:
              PAYMENT_STATUS.CREATED,
            holdActive: true,
            holdMinutes:
              env.razorpay.holdMinutes,
          },
        ),
    );
  } catch (err) {
    if (err?.code === "23505") {
      throw AppError.conflict(
        "This slot is no longer available. Please choose another slot.",
      );
    }
    throw err;
  }

  try {
    const razorpayOrder =
      await createRazorpayOrder({
        amount:
          env.razorpay
            .appointmentFeePaise,
        currency: CURRENCY,
        receipt: `sohay_${payment.id}`,
        notes: {
          payment_id: String(
            payment.id,
          ),
          patient_id: String(
            patientId,
          ),
          doctor_id: String(
            doctorId,
          ),
        },
      });

    await withTransaction(
      async (client) =>
        paymentModel.attachRazorpayOrder(
          client,
          payment.id,
          razorpayOrder.id,
        ),
    );

    const saved = {
      ...payment,
      razorpay_order_id:
        razorpayOrder.id,
      amount_paise:
        env.razorpay
          .appointmentFeePaise,
      currency: CURRENCY,
    };

    return created(
      res,
      await checkoutPayload(
        saved,
        doctor,
        patient,
      ),
      "Payment order created",
    );
  } catch (err) {
    await paymentModel.markFailed(
      Number(payment.id),
      {
        paymentId: null,
        status:
          PAYMENT_STATUS.CANCELLED,
        holdActive: false,
        failureCode: "ORDER_CREATE_FAILED",
        failureDescription:
          err?.message ||
          "Unable to create Razorpay order",
      },
    );

    throw AppError.badRequest(
      "Unable to start online payment. Please try again.",
    );
  }
}

async function finalizeCapturedPayment(
  localPaymentId,
  razorpayPayment,
  checkoutSignature = null,
) {
  let result;

  try {
    result = await withTransaction(
      async (client) => {
        const payment =
          await paymentModel.byIdForUpdate(
            client,
            localPaymentId,
          );

        if (!payment) {
          throw AppError.notFound(
            "Payment order not found",
          );
        }

        if (
          payment.status ===
            PAYMENT_STATUS.CAPTURED &&
          payment.appointment_id
        ) {
          return {
            appointmentId:
              Number(payment.appointment_id),
            createdNow: false,
          };
        }

        if (
          payment.expires_at &&
          new Date(payment.expires_at) <
            new Date()
        ) {
          throw AppError.conflict(
            "The payment session expired before the appointment could be confirmed.",
          );
        }

        if (
          !isFutureSlot(
            payment.appointment_date,
            normaliseTime(
              payment.start_time,
            ),
          )
        ) {
          throw AppError.conflict(
            "The selected appointment time is no longer available.",
          );
        }

        const doctor =
          await getDoctorForBooking(
            Number(payment.doctor_id),
          );

        if (!doctor) {
          throw AppError.notFound(
            "Doctor not found",
          );
        }

        const existing =
          await patientModel.openAppointmentForPatientDoctor(
            Number(payment.patient_id),
            Number(payment.doctor_id),
            client,
          );

        if (existing) {
          throw AppError.conflict(
            "An open appointment already exists for this patient and doctor.",
          );
        }

        let appointmentRow;

        try {
          appointmentRow =
            await patientModel.insertAppointment(
              {
                patientId:
                  Number(
                    payment.patient_id,
                  ),
                doctorId:
                  Number(
                    payment.doctor_id,
                  ),
                bookedBy:
                  Number(
                    payment.booked_by,
                  ),
                date:
                  payment.appointment_date,
                startTime:
                  normaliseTime(
                    payment.start_time,
                  ),
                endTime:
                  normaliseTime(
                    payment.end_time,
                  ),
                status:
                  APPOINTMENT_STATUS.SCHEDULED,
              },
              client,
            );
        } catch (err) {
          if (err?.code === "23505") {
            throw AppError.conflict(
              "The selected slot was taken by another appointment.",
            );
          }
          throw err;
        }

        await paymentModel.markCaptured(
          client,
          {
            id: Number(
              payment.id,
            ),
            appointmentId:
              Number(
                appointmentRow.id,
              ),
            paymentId:
              razorpayPayment.id,
            signature:
              checkoutSignature,
            status:
              PAYMENT_STATUS.CAPTURED,
            holdActive: false,
          },
        );

        return {
          appointmentId:
            Number(
              appointmentRow.id,
            ),
          createdNow: true,
        };
      },
    );
  } catch (err) {
    const knownBookingFailure =
      err?.status === 409 ||
      err?.status === 400;

    if (!knownBookingFailure) {
      throw err;
    }

    try {
      await refundPayment(
        razorpayPayment.id,
        Number(
          razorpayPayment.amount,
        ),
      );

      await paymentModel.markRefunded(
        localPaymentId,
        PAYMENT_STATUS.REFUNDED,
        false,
      );
    } catch {
      // Payment was captured but refund could not be completed.
      // Leave it for support/retry handling.
    }

    throw AppError.conflict(
      "Payment was received, but the appointment slot was no longer available. The payment has been sent for refund.",
    );
  }

  const appointment =
    await common.getAppointmentById(
      result.appointmentId,
    );

  if (
    result.createdNow &&
    appointment
  ) {
    const mail =
      appointmentBookedEmail({
        patientName:
          appointment.patient_name,
        doctorName:
          appointment.doctor_name,
        speciality:
          appointment.doctor_speciality,
        dateLabel:
          formatDisplayDate(
            appointment.appointment_date,
          ),
        timeLabel:
          `${formatDisplayTime(appointment.start_time)} - ${formatDisplayTime(appointment.end_time)}`,
        meetingUrl:
          `${env.frontendUrl}/meeting/${appointment.id}`,
        bookedByName:
          Number(
            appointment.booked_by,
          ) !==
          Number(
            appointment.patient_id,
          )
            ? appointment.booked_by_name
            : null,
      });

    sendEmail({
      to: appointment.patient_email,
      ...mail,
    });

    if (
      Number(appointment.booked_by) !==
      Number(appointment.patient_id)
    ) {
      sendEmail({
        to: appointment.booked_by_email,
        ...mail,
      });
    }
  }

  return appointment;
}

export async function verifyPayment(
  req,
  res,
) {
  requireFields(req.body, [
    "orderId",
    "paymentId",
    "signature",
  ]);

  const local =
    await paymentModel.byOrderId(
      req.body.orderId,
    );

  if (!local) {
    throw AppError.notFound(
      "Payment order not found",
    );
  }

  if (
    Number(local.booked_by) !==
    Number(req.user.id)
  ) {
    throw AppError.forbidden(
      "You cannot verify this payment",
    );
  }

  if (
    local.status ===
      PAYMENT_STATUS.CAPTURED &&
    local.appointment_id
  ) {
    return ok(
      res,
      {
        appointment:
          await common.getAppointmentById(
            local.appointment_id,
          ),
      },
      "Appointment already confirmed",
    );
  }

  if (
    !verifyCheckoutSignature(
      local.razorpay_order_id,
      req.body.paymentId,
      req.body.signature,
    )
  ) {
    throw AppError.badRequest(
      "Invalid Razorpay payment signature",
    );
  }

  const payment =
    await fetchPayment(
      req.body.paymentId,
    );

  if (
    payment.order_id !==
    local.razorpay_order_id ||
    Number(payment.amount) !==
      Number(local.amount_paise) ||
    payment.currency !==
      local.currency ||
    payment.status !== "captured"
  ) {
    throw AppError.badRequest(
      "Razorpay payment could not be validated",
    );
  }

  const appointment =
    await finalizeCapturedPayment(
      Number(local.id),
      payment,
      req.body.signature,
    );

  ok(
    res,
    {
      appointment,
      payment: {
        id: payment.id,
        orderId:
          payment.order_id,
        amount:
          Number(payment.amount),
        currency:
          payment.currency,
        status:
          payment.status,
      },
    },
    "Payment successful and appointment confirmed",
  );
}

export async function razorpayWebhook(
  req,
  res,
) {
  const signature =
    req.get(
      "X-Razorpay-Signature",
    );

  if (
    !env.razorpay.webhookSecret ||
    !Buffer.isBuffer(req.body) ||
    !verifyWebhookSignature(
      req.body,
      signature,
    )
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Invalid Razorpay webhook signature",
    });
  }

  const payload = JSON.parse(
    req.body.toString("utf8"),
  );

  const eventType =
    payload.event || "unknown";

  const eventId =
    req.get(
      "X-Razorpay-Event-Id",
    );

  if (eventId) {
    const existing =
      await paymentModel.webhookByEventId(
        eventId,
      );

    if (
      existing?.processed
    ) {
      return res.json({
        success: true,
      });
    }

    if (!existing) {
      await paymentModel.insertWebhook(
        {
          eventId,
          eventType,
          payload,
        },
      );
    }
  }

  try {
    const entity =
      payload?.payload?.payment
        ?.entity;

    if (
      eventType ===
        "payment.captured" &&
      entity?.order_id
    ) {
      const local =
        await paymentModel.byOrderId(
          entity.order_id,
        );

      if (local) {
        await finalizeCapturedPayment(
          Number(local.id),
          entity,
          null,
        );
      }
    }

    if (
      eventType ===
        "payment.failed" &&
      entity?.order_id
    ) {
      const local =
        await paymentModel.byOrderId(
          entity.order_id,
        );

      if (local) {
        await paymentModel.markFailed(
          Number(local.id),
          {
            paymentId:
              entity.id,
            status:
              PAYMENT_STATUS.FAILED,
            holdActive: false,
            failureCode:
              entity.error_code,
            failureDescription:
              entity.error_description,
          },
        );
      }
    }

    if (eventId) {
      await paymentModel.markWebhookProcessed(
        eventId,
      );
    }

    return res.json({
      success: true,
    });
  } catch (err) {
    if (eventId) {
      await paymentModel.markWebhookFailed(
        eventId,
        err?.message ||
          "Webhook processing failed",
      );
    }

    throw err;
  }
}
