import { Router } from "express";
import { authenticate, allowRoles } from "../middleware/auth.js";
import {
  families,
  createFamilyGroup,
  inviteFamilyMember,
  invitations,
  respondInvitation,
  availability,
  book,
  appointments,
  cancel,
  prescriptionDownload,
} from "../controllers/patientController.js";
const r = Router();
r.use(authenticate, allowRoles("patient"));
r.get("/families", families);
r.post("/families", createFamilyGroup);
r.post("/families/invite", inviteFamilyMember);
r.get("/families/invitations", invitations);
r.patch("/families/invitations/:id", respondInvitation);
r.get("/appointments/availability", availability);
r.post("/appointments", book);
r.get("/appointments", appointments);
r.patch("/appointments/:id/cancel", cancel);
r.get("/prescriptions/:id/download", prescriptionDownload);
export default r;
