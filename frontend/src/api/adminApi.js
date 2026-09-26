import client, { unwrap } from "./client.js";

export const listDoctors = async () =>
  unwrap(
    await client.get("/admin/doctors", { loaderMessage: "Loading doctors..." }),
  );
export const getDoctor = async (id) =>
  unwrap(
    await client.get(`/admin/doctors/${id}`, {
      loaderMessage: "Loading doctor...",
    }),
  );
export const createDoctor = async (body) =>
  unwrap(
    await client.post("/admin/doctors", body, {
      loaderMessage: "Saving doctor...",
    }),
  );
export const updateDoctor = async (id, body) =>
  unwrap(
    await client.put(`/admin/doctors/${id}`, body, {
      loaderMessage: "Updating doctor...",
    }),
  );
export const setDoctorDisabled = async (id, disabled) =>
  unwrap(
    await client.patch(
      `/admin/doctors/${id}/status`,
      { disabled },
      {
        loaderMessage: disabled ? "Disabling doctor..." : "Enabling doctor...",
      },
    ),
  );
export const listPatients = async () =>
  unwrap(
    await client.get("/admin/patients", {
      loaderMessage: "Loading patients...",
    }),
  );
export const upcomingAppointments = async (patientId, doctorId) =>
  unwrap(
    await client.get("/admin/appointments/upcoming", {
      params: { patientId, doctorId },
      loaderMessage: "Finding upcoming appointments...",
    }),
  );
export const rescheduleSlots = async (appointmentId, date) =>
  unwrap(
    await client.get("/admin/slots", {
      params: { appointmentId, date },
      loaderMessage: "Loading available slots...",
    }),
  );
export const reschedule = async (id, date, startTime) =>
  unwrap(
    await client.put(
      `/admin/appointments/${id}/reschedule`,
      { date, startTime },
      { loaderMessage: "Rescheduling appointment..." },
    ),
  );
