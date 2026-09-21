import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from '../../components/DatePicker/DatePicker';
import Dropdown from '../../components/Dropdown/Dropdown';
import { patientApi } from '../../api/patientApi';
import { useAuth } from '../../context/AuthContext';
import { useMessage } from '../../context/MessageContext';
import { addDaysISO, prettyDate, todayISO } from '../../utils/dateUtils';
import { formatSlot } from '../../utils/slotUtils';
import './BookAppointmentPage.css';

const BookAppointmentPage = () => {
  const { user } = useAuth();
  const messenger = useMessage();
  const navigate = useNavigate();

  const [members, setMembers] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [forPatientId, setForPatientId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [startTime, setStartTime] = useState('');
  const [booked, setBooked] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [memberList, doctorList] = await Promise.all([patientApi.bookableMembers(), patientApi.doctors()]);
        setMembers(memberList || []);
        setDoctors(doctorList || []);
        const myself = (memberList || []).find((member) => Number(member.id) === Number(user?.id));
        if (myself) setForPatientId(String(myself.id));
        console.log('[book] loaded', memberList?.length, 'member(s) and', doctorList?.length, 'doctor(s)');
      } catch (error) {
        console.error('[book] could not load options', error.message);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Family member chooser is only meaningful when the patient belongs to a family.
  const hasFamily = members.length > 1;

  const loadSlots = async (nextDate) => {
    setDate(nextDate);
    setStartTime('');
    setSlots([]);
    if (!nextDate || !doctorId || !forPatientId) return;
    try {
      const data = await patientApi.slots({ doctorId, date: nextDate, forPatientId });
      setSlots(data || []);
      if (!data?.length) messenger.warning('No free slot is available for this doctor on the chosen date');
    } catch (error) {
      console.error('[book] could not load slots', error.message);
    }
  };

  const slotOptions = useMemo(
    () => (slots || []).map((slot) => ({ id: slot.startTime, name: formatSlot(slot.startTime, slot.endTime) })),
    [slots],
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!forPatientId) return messenger.warning('Choose the person for whom the appointment is being booked');
    if (!doctorId) return messenger.warning('Choose a doctor');
    if (!date) return messenger.warning('Choose the appointment date');
    if (!startTime) return messenger.warning('Choose a time slot');

    try {
      const result = await patientApi.book({ forPatientId, doctorId, date, startTime });
      messenger.success(result.message || 'Appointment booked successfully');
      setBooked(result.data);
      setDate('');
      setSlots([]);
      setStartTime('');
    } catch (error) {
      console.error('[book] booking failed', error.message);
    }
    return undefined;
  };

  return (
    <section className="page book-page">
      <div className="page-head">
        <div>
          <div className="page-title">Book appointment</div>
          <div className="page-subtitle">
            Choose a doctor and one of the free 30 minute slots. A confirmation email with the video consultation link is
            sent immediately.
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/patient/appointment-list')}>
          My appointments
        </button>
      </div>

      <form className="surface" onSubmit={submit} noValidate>
        <div className="grid cols-2">
          {hasFamily ? (
            <Dropdown
              label="Appointment for"
              required
              options={members}
              value={forPatientId}
              placeholder="Choose family member"
              onOptionSelected={(option) => {
                setForPatientId(option ? String(option.id) : '');
                setDate('');
                setSlots([]);
                setStartTime('');
              }}
            />
          ) : (
            <div className="field">
              <label>Appointment for</label>
              <input type="text" value={`${user?.name} (myself)`} readOnly />
              <span className="hint">Create or join a family to book for your family members.</span>
            </div>
          )}

          <Dropdown
            label="Doctor"
            required
            options={doctors}
            value={doctorId}
            placeholder="Choose doctor"
            labelProcessor={(option) => `Dr. ${option.name} · ${option.speciality}`}
            onOptionSelected={(option) => {
              setDoctorId(option ? String(option.id) : '');
              setDate('');
              setSlots([]);
              setStartTime('');
            }}
          />
        </div>

        <div className="grid cols-2">
          <DatePicker
            label="Appointment date"
            required
            value={date}
            startDate={todayISO()}
            endDate={addDaysISO(120)}
            onDateSelect={loadSlots}
            placeholder={doctorId ? 'Choose a date' : 'Choose the doctor first'}
            disabled={!doctorId}
          />
          <Dropdown
            label="Time slot"
            required
            options={slotOptions}
            value={startTime}
            placeholder={date ? 'Choose a free 30 minute slot' : 'Choose the date first'}
            disabled={!date || slotOptions.length === 0}
            onOptionSelected={(option) => setStartTime(option?.id || '')}
          />
        </div>

        <div className="row end">
          <button type="submit" className="btn btn-primary">
            Book appointment
          </button>
        </div>
      </form>

      {booked ? (
        <div className="surface booked-box">
          <h3>Appointment confirmed</h3>
          <p className="hint">
            {prettyDate(booked.date)} · {formatSlot(booked.startTime, booked.endTime)} · room {booked.roomId}
          </p>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/consultation/${booked.id}`)}
            >
              Join the video consultation
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => navigate('/patient/appointment-list')}
            >
              See all my appointments
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
};

export default BookAppointmentPage;
