import { STATUS_LABEL } from "../../config/constants.js";
import { formatDate, slotLabel } from "../../utils/date.js";
import { initials } from "../../utils/validators.js";
import "./AppointmentCard.css";

/** Decorated appointment card. `viewer` decides which counter-party is highlighted. */
export default function AppointmentCard({
  appointment: a,
  viewer = "patient",
  actions = null,
}) {
  const title = viewer === "doctor" ? a.patientName : a.doctorName;
  const subtitle = viewer === "doctor" ? a.patientEmail : a.doctorSpeciality;
  const { d, mon } = (() => {
    const dt = new Date(`${a.date}T00:00:00Z`);
    return {
      d: dt.getUTCDate(),
      mon: dt.toLocaleString("en-IN", { month: "short", timeZone: "UTC" }),
    };
  })();
  return (
    <article
      className={`appt-card appt-${a.status}`}
      data-testid={`appointment-${a.id}`}
    >
      <div className="appt-date" aria-hidden="true">
        <span className="appt-day">{d}</span>
        <span className="appt-mon">{mon}</span>
      </div>
      <div className="appt-main">
        <div className="appt-top">
          <span className="appt-avatar" aria-hidden="true">
            {initials(title)}
          </span>
          <div className="appt-who">
            <h3>{title}</h3>
            <span className="muted small">{subtitle}</span>
          </div>
          <span className={`badge badge-${a.status}`}>
            {STATUS_LABEL[a.status] || a.status}
          </span>
        </div>
        <ul className="appt-meta">
          <li>
            <span className="faint">Date</span> {formatDate(a.date)}
          </li>
          <li>
            <span className="faint">Time</span>{" "}
            {slotLabel(a.date, a.startTime, a.endTime)}
          </li>
          {viewer === "patient" &&
            a.bookedById !== a.patientId &&
            a.patientName && (
              <li>
                <span className="faint">Patient</span> {a.patientName}
              </li>
            )}
          {viewer === "patient" &&
            a.bookedById !== a.patientId &&
            a.bookedByName && (
              <li>
                <span className="faint">Booked by</span> {a.bookedByName}
              </li>
            )}
          {a.rescheduleCount > 0 && (
            <li>
              <span className="faint">Rescheduled</span> {a.rescheduleCount}{" "}
              time(s)
            </li>
          )}
          <li>
            <span className="faint">Ref</span> #{a.id}
          </li>
        </ul>
        {actions && <div className="appt-actions">{actions}</div>}
      </div>
    </article>
  );
}
