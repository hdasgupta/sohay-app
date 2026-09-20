import { queryOne } from '../config/db.js';
import { SELECT_APPOINTMENT_BY_ID, SELECT_APPOINTMENT_BY_ROOM, INSERT_APPOINTMENT_RECORDING } from '../scripts/appointment.sql.js';
import { forbidden, notFound } from '../utils/httpError.js';
import { TIME_FORMAT } from '../utils/slots.js';
import { resolveMeeting } from '../utils/jitsi.js';
import { uploadRecordingToDrive } from '../utils/drive.js';
import { env } from '../config/env.js';
import { toISODate } from '../utils/dates.js';

/**
 * Everything the frontend needs to mount the 8x8.vc iframe.
 * The doctor is the moderator and therefore gets recording rights, which the
 * frontend uses to call executeCommand('startRecording') automatically.
 */
export const getConsultationContext = async ({ appointmentId, user }) => {
  const appointment = await queryOne(SELECT_APPOINTMENT_BY_ID, [TIME_FORMAT, appointmentId]);
  if (!appointment) throw notFound('Appointment not found');

  const isDoctor = Number(appointment.doctor_id) === Number(user.id);
  const isPatient =
    Number(appointment.patient_id) === Number(user.id) || Number(appointment.booked_by_id) === Number(user.id);
  if (!isDoctor && !isPatient && user.role !== 'ADMIN') {
    throw forbidden('You are not a participant of this consultation');
  }

  const meeting = resolveMeeting({ roomId: appointment.room_id, user, isModerator: isDoctor });
  console.log(
    `[video] consultation context for appointment ${appointmentId} (doctor=${isDoctor}, provider=${
      meeting.jaas ? 'jaas-8x8' : 'public-jitsi'
    })`,
  );

  return {
    appointmentId: Number(appointment.id),
    domain: meeting.domain,
    roomName: meeting.roomName,
    roomId: appointment.room_id,
    jwt: meeting.jwt,
    jaas: meeting.jaas,
    notice: meeting.notice,
    isModerator: isDoctor,
    autoRecord: isDoctor && meeting.canRecord,
    displayName: user.name,
    email: user.email,
    doctorName: appointment.doctor_name,
    patientName: appointment.patient_name,
    date: toISODate(appointment.appointment_date),
    startTime: appointment.start_time,
    endTime: appointment.end_time,
    status: appointment.status,
  };
};

/**
 * Called by the JaaS webhook (RECORDING_UPLOADED) or by our own frontend when a
 * recording finishes. Pushes the file into the configured Google Drive account.
 */
export const handleRecordingReady = async ({ roomId, recordingUrl, secret }) => {
  if (env.jitsi.webhookSecret && secret !== env.jitsi.webhookSecret) {
    throw forbidden('Invalid webhook secret');
  }
  const plainRoom = String(roomId || '').split('/').pop();
  const appointment = await queryOne(SELECT_APPOINTMENT_BY_ROOM, [plainRoom]);
  if (!appointment) throw notFound(`No appointment matches room ${plainRoom}`);

  const fileName = `wbffmh-consultation-${appointment.id}-${toISODate(appointment.appointment_date)}.mp4`;
  const result = await uploadRecordingToDrive({ url: recordingUrl, fileName });

  await queryOne(INSERT_APPOINTMENT_RECORDING, [
    appointment.id,
    plainRoom,
    recordingUrl,
    result.fileId || null,
    result.link || null,
    result.uploaded ? 'UPLOADED' : 'FAILED',
    result.uploaded ? null : result.reason,
  ]);

  console.log(`[video] recording for appointment ${appointment.id} uploaded=${result.uploaded}`);
  return result;
};
