/** Data access for patient features */
import { query } from "../config/db.js";
import { PATIENT_SQL } from "../scripts/patient.sql.js";

const db = (client) => client || { query };

export const insertPatient = (
  client,
  { userId, sex, dateOfBirth, contactNumber },
) =>
  client.query(PATIENT_SQL.PATIENT_INSERT, [
    userId,
    sex,
    dateOfBirth,
    contactNumber,
  ]);
export const findPatientByEmail = async (email) =>
  (await query(PATIENT_SQL.PATIENT_BY_EMAIL, [email])).rows[0] || null;
export const listEnabledDoctors = async () =>
  (await query(PATIENT_SQL.ENABLED_DOCTORS, [false])).rows;

export const getFamily = async (id, client) =>
  (await db(client).query(PATIENT_SQL.FAMILY_BY_ID, [id])).rows[0] || null;
export const createFamily = async (client, name, createdBy) =>
  (await client.query(PATIENT_SQL.FAMILY_INSERT, [name, createdBy])).rows[0];
export const deleteFamily = (client, id) =>
  client.query(PATIENT_SQL.FAMILY_DELETE, [id]);
export const familyMembers = async (familyId, client) =>
  (await db(client).query(PATIENT_SQL.FAMILY_MEMBERS, [familyId])).rows;
export const familyMemberCount = async (client, familyId) =>
  (await client.query(PATIENT_SQL.FAMILY_MEMBER_COUNT, [familyId])).rows[0]
    .total;
export const setPatientFamily = (client, userId, familyId) =>
  client.query(PATIENT_SQL.PATIENT_SET_FAMILY, [userId, familyId]);
export const clearPatientFamily = (client, userId) =>
  client.query(PATIENT_SQL.PATIENT_CLEAR_FAMILY, [userId]);

export const insertInvitation = async ({
  familyId,
  inviterId,
  inviteeId,
  status,
}) =>
  (
    await query(PATIENT_SQL.INVITATION_INSERT, [
      familyId,
      inviterId,
      inviteeId,
      status,
    ])
  ).rows[0];
export const getInvitation = async (id, client) =>
  (await db(client).query(PATIENT_SQL.INVITATION_BY_ID, [id])).rows[0] || null;
export const sentInvitations = async (familyId, limit = 100) =>
  (await query(PATIENT_SQL.INVITATIONS_SENT, [familyId, limit])).rows;
export const receivedOpenInvitations = async (userId) =>
  (await query(PATIENT_SQL.INVITATIONS_RECEIVED_OPEN, [userId, true])).rows;
export const closeInvitation = async (client, id, status) =>
  (await db(client).query(PATIENT_SQL.INVITATION_CLOSE, [id, status, true]))
    .rows[0] || null;
export const closeOtherInvitations = (client, inviteeId, status, keepId) =>
  client.query(PATIENT_SQL.INVITATIONS_CLOSE_OTHERS_FOR_INVITEE, [
    inviteeId,
    status,
    true,
    keepId,
  ]);

export const insertAppointment = async ({
  patientId,
  doctorId,
  bookedBy,
  date,
  startTime,
  endTime,
  status,
}) =>
  (
    await query(PATIENT_SQL.APPOINTMENT_INSERT, [
      patientId,
      doctorId,
      bookedBy,
      date,
      startTime,
      endTime,
      status,
    ])
  ).rows[0];
export const appointmentsForPatient = async (userId) =>
  (await query(PATIENT_SQL.APPOINTMENTS_FOR_PATIENT, [userId])).rows;
export const cancelAppointment = async ({
  id,
  status,
  cancelledBy,
  allowedStatuses,
}) =>
  (
    await query(PATIENT_SQL.APPOINTMENT_CANCEL, [
      id,
      status,
      cancelledBy,
      allowedStatuses,
    ])
  ).rows[0] || null;
