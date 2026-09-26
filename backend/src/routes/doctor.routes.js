import { Router } from "express";
import h from "../utils/asyncHandler.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { ROLES } from "../config/constants.js";
import * as c from "../controllers/doctor.controller.js";

const r = Router();
r.use(authenticate, authorize(ROLES.DOCTOR));
r.get("/appointments", h(c.listAppointments));
r.get("/appointments/today", h(c.todayAppointments));
r.get("/medicines", h(c.searchMedicines));
r.get("/profile", h(c.profile));
r.put("/signature", h(c.saveSignature));
r.post("/prescriptions", h(c.createPrescription));
export default r;
