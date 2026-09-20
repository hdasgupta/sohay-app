import { Router } from "express";
import { authenticate, allowRoles } from "../middleware/auth.js";
import {
  appointments,
  today,
  medicines,
  generate,
  details,
  download,
} from "../controllers/doctorController.js";
import { recording } from "../controllers/videoController.js";
const r = Router();
r.use(authenticate, allowRoles("doctor"));
r.get("/appointments", appointments);
r.get("/today-patients", today);
r.get("/medicines", medicines);
r.post("/prescriptions", generate);
r.get("/prescriptions/:id", details);
r.get("/prescriptions/:id/download", download);
r.post("/recordings", recording);
export default r;
