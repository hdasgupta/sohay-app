import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../../api/client";
import { useApp } from "../../context/AppContext";
import Pagination from "../../components/Pagination";
import "./Patient.css";
export default function PatientAppointments() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);
  const { notify } = useApp();
  const load = () =>
    api
      .get("/patient/appointments")
      .then((r) => setItems(r.data.items))
      .catch((e) => notify("error", getErrorMessage(e)));
  useEffect(load, []);
  const cancel = async (id) => {
    try {
      await api.patch(`/patient/appointments/${id}/cancel`);
      notify("success", "Appointment cancelled.");
      load();
    } catch (e) {
      notify("error", getErrorMessage(e));
    }
  };
  const download = async (id) => {
    try {
      const r = await api.get(`/patient/prescriptions/${id}/download`);
      window.open(r.data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      notify("error", getErrorMessage(e));
    }
  };
  return (
    <div>
      <h1>Appointment List</h1>
      <div className="muted">Descending by date and time.</div>
      <Pagination
        items={items}
        page={page}
        setPage={setPage}
        perPage={perPage}
        setPerPage={setPerPage}
      />
      <div className="cards">
        {items.slice((page - 1) * perPage, page * perPage).map((a) => (
          <div className="card" key={a.id}>
            <h3>{a.doctor_name}</h3>
            <div>{a.speciality}</div>
            <div>
              <b>{String(a.appointment_date).slice(0, 10)}</b> ·{" "}
              {String(a.start_time).slice(0, 5)}
            </div>
            <div>For: {a.beneficiary_name}</div>
            <div>Status: {a.status}</div>
            <div className="inline-actions">
              {["scheduled", "rescheduled"].includes(a.status) && (
                <button className="btn secondary" onClick={() => cancel(a.id)}>
                  Cancel
                </button>
              )}
              {a.status === "completed" && a.prescription_id && (
                <button
                  className="btn"
                  onClick={() => download(a.prescription_id)}
                >
                  Download prescription
                </button>
              )}
              {["scheduled", "rescheduled"].includes(a.status) && (
                <a
                  className="btn secondary video-link"
                  href={`/video/${a.room_id}`}
                >
                  Open video
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      <Pagination
        items={items}
        page={page}
        setPage={setPage}
        perPage={perPage}
        setPerPage={setPerPage}
      />
    </div>
  );
}
