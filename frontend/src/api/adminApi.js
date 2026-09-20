import httpClient, { unwrap, unwrapFull } from './httpClient';

export const adminApi = {
  slotCatalog: async () => unwrap(await httpClient.get('/admin/slot-catalog')),
  createDoctor: async (payload) => unwrapFull(await httpClient.post('/admin/doctors', payload)),
  updateDoctor: async (doctorId, payload) => unwrapFull(await httpClient.put(`/admin/doctors/${doctorId}`, payload)),
  listDoctors: async (search) => unwrap(await httpClient.get('/admin/doctors', { params: { search: search || undefined } })),
  getDoctor: async (doctorId) => unwrap(await httpClient.get(`/admin/doctors/${doctorId}`)),
  setDisabled: async (doctorId, disabled) =>
    unwrapFull(await httpClient.patch(`/admin/doctors/${doctorId}/disabled`, { disabled })),
  doctorOptions: async () => unwrap(await httpClient.get('/admin/doctors/options')),
  patientOptions: async () => unwrap(await httpClient.get('/admin/patients/options')),
  upcomingAppointment: async (params) => unwrapFull(await httpClient.get('/admin/appointments/upcoming', { params })),
  slotsForReschedule: async (params) => unwrap(await httpClient.get('/admin/appointments/slots', { params })),
  reschedule: async (appointmentId, payload) =>
    unwrapFull(await httpClient.patch(`/admin/appointments/${appointmentId}/reschedule`, payload)),
};

export default adminApi;
