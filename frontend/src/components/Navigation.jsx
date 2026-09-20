import { NavLink } from "react-router-dom";
import "./Navigation.css";
const links = {
  admin: [
    ["/admin", "Add Doctor"],
    ["/admin/doctors", "Doctor List"],
    ["/admin/reschedule", "Reschedule Appointment"],
  ],
  patient: [
    ["/patient", "Book Appointment"],
    ["/patient/family", "Manage Family"],
    ["/patient/appointments", "Appointment List"],
  ],
  doctor: [
    ["/doctor", "Generate Prescription"],
    ["/doctor/appointments", "Appointment List"],
  ],
};
export default function Navigation({ role, open, onClose }) {
  return (
    <aside className={`navigation ${open ? "open" : ""}`}>
      <div className="nav-head">
        <b>Menu</b>
        <button onClick={onClose}>×</button>
      </div>
      {links[role]?.map(([path, label]) => (
        <NavLink
          key={path}
          to={path}
          end={
            path === "/" ||
            path === "/admin" ||
            path === "/patient" ||
            path === "/doctor"
          }
          onClick={onClose}
        >
          {label}
        </NavLink>
      ))}
    </aside>
  );
}
