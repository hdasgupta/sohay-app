import { toISODate } from '../utils/dates.js';

export const toFamilyMember = (row) => ({
  id: Number(row.id),
  name: row.name,
  email: row.email,
  sex: row.sex,
  dateOfBirth: row.date_of_birth ? toISODate(row.date_of_birth) : null,
});

export const toInvitation = (row) => ({
  id: Number(row.id),
  status: row.status,
  createdAt: row.created_at,
  respondedAt: row.responded_at || null,
  familyId: row.family_id ? Number(row.family_id) : undefined,
  familyName: row.family_name,
  inviterName: row.inviter_name,
  inviterEmail: row.inviter_email,
  inviteeName: row.invitee_name,
  inviteeEmail: row.invitee_email,
});
