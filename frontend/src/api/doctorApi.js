import httpClient, { unwrap, unwrapFull } from './httpClient';

export const doctorApi = {
  appointments: async () => unwrap(await httpClient.get('/doctor/appointments')),
  todayPatients: async () => unwrap(await httpClient.get('/doctor/today-patients')),
  searchMedicines: async (term) => unwrap(await httpClient.get('/doctor/medicines', { params: { term } })),
  generatePrescription: async (payload) => unwrapFull(await httpClient.post('/doctor/prescriptions', payload)),
};

export default doctorApi;
