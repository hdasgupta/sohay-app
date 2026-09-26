import { Router } from "express";
import commonRoutes from "./common.routes.js";
import adminRoutes from "./admin.routes.js";
import patientRoutes from "./patient.routes.js";
import doctorRoutes from "./doctor.routes.js";

const api = Router();
api.use("/", commonRoutes);
api.use("/admin", adminRoutes);
api.use("/patient", patientRoutes);
api.use("/doctor", doctorRoutes);
export default api;
