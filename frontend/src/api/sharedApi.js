import httpClient, { unwrap } from './httpClient';

export const sharedApi = {
  prescriptionUrl: async (prescriptionId) => unwrap(await httpClient.get(`/prescriptions/${prescriptionId}/url`)),
  consultation: async (appointmentId) => unwrap(await httpClient.get(`/consultations/${appointmentId}`)),
  health: async () => unwrap(await httpClient.get('/health')),
};

export default sharedApi;
