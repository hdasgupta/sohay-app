import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card, { CardRow } from '../../components/Card/Card';
import Pagination from '../../components/Pagination/Pagination';
import { doctorApi } from '../../api/doctorApi';
import { STATUS_TONES } from '../../utils/constants';
import { calculateAge, prettyDate, todayISO } from '../../utils/dateUtils';
import { formatSlot } from '../../utils/slotUtils';
import './DoctorAppointmentListPage.css';

const ACTIVE = ['SCHEDULED', 'RESCHEDULED'];

/** Read only listing, the doctor cannot modify any appointment. */
const DoctorAppointmentListPage = () => {
  const [appointments, setAppointments] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await doctorApi.appointments();
        setAppointments(data || []);
        console.log('[doctor-appointments] loaded', data?.length);
      } catch (error) {
        console.error('[doctor-appointments] could not load', error.message);
      }
    };
    load();
  }, []);

  const sorted = useMemo(
    () => [...appointments].sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime)),
    [appointments],
  );

  const renderAppointment = (appointment) => (
    <Card
      key={appointment.id}
      title={appointment.patientName}
      subtitle={appointment.dateOfBirth ? `${calculateAge(appointment.dateOfBirth)} years` : undefined}
      badge={appointment.status}
      badgeTone={STATUS_TONES[appointment.status] || 'info'}
      actions={
        ACTIVE.includes(appointment.status) && appointment.date >= todayISO() ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/consultation/${appointment.id}`)}
          >
            Start consultation
          </button>
        ) : null
      }
    >
      <CardRow label="Date" value={prettyDate(appointment.date)} />
      <CardRow label="Slot" value={formatSlot(appointment.startTime, appointment.endTime)} />
      <CardRow label="Prescription" value={appointment.prescriptionId ? 'Generated' : 'Not generated'} />
    </Card>
  );

  return (
    <section className="page doctor-appointments-page">
      <div className="page-head">
        <div>
          <div className="page-title">My appointments</div>
          <div className="page-subtitle">All the appointments booked with you, newest first. This list is read only.</div>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/doctor/generate-prescription')}>
          Generate prescription
        </button>
      </div>

      <Pagination
        items={sorted}
        itemProcessor={renderAppointment}
        listClassName="cards"
        emptyMessage="No appointment has been booked with you yet"
      />
    </section>
  );
};

export default DoctorAppointmentListPage;
