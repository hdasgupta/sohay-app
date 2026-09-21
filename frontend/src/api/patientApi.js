import httpClient, { unwrap, unwrapFull } from './httpClient';

export const patientApi = {
  family: async () => unwrap(await httpClient.get('/patient/family')),
  createFamily: async (name) => unwrapFull(await httpClient.post('/patient/family', { name })),
  invitable: async (search) =>
    unwrap(await httpClient.get('/patient/family/invitable', { params: { search: search || undefined } })),
  invite: async (inviteeId) => unwrapFull(await httpClient.post('/patient/family/invite', { inviteeId })),
  respondInvitation: async (invitationId, accept) =>
    unwrapFull(await httpClient.patch(`/patient/family/invitations/${invitationId}`, { accept })),
  doctors: async () => unwrap(await httpClient.get('/patient/doctors')),
  bookableMembers: async () => unwrap(await httpClient.get('/patient/bookable-members')),
  slots: async (params) => unwrap(await httpClient.get('/patient/slots', { params })),
  book: async (payload) => unwrapFull(await httpClient.post('/patient/appointments', payload)),
  appointments: async () => unwrap(await httpClient.get('/patient/appointments')),
  cancel: async (appointmentId) => unwrapFull(await httpClient.patch(`/patient/appointments/${appointmentId}/cancel`)),
};

export default patientApi;
