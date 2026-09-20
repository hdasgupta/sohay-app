import { useEffect, useMemo, useState } from 'react';
import Card, { CardRow } from '../../components/Card/Card';
import DatePicker from '../../components/DatePicker/DatePicker';
import Dropdown from '../../components/Dropdown/Dropdown';
import { adminApi } from '../../api/adminApi';
import { useMessage } from '../../context/MessageContext';
import { STATUS_TONES } from '../../utils/constants';
import { addDaysISO, prettyDate, todayISO } from '../../utils/dateUtils';
import { formatSlot } from '../../utils/slotUtils';
import './RescheduleAppointmentPage.css';

const RescheduleAppointmentPage = () => {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patientId, setPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [appointment, setAppointment] = useState(null);
  const [searched, setSearched] = useState(false);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [startTime, setStartTime] = useState('');
  const messenger = useMessage();

  useEffect(() => {
    const load = async () => {
      try {
        const [patientList, doctorList] = await Promise.all([adminApi.patientOptions(), adminApi.doctorOptions()]);
        setPatients(patientList || []);
        setDoctors(doctorList || []);
      } catch (error) {
        console.error('[reschedule] could not load options', error.message);
      }
    };
    load();
  }, []);

  useEffect(() => {
    setAppointment(null);
    setSearched(false);
    setDate('');
    setSlots([]);
    setStartTime('');
    if (!patientId || !doctorId) return;

    const load = async () => {
      try {
        const result = await adminApi.upcomingAppointment({ patientId, doctorId });
        setAppointment(result.data || null);
        setSearched(true);
        if (!result.data) messenger.info(result.message || 'No upcoming appointment for this selection');
      } catch (error) {
        console.error('[reschedule] lookup failed', error.message);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, doctorId]);

  const loadSlots = async (nextDate) => {
    setDate(nextDate);
    setStartTime('');
    setSlots([]);
    if (!nextDate || !appointment) return;
    try {
      const data = await adminApi.slotsForReschedule({
        patientId,
        doctorId,
        date: nextDate,
        appointmentId: appointment.id,
      });
      setSlots(data || []);
      if (!data?.length) messenger.warning('The doctor has no free slot on the selected date');
    } catch (error) {
      console.error('[reschedule] could not load slots', error.message);
    }
  };

  const slotOptions = useMemo(
    () => (slots || []).map((slot) => ({ id: slot.startTime, name: formatSlot(slot.startTime, slot.endTime) })),
    [slots],
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!appointment) return messenger.warning('Select a patient and a doctor having an upcoming appointment');
    if (!date) return messenger.warning('Choose the new date');
    if (!startTime) return messenger.warning('Choose the new time slot');
    try {
      const result = await adminApi.reschedule(appointment.id, { date, startTime });
      messenger.success(result.message || 'Appointment rescheduled');
      setAppointment(result.data || null);
      setDate('');
      setSlots([]);
      setStartTime('');
    } catch (error) {
      console.error('[reschedule] failed', error.message);
    }
    return undefined;
  };

  return (
    <section className="page reschedule-page">
      <div className="page-head">
        <div>
          <div className="page-title">Reschedule appointment</div>
          <div className="page-subtitle">
            Pick a patient and a doctor to load the upcoming appointment, then move it to another free 30 minute slot.
          </div>
        </div>
      </div>

      <div className="surface">
        <div className="grid cols-2">
          <Dropdown
            label="Patient"
            required
            options={patients}
            value={patientId}
            placeholder="Choose patient"
            labelProcessor={(option) => `${option.name} (${option.email})`}
            onOptionSelected={(option) => setPatientId(option ? String(option.id) : '')}
          />
          <Dropdown
            label="Doctor"
            required
            options={doctors}
            value={doctorId}
            placeholder="Choose doctor"
            labelProcessor={(option) => `Dr. ${option.name} · ${option.speciality}`}
            onOptionSelected={(option) => setDoctorId(option ? String(option.id) : '')}
          />
        </div>

        {searched && !appointment ? (
          <div className="empty-state">No upcoming appointment is available for this patient and doctor.</div>
        ) : null}

        {appointment ? (
          <>
            <Card
              title={`Appointment #${appointment.id}`}
              subtitle={`Dr. ${appointment.doctorName} · ${appointment.speciality}`}
              badge={appointment.status}
              badgeTone={STATUS_TONES[appointment.status] || 'info'}
              accent
            >
              <CardRow label="Patient" value={appointment.patientName} />
              <CardRow label="Current date" value={prettyDate(appointment.date)} />
              <CardRow label="Current slot" value={formatSlot(appointment.startTime, appointment.endTime)} />
            </Card>

            <form className="reschedule-form" onSubmit={submit} noValidate>
              <div className="grid cols-2">
                <DatePicker
                  label="New date"
                  required
                  value={date}
                  startDate={todayISO()}
                  endDate={addDaysISO(180)}
                  onDateSelect={loadSlots}
                  placeholder="Choose the new date"
                />
                <Dropdown
                  label="New time slot"
                  required
                  options={slotOptions}
                  value={startTime}
                  placeholder={date ? 'Choose a free slot' : 'Choose the date first'}
                  disabled={!date || slotOptions.length === 0}
                  onOptionSelected={(option) => setStartTime(option?.id || '')}
                />
              </div>
              <div className="row end">
                <button type="submit" className="btn btn-primary">
                  Reschedule appointment
                </button>
              </div>
            </form>
          </>
        ) : null}
      </div>
    </section>
  );
};

export default RescheduleAppointmentPage;
