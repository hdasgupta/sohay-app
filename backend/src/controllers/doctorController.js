import { pool } from "../config/db.js";
import {
  doctorAppointments,
  todayPatients,
  todayAppointment,
  medicineCount,
  medicineSearch,
  createPrescription,
  createPrescriptionMedicine,
  prescription,
  prescriptionMedicines,
  prescriptionOwner,
  updatePrescriptionPdfUrl,
  completeAppointment,
} from "../../scripts/sql/doctorQueries.js";
import {
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
} from "../../scripts/sql/generalQueries.js";
import { buildPrescriptionPdf } from "../services/pdfService.js";
import { putPdf, signedPdfUrl } from "../services/s3Service.js";
import { allowedTiming, allowedFood } from "../utils/validation.js";
import path from "node:path";
function ageOf(dob) {
  const d = new Date(dob),
    n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  if (
    n.getMonth() < d.getMonth() ||
    (n.getMonth() === d.getMonth() && n.getDate() < d.getDate())
  )
    a--;
  return Math.max(a, 0);
}
export async function appointments(req, res) {
  const r = await pool.query(doctorAppointments, [req.user.sub]);
  res.json({ items: r.rows });
}
export async function today(req, res) {
  const r = await pool.query(todayPatients, [
    req.user.sub,
    "scheduled",
    "rescheduled",
  ]);
  res.json({
    items: r.rows.map((x) => ({ ...x, age: ageOf(x.date_of_birth) })),
  });
}
export async function medicines(req, res) {
  const r = await pool.query(medicineCount);
  if (!Number(r.rows[0].count)) return res.json({ items: [] });
  const q = `%${String(req.query.q || "").trim()}%`;
  const s = await pool.query(medicineSearch, [q, 25]);
  res.json({ items: s.rows });
}
export async function generate(req, res) {
  const b = req.body;
  const a = await pool.query(todayAppointment, [
    b.appointmentId,
    req.user.sub,
    "scheduled",
    "rescheduled",
    1,
  ]);
  if (!a.rowCount)
    return res.status(404).json({ message: "Today appointment not found." });
  if (!Array.isArray(b.medicines) || !b.medicines.length)
    return res.status(400).json({ message: "Add at least one medicine." });
  const age = Number(b.patientAge);
  if (!Number.isInteger(age) || age < 0)
    return res.status(400).json({ message: "Invalid patient age." });
  for (const m of b.medicines) {
    if (
      !String(m.medicineName || "").trim() ||
      !String(m.dose || "").trim() ||
      !Array.isArray(m.timing) ||
      !m.timing.length ||
      m.timing.some((x) => !allowedTiming.has(x)) ||
      !allowedFood.has(m.foodTiming)
    )
      return res
        .status(400)
        .json({ message: "Invalid prescription medicine data." });
  }
  const date = new Date().toISOString().slice(0, 10);
  const key = `prescriptions/${Date.now()}-${a.rows[0].id}.pdf`;
  const pdf = await buildPrescriptionPdf({
    doctorName: a.rows[0].doctor_name,
    speciality: a.rows[0].speciality,
    patientName: a.rows[0].beneficiary_name,
    age,
    date,
    medicines: b.medicines,
    logoPath: path.join(process.cwd(), "assets/logo.png"),
    signaturePath: path.join(process.cwd(), "assets/signature.png"),
  });
  await putPdf(key, pdf);
  const c = await pool.connect();
  try {
    await c.query(beginTransaction);
    const p = await c.query(createPrescription, [
      a.rows[0].id,
      req.user.sub,
      a.rows[0].beneficiary_patient_id,
      age,
      date,
      key,
      "pending",
    ]);
    for (let i = 0; i < b.medicines.length; i++) {
      const m = b.medicines[i];
      await c.query(createPrescriptionMedicine, [
        p.rows[0].id,
        m.medicineName.trim(),
        m.dose.trim(),
        String(m.instruction || "").trim(),
        m.timing,
        Boolean(m.sos),
        m.foodTiming,
        i + 1,
      ]);
    }
    const url = `/api/patient/prescriptions/${p.rows[0].id}/download`;
    await c.query(updatePrescriptionPdfUrl, [url, p.rows[0].id]);
    await c.query(completeAppointment, ["completed", a.rows[0].id]);
    await c.query(commitTransaction);
    console.log("[PRESCRIPTION] generated", p.rows[0].id);
    res
      .status(201)
      .json({
        message: "Prescription generated successfully.",
        prescriptionId: p.rows[0].id,
      });
  } catch (e) {
    await c.query(rollbackTransaction);
    throw e;
  } finally {
    c.release();
  }
}
export async function details(req, res) {
  const r = await pool.query(prescription, [req.params.id, 1]);
  if (!r.rowCount)
    return res.status(404).json({ message: "Prescription not found." });
  if (Number(r.rows[0].doctor_id) !== Number(req.user.sub))
    return res.status(403).json({ message: "Not allowed." });
  const m = await pool.query(prescriptionMedicines, [req.params.id]);
  res.json({ prescription: r.rows[0], medicines: m.rows });
}
export async function download(req, res) {
  const r = await pool.query(prescriptionOwner, [req.params.id, 1]);
  if (!r.rowCount)
    return res.status(404).json({ message: "Prescription not found." });
  const row = r.rows[0];
  if (Number(row.doctor_id) !== Number(req.user.sub))
    return res.status(403).json({ message: "Not allowed." });
  res.json({ url: await signedPdfUrl(row.pdf_key) });
}
