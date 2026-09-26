import client, { unwrap } from "./client.js";
import { Capacitor } from "@capacitor/core";

export const getCaptcha = async () =>
  unwrap(await client.get("/captcha", { loaderMessage: "Loading captcha..." }));
export const login = async (body) =>
  unwrap(
    await client.post("/auth/login", body, {
      loaderMessage: "Signing you in...",
    }),
  );
export const me = async () => unwrap(await client.get("/auth/me"));
export const sendOtp = async (email, purpose) =>
  unwrap(
    await client.post(
      "/auth/otp/send",
      { email, purpose },
      { loaderMessage: "Sending OTP to your email..." },
    ),
  );
export const verifyOtp = async (email, purpose, otp) =>
  unwrap(
    await client.post(
      "/auth/otp/verify",
      { email, purpose, otp },
      { loaderMessage: "Verifying OTP..." },
    ),
  );
export const registerPatient = async (body) =>
  unwrap(
    await client.post("/auth/register", body, {
      loaderMessage: "Creating your account...",
    }),
  );
export const resetPassword = async (body) =>
  unwrap(
    await client.post("/auth/reset-password", body, {
      loaderMessage: "Resetting password...",
    }),
  );
export const meetingToken = async (appointmentId) =>
  unwrap(
    await client.get(`/meetings/${appointmentId}/token`, {
      loaderMessage: "Preparing your consultation room...",
    }),
  );
export async function downloadPrescription(appointmentId) {
  const res = await client.get(`/prescriptions/${appointmentId}/download`, {
    responseType: "blob",
    loaderMessage: "Downloading prescription...",
  });
  return res.data;
}
const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      // Strips the 'data:application/pdf;base64,' prefix for Capacitor
      const base64String = reader.result.split(",")[1];
      resolve(base64String);
    };
    reader.readAsDataURL(blob);
  });
};
