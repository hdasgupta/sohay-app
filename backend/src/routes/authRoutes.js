import { Router } from "express";
import {
  registerPatient,
  resetPassword,
} from "../controllers/authController.js";
const r = Router();
r.post("/patient/register", registerPatient);
r.post("/password/reset", resetPassword);
export default r;
