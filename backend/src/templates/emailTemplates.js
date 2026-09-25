/** Well organised HTML email templates (inline CSS for mail clients). */
import { ORGANISATION_NAME } from '../config/constants.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function layout(title, bodyHtml) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head>
<body style="margin:0;background:#0b1530;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1530;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
        <tr><td style="background:linear-gradient(135deg,#1e3a8a,#0ea5e9);padding:24px 28px;color:#ffffff">
          <div style="font-size:13px;letter-spacing:2px;text-transform:uppercase;opacity:.85">${ORGANISATION_NAME}</div>
          <div style="font-size:22px;font-weight:700;margin-top:6px">${esc(title)}</div>
        </td></tr>
        <tr><td style="padding:28px">${bodyHtml}</td></tr>
        <tr><td style="background:#f1f5f9;padding:16px 28px;font-size:12px;color:#64748b">
          This is an automated message from ${ORGANISATION_NAME}. Please do not reply to this email.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const row = (k, v) => `<tr><td style="padding:8px 0;color:#64748b;width:38%">${esc(k)}</td><td style="padding:8px 0;font-weight:600">${esc(v)}</td></tr>`;
const button = (href, label) => `<a href="${esc(href)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">${esc(label)}</a>`;

export function otpEmail({ otp, purposeLabel, validityMinutes }) {
  const digits = String(otp).split('').map((d) => `<span style="display:inline-block;width:46px;height:58px;line-height:58px;margin:0 4px;border-radius:10px;background:#eff6ff;border:2px solid #2563eb;font-size:34px;font-weight:800;color:#1e3a8a;font-family:Consolas,Menlo,monospace">${esc(d)}</span>`).join('');
  return {
    subject: `${otp} is your verification code - ${ORGANISATION_NAME}`,
    html: layout('Email verification code', `
      <p style="font-size:15px;margin:0 0 12px">Hello,</p>
      <p style="font-size:15px;margin:0 0 20px">Use the one time password below to ${esc(purposeLabel)}.</p>
      <div style="text-align:center;margin:26px 0">${digits}</div>
      <p style="font-size:15px;text-align:center;margin:0 0 20px;color:#b91c1c;font-weight:600">This code is valid for ${validityMinutes} minutes.</p>
      <p style="font-size:13px;color:#64748b;margin:0">If you did not request this code you can safely ignore this email. Never share this code with anyone.</p>`),
  };
}

export function appointmentBookedEmail({ patientName, doctorName, speciality, dateLabel, timeLabel, meetingUrl, bookedByName }) {
  return {
    subject: `Appointment confirmed with ${doctorName} on ${dateLabel}`,
    html: layout('Your appointment is confirmed', `
      <p style="font-size:15px">Dear ${esc(patientName)},</p>
      <p style="font-size:15px">Your video consultation has been booked${bookedByName ? ` by ${esc(bookedByName)}` : ''}.</p>
      <table role="presentation" width="100%" style="font-size:14px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:16px 0">
        ${row('Doctor', doctorName)}${row('Speciality', speciality)}${row('Date', dateLabel)}${row('Time (IST)', timeLabel)}
      </table>
      <p style="text-align:center;margin:26px 0">${button(meetingUrl, 'Join video consultation')}</p>
      <p style="font-size:13px;color:#64748b">The link opens inside the application. Please login with your account to join. Link: <a href="${esc(meetingUrl)}">${esc(meetingUrl)}</a></p>`),
  };
}

export function appointmentRescheduledEmail({ patientName, doctorName, oldLabel, newDateLabel, newTimeLabel, meetingUrl }) {
  return {
    subject: `Appointment rescheduled to ${newDateLabel} ${newTimeLabel}`,
    html: layout('Your appointment was rescheduled', `
      <p style="font-size:15px">Dear ${esc(patientName)},</p>
      <p style="font-size:15px">Your appointment with <b>${esc(doctorName)}</b> has been rescheduled by the administrator.</p>
      <table role="presentation" width="100%" style="font-size:14px;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;margin:16px 0">
        ${row('Previous slot', oldLabel)}${row('New date', newDateLabel)}${row('New time (IST)', newTimeLabel)}
      </table>
      <p style="text-align:center;margin:26px 0">${button(meetingUrl, 'Join video consultation')}</p>`),
  };
}

export function appointmentCancelledEmail({ patientName, doctorName, dateLabel, timeLabel }) {
  return {
    subject: `Appointment cancelled - ${dateLabel} ${timeLabel}`,
    html: layout('Appointment cancelled', `
      <p style="font-size:15px">Dear ${esc(patientName)},</p>
      <p style="font-size:15px">Your appointment with <b>${esc(doctorName)}</b> on <b>${esc(dateLabel)}</b> at <b>${esc(timeLabel)}</b> (IST) has been cancelled.</p>`),
  };
}

export function familyInvitationEmail({ inviteeName, inviterName, familyName, appUrl }) {
  return {
    subject: `${inviterName} invited you to join the family "${familyName}"`,
    html: layout('Family invitation', `
      <p style="font-size:15px">Hello ${esc(inviteeName)},</p>
      <p style="font-size:15px"><b>${esc(inviterName)}</b> has invited you to join the family <b>${esc(familyName)}</b>. Family members can book appointments for each other.</p>
      <p style="text-align:center;margin:26px 0">${button(appUrl, 'Review invitation')}</p>`),
  };
}

export function familyResponseEmail({ inviterName, inviteeName, familyName, accepted }) {
  return {
    subject: `${inviteeName} ${accepted ? 'accepted' : 'declined'} your family invitation`,
    html: layout(`Invitation ${accepted ? 'accepted' : 'declined'}`, `
      <p style="font-size:15px">Hello ${esc(inviterName)},</p>
      <p style="font-size:15px"><b>${esc(inviteeName)}</b> has <b style="color:${accepted ? '#15803d' : '#b91c1c'}">${accepted ? 'accepted' : 'declined'}</b> your invitation to the family <b>${esc(familyName)}</b>.</p>`),
  };
}
