import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
  console.log(`[mail] transporter ready for ${env.smtp.user}`);
  return transporter;
};

export const sendMail = async ({ to, subject, html, text }) => {
  try {
    const info = await getTransporter().sendMail({
      from: `"${env.smtp.fromName}" <${env.smtp.from}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]+>/g, ' '),
    });
    console.log(`[mail] sent "${subject}" to ${to} (${info.messageId})`);
    return info;
  } catch (error) {
    // Email problems must never break the main flow, they are logged loudly.
    console.error(`[mail] FAILED to send "${subject}" to ${to}: ${error.message}`);
    return null;
  }
};

/* --------------------------------------------------------------- templates */

const shell = (title, body) => `
<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#eef3fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f1f37;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(15,31,55,.12);">
      <tr>
        <td style="background:linear-gradient(135deg,#0b1b33,#1b4f9c);padding:22px 28px;color:#ffffff;">
          <div style="font-size:19px;font-weight:700;letter-spacing:.3px;">${env.org.name}</div>
          <div style="font-size:13px;opacity:.85;margin-top:4px;">${title}</div>
        </td>
      </tr>
      <tr><td style="padding:28px;">${body}</td></tr>
      <tr>
        <td style="padding:18px 28px;background:#f4f7fc;font-size:12px;color:#5a6b85;">
          This is an automated message from ${env.org.name}. Please do not reply to this email.
        </td>
      </tr>
    </table>
  </body>
</html>`;

export const otpEmail = ({ code, minutes, purpose }) =>
  shell(
    purpose === 'RESET_PASSWORD' ? 'Password reset verification' : 'Email verification',
    `
    <p style="margin:0 0 14px;font-size:15px;">Use the one time password below to continue.</p>
    <div style="margin:22px 0;text-align:center;">
      <div style="display:inline-block;padding:18px 34px;border-radius:12px;background:#0b1b33;color:#7fd3ff;
                  font-size:42px;letter-spacing:12px;font-weight:700;font-family:Consolas,monospace;">${code}</div>
    </div>
    <p style="margin:0 0 8px;font-size:14px;"><strong>This OTP is valid for ${minutes} minutes.</strong></p>
    <p style="margin:0;font-size:13px;color:#5a6b85;">If you did not request this code, you can safely ignore this email.</p>`,
  );

export const appointmentBookedEmail = ({
  patientName,
  doctorName,
  speciality,
  date,
  startTime,
  endTime,
  joinUrl,
  meetingUrl,
  bookedByName,
}) =>
  shell(
    'Appointment confirmed',
    `
    <p style="margin:0 0 14px;font-size:15px;">Hello ${patientName}, your appointment is confirmed.</p>
    <table cellpadding="8" cellspacing="0" style="width:100%;font-size:14px;border-collapse:collapse;">
      <tr><td style="color:#5a6b85;">Doctor</td><td><strong>${doctorName}</strong> (${speciality})</td></tr>
      <tr><td style="color:#5a6b85;">Date</td><td><strong>${date}</strong></td></tr>
      <tr><td style="color:#5a6b85;">Time</td><td><strong>${startTime} - ${endTime}</strong></td></tr>
      <tr><td style="color:#5a6b85;">Booked by</td><td>${bookedByName}</td></tr>
    </table>
    <div style="margin:26px 0;text-align:center;">
      <a href="${joinUrl}" style="display:inline-block;background:#1b73e8;color:#fff;text-decoration:none;
         padding:14px 28px;border-radius:10px;font-weight:600;font-size:15px;">Join video consultation</a>
    </div>
    <p style="margin:0;font-size:13px;color:#5a6b85;">
      The consultation runs in a private video room reserved for this appointment.<br/>
      In-app link: <a href="${joinUrl}">${joinUrl}</a><br/>
      Video room link: <a href="${meetingUrl}">${meetingUrl}</a>
    </p>`,
  );

export const appointmentRescheduledEmail = ({
  patientName,
  doctorName,
  date,
  startTime,
  endTime,
  joinUrl,
  meetingUrl,
}) =>
  shell(
    'Appointment rescheduled',
    `
    <p style="margin:0 0 14px;font-size:15px;">Hello ${patientName}, your appointment with <strong>${doctorName}</strong> has been rescheduled.</p>
    <p style="margin:0 0 8px;font-size:15px;">New schedule: <strong>${date}, ${startTime} - ${endTime}</strong></p>
    <div style="margin:24px 0;text-align:center;">
      <a href="${joinUrl}" style="display:inline-block;background:#1b73e8;color:#fff;text-decoration:none;
         padding:13px 26px;border-radius:10px;font-weight:600;">Join video consultation</a>
    </div>
    <p style="margin:0;font-size:13px;color:#5a6b85;">
      In-app link: <a href="${joinUrl}">${joinUrl}</a><br/>
      Video room link: <a href="${meetingUrl}">${meetingUrl}</a>
    </p>`,
  );

export const appointmentCancelledEmail = ({ patientName, doctorName, date, startTime }) =>
  shell(
    'Appointment cancelled',
    `<p style="margin:0 0 10px;font-size:15px;">Hello ${patientName},</p>
     <p style="margin:0;font-size:15px;">Your appointment with <strong>${doctorName}</strong> on
     <strong>${date} at ${startTime}</strong> has been cancelled.</p>`,
  );

export const familyInviteEmail = ({ inviteeName, inviterName, familyName, appUrl }) =>
  shell(
    'Family invitation',
    `<p style="margin:0 0 12px;font-size:15px;">Hello ${inviteeName},</p>
     <p style="margin:0 0 16px;font-size:15px;"><strong>${inviterName}</strong> invited you to join the family
     <strong>${familyName}</strong>. Accepting lets family members book appointments for each other.</p>
     <div style="margin:24px 0;text-align:center;">
       <a href="${appUrl}" style="display:inline-block;background:#1b73e8;color:#fff;text-decoration:none;
          padding:13px 26px;border-radius:10px;font-weight:600;">Open Manage Family</a>
     </div>`,
  );

export const familyInviteResponseEmail = ({ inviterName, inviteeName, familyName, accepted }) =>
  shell(
    accepted ? 'Family invitation accepted' : 'Family invitation rejected',
    `<p style="margin:0 0 12px;font-size:15px;">Hello ${inviterName},</p>
     <p style="margin:0;font-size:15px;"><strong>${inviteeName}</strong> has
     <strong style="color:${accepted ? '#137a3f' : '#b3261e'};">${accepted ? 'accepted' : 'rejected'}</strong>
     your invitation to join <strong>${familyName}</strong>.</p>`,
  );

export const prescriptionEmail = ({ patientName, doctorName, date, pdfUrl }) =>
  shell(
    'Prescription available',
    `<p style="margin:0 0 12px;font-size:15px;">Hello ${patientName},</p>
     <p style="margin:0 0 16px;font-size:15px;">Your prescription from <strong>${doctorName}</strong> (${date}) is ready.</p>
     <div style="margin:24px 0;text-align:center;">
       <a href="${pdfUrl}" style="display:inline-block;background:#1b73e8;color:#fff;text-decoration:none;
          padding:13px 26px;border-radius:10px;font-weight:600;">Download prescription</a>
     </div>`,
  );

export const doctorAccountEmail = ({ doctorName, email, appUrl }) =>
  shell(
    'Doctor account created',
    `<p style="margin:0 0 12px;font-size:15px;">Hello Dr. ${doctorName},</p>
     <p style="margin:0 0 10px;font-size:15px;">An account has been created for you at ${env.org.name}.</p>
     <p style="margin:0 0 16px;font-size:15px;">Login email: <strong>${email}</strong></p>
     <div style="margin:22px 0;text-align:center;">
       <a href="${appUrl}" style="display:inline-block;background:#1b73e8;color:#fff;text-decoration:none;
          padding:13px 26px;border-radius:10px;font-weight:600;">Open application</a>
     </div>
     <p style="margin:0;font-size:13px;color:#5a6b85;">Your password was shared with you by the administrator.</p>`,
  );
