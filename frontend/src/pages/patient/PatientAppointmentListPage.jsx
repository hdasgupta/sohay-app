import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card, { CardRow } from '../../components/Card/Card';
import Pagination from '../../components/Pagination/Pagination';
import { patientApi } from '../../api/patientApi';
import { sharedApi } from '../../api/sharedApi';
import { useMessage } from '../../context/MessageContext';
import { STATUS_TONES } from '../../utils/constants';
import { prettyDate, todayISO } from '../../utils/dateUtils';
import { formatSlot } from '../../utils/slotUtils';
import './PatientAppointmentListPage.css';

const ACTIVE = ['SCHEDULED', 'RESCHEDULED'];

const PatientAppointmentListPage = () => {
  const [appointments, setAppointments] = useState([]);
  const messenger = useMessage();
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      const data = await patientApi.appointments();
      setAppointments(data || []);
      console.log('[patient-appointments] loaded', data?.length);
    } catch (error) {
      console.error('[patient-appointments] could not load', error.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Latest appointment on the top.
  const sorted = useMemo(
    () =>
      [...appointments].sort(
        (a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime),
      ),
    [appointments],
  );

  const cancel = async (appointment) => {
    try {
      const result = await patientApi.cancel(appointment.id);
      messenger.success(result.message || 'Appointment cancelled');
      load();
    } catch (error) {
      console.error('[patient-appointments] cancel failed', error.message);
    }
  };

  const download = async (appointment) => {
    try {
      const data = await sharedApi.prescriptionUrl(appointment.prescriptionId);
      window.open(data.url, '_blank', 'noopener');
      messenger.success('Prescription opened in a new tab');
    } catch (error) {
      console.error('[patient-appointments] prescription download failed', error.message);
    }
  };

  const isUpcoming = (appointment) =>
    ACTIVE.includes(appointment.status) && appointment.date >= todayISO();

  const renderAppointment = (appointment) => (
    <Card
      key={appointment.id}
      title={`Dr. ${appointment.doctorName}`}
      subtitle={appointment.speciality}
      badge={appointment.status}
      badgeTone={STATUS_TONES[appointment.status] || 'info'}
      actions={
        <>
          {isUpcoming(appointment) ? (
            <>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => navigate(`/consultation/${appointment.id}`)}
              >
                Join video call
              </button>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => cancel(appointment)}>
                Cancel
              </button>
            </>
          ) : null}
          {appointment.status === 'COMPLETED' && appointment.prescriptionId ? (
            <button type="button" className="btn btn-success btn-sm" onClick={() => download(appointment)}>
              Download prescription
            </button>
          ) : null}
        </>
      }
    >
      <CardRow label="Patient" value={appointment.patientName} />
      <CardRow label="Date" value={prettyDate(appointment.date)} />
      <CardRow label="Slot" value={formatSlot(appointment.startTime, appointment.endTime)} />
    </Card>
  );

  return (
    <section className="page patient-appointments-page">
      <div className="page-head">
        <div>
          <div className="page-title">My appointments</div>
          <div className="page-subtitle">
            Newest appointments first. Appointments that were never attended are cancelled automatically at midnight.
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/patient/book-appointment')}>
          Book a new appointment
        </button>
      </div>

      <Pagination
        items={sorted}
        itemProcessor={renderAppointment}
        listClassName="cards"
        emptyMessage="You have not booked any appointment yet"
      />
    </section>
  );
};

export default PatientAppointmentListPage;
