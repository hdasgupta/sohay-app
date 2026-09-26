import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Pagination from "../../components/Pagination/Pagination.jsx";
import AppointmentCard from "../../components/AppointmentCard/AppointmentCard.jsx";
import { listAppointments } from "../../api/doctorApi.js";
import { downloadPdf } from "../patient/AppointmentListPage.jsx";
import { todayIso, formatDate } from "../../utils/date.js";
import "./DoctorAppointmentsPage.css";

/** Read only list of the doctor's appointments (latest first). */
export default function DoctorAppointmentsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  useEffect(() => {
    listAppointments()
      .then(({ data }) => setItems(data))
      .catch(() => setItems([]));
  }, []);
  const today = todayIso();

  const actions = (a) => {
    const list = [];
    if (a.isUpcoming && a.date === today)
      list.push(
        <button
          key="join"
          type="button"
          className="btn btn-accent btn-sm"
          onClick={() => navigate(`/meeting/${a.id}`)}
        >
          Start video consultation
        </button>,
      );
    if (a.status === "completed" && a.hasPrescription)
      list.push(
        <button
          key="pdf"
          type="button"
          className="btn btn-success btn-sm"
          onClick={() => downloadPdf(a)}
        >
          View prescription
        </button>,
      );
    return list.length ? list : null;
  };

  const counts = (items || []).reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="doc-appts">
      <div className="page-title">
        <div>
          <h1>My appointments</h1>
          <p>
            Latest first. Consultations are recorded automatically when you
            start the video call.
          </p>
        </div>
        <div className="row doc-appt-stats">
          {["scheduled", "rescheduled", "completed", "cancelled"].map((s) => (
            <span key={s} className={`badge badge-${s}`}>
              {s}: {counts[s] || 0}
            </span>
          ))}
        </div>
      </div>
      {items && (
        <Pagination
          items={items}
          itemProcessor={(a) => (
            <AppointmentCard
              appointment={a}
              viewer="doctor"
              actions={actions(a)}
            />
          )}
          searchText={(a) =>
            `${a.patientName} ${a.patientEmail} ${a.status} ${a.date} ${formatDate(a.date)} ${a.startTime} #${a.id}`
          }
          searchPlaceholder="Search patient, status or date"
          emptyMessage="No appointments yet"
        />
      )}
    </div>
  );
}
