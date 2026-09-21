import httpClient, { unwrap, unwrapFull } from './httpClient';

export const authApi = {
  captcha: async () => unwrap(await httpClient.get('/auth/captcha')),
  login: async (payload) => unwrapFull(await httpClient.post('/auth/login', payload)),
  sendOtp: async (payload) => unwrapFull(await httpClient.post('/auth/otp', payload)),
  registerPatient: async (payload) => unwrapFull(await httpClient.post('/auth/register-patient', payload)),
  resetPassword: async (payload) => unwrapFull(await httpClient.post('/auth/reset-password', payload)),
  me: async () => unwrap(await httpClient.get('/auth/me')),
};

export default authApi;
