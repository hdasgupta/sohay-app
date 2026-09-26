import { useEffect, useMemo, useState } from "react";
import Dropdown from "../../components/Dropdown/Dropdown.jsx";
import DatePicker from "../../components/DatePicker/DatePicker.jsx";
import AppointmentCard from "../../components/AppointmentCard/AppointmentCard.jsx";
import {
  listDoctors,
  listPatients,
  upcomingAppointments,
  rescheduleSlots,
  reschedule,
} from "../../api/adminApi.js";
import { notify } from "../../utils/eventBus.js";
import {
  addDaysIso,
  formatTime,
  todayIso,
  slotLabel,
} from "../../utils/date.js";
import { BOOKING_WINDOW_DAYS } from "../../config/constants.js";
import "./ReschedulePage.css";

export default function ReschedulePage() {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patient, setPatient] = useState(null);
  const [doctor, setDoctor] = useState(null);
  const [appointments, setAppointments] = useState(null);
  const [appointment, setAppointment] = useState(null);
  const [date, setDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [slot, setSlot] = useState(null);

  useEffect(() => {
    listPatients()
      .then(({ data }) => setPatients(data))
      .catch(() => {});
    listDoctors()
      .then(({ data }) => setDoctors(data))
      .catch(() => {});
  }, []);

  const loadUpcoming = async (p, d) => {
    setAppointments(null);
    setAppointment(null);
    setDate(null);
    setSlots([]);
    setSlot(null);
    if (!p || !d) return;
    try {
      const { data } = await upcomingAppointments(p.id, d.id);
      setAppointments(data);
      if (data.length === 0)
        notify.info(`${p.name} has no upcoming appointment with ${d.name}`);
      else setAppointment(data[0]);
    } catch {
      setAppointments([]);
    }
  };

  const choosePatient = (p) => {
    setPatient(p);
    loadUpcoming(p, doctor);
  };
  const chooseDoctor = (d) => {
    setDoctor(d);
    loadUpcoming(patient, d);
  };

  const chooseDate = async (iso) => {
    setDate(iso);
    setSlot(null);
    setSlots([]);
    try {
      const { data } = await rescheduleSlots(appointment.id, iso);
      setSlots(data);
      if (data.length === 0)
        notify.warning("No free slot on this date. Please choose another date");
    } catch {
      /* shown */
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!appointment || !date || !slot) {
      notify.warning("Please choose the new date and slot");
      return;
    }
    try {
      const { message, data } = await reschedule(appointment.id, date, slot);
      notify.success(message || "Appointment rescheduled");
      setAppointments((list) => list.map((a) => (a.id === data.id ? data : a)));
      setAppointment(data);
      setDate(null);
      setSlots([]);
      setSlot(null);
    } catch {
      /* shown */
    }
  };

  const weekdays = useMemo(() => doctor?.weekdays || [], [doctor]);
  const today = todayIso();

  return (
    <div className="reschedule">
      <div className="page-title">
        <div>
          <h1>Reschedule appointment</h1>
          <p>
            Select the patient and doctor to find their upcoming appointment.
          </p>
        </div>
      </div>
      <div className="card rs-pickers">
        <Dropdown
          label="Patient"
          required
          options={patients}
          labelProcessor={(p) => `${p.name} (${p.email})`}
          selected={patient}
          onOptionSelected={choosePatient}
          placeholder={patients.length ? "Select patient" : "No patients yet"}
          id="rs-patient"
        />
        <Dropdown
          label="Doctor"
          required
          options={doctors}
          labelProcessor={(d) =>
            `${d.name} - ${d.speciality}${d.isDisabled ? " (disabled)" : ""}`
          }
          selected={doctor}
          onOptionSelected={chooseDoctor}
          placeholder={doctors.length ? "Select doctor" : "No doctors yet"}
          id="rs-doctor"
        />
      </div>

      {appointments && appointments.length === 0 && (
        <div className="empty-state rs-empty" role="status">
          <strong>No upcoming appointment</strong>
          {patient?.name} has no upcoming appointment with {doctor?.name}.
        </div>
      )}

      {appointments && appointments.length > 0 && (
        <div className="rs-body">
          <section className="stack">
            <h2>Upcoming appointment{appointments.length > 1 ? "s" : ""}</h2>
            {appointments.length > 1 && (
              <Dropdown
                label="Appointment to reschedule"
                options={appointments}
                labelProcessor={(a) =>
                  `#${a.id} · ${a.date} · ${formatTime(a.startTime)}`
                }
                selected={appointment}
                onOptionSelected={(a) => {
                  setAppointment(a);
                  setDate(null);
                  setSlots([]);
                  setSlot(null);
                }}
                id="rs-appt"
              />
            )}
            {appointment && (
              <AppointmentCard appointment={appointment} viewer="patient" />
            )}
          </section>
          {appointment && (
            <form className="card rs-form" onSubmit={submit} noValidate>
              <h2>New date & time</h2>
              <DatePicker
                label="New date"
                required
                startDate={today}
                endDate={addDaysIso(today, BOOKING_WINDOW_DAYS)}
                enabledWeekDays={weekdays}
                value={date}
                onDateSelect={chooseDate}
                id="rs-date"
                hint="Only the doctor's working days can be selected"
              />
              <Dropdown
                label="New 30 minute slot"
                required
                options={slots}
                keyProcessor={(s) => s}
                labelProcessor={(s) => slotLabel(date, s)}
                selected={slot}
                onOptionSelected={setSlot}
                placeholder={
                  date
                    ? slots.length
                      ? "Select slot"
                      : "No free slot"
                    : "Choose a date first"
                }
                disabled={!date || slots.length === 0}
                id="rs-slot"
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!slot}
              >
                Reschedule
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
