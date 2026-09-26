import client, { unwrap } from "./client.js";

export const listAppointments = async () =>
  unwrap(
    await client.get("/doctor/appointments", {
      loaderMessage: "Loading appointments...",
    }),
  );
export const todayAppointments = async () =>
  unwrap(
    await client.get("/doctor/appointments/today", {
      loaderMessage: "Loading today's patients...",
    }),
  );
export const searchMedicines = async (q) =>
  unwrap(
    await client.get("/doctor/medicines", {
      params: { q },
      loaderMessage: "Searching medicines...",
    }),
  );
export const profile = async () =>
  unwrap(
    await client.get("/doctor/profile", {
      loaderMessage: "Loading profile...",
    }),
  );
export const saveSignature = async (signature) =>
  unwrap(
    await client.put(
      "/doctor/signature",
      { signature },
      { loaderMessage: "Saving signature..." },
    ),
  );
export const createPrescription = async (body) =>
  unwrap(
    await client.post("/doctor/prescriptions", body, {
      loaderMessage: "Generating prescription PDF...",
    }),
  );
