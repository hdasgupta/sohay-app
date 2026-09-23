import client, { unwrap } from './client.js';

export const listDoctors = async () => unwrap(await client.get('/patient/doctors', { loaderMessage: 'Loading doctors...' }));
export const members = async () => unwrap(await client.get('/patient/members', { loaderMessage: 'Loading family members...' }));
export const slots = async (doctorId, date, patientId) => unwrap(await client.get('/patient/slots', { params: { doctorId, date, patientId }, loaderMessage: 'Checking doctor availability...' }));
export const book = async (body) => unwrap(await client.post('/patient/appointments', body, { loaderMessage: 'Booking your appointment...' }));
export const listAppointments = async () => unwrap(await client.get('/patient/appointments', { loaderMessage: 'Loading appointments...' }));
export const cancelAppointment = async (id) => unwrap(await client.patch(`/patient/appointments/${id}/cancel`, {}, { loaderMessage: 'Cancelling appointment...' }));
export const getFamily = async () => unwrap(await client.get('/patient/family', { loaderMessage: 'Loading family...' }));
export const createFamily = async (name) => unwrap(await client.post('/patient/family', { name }, { loaderMessage: 'Creating family...' }));
export const invite = async (email) => unwrap(await client.post('/patient/family/invitations', { email }, { loaderMessage: 'Sending invitation...' }));
export const respond = async (id, action) => unwrap(await client.post(`/patient/family/invitations/${id}/respond`, { action }, { loaderMessage: action === 'accept' ? 'Joining family...' : 'Rejecting invitation...' }));
export const withdrawInvitation = async (id) => unwrap(await client.delete(`/patient/family/invitations/${id}`, { loaderMessage: 'Withdrawing invitation...' }));
export const leaveFamily = async () => unwrap(await client.post('/patient/family/leave', {}, { loaderMessage: 'Leaving family...' }));
