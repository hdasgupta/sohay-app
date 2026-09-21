import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card, { CardRow } from '../../components/Card/Card';
import Pagination from '../../components/Pagination/Pagination';
import { adminApi } from '../../api/adminApi';
import { useMessage } from '../../context/MessageContext';
import { WEEKDAYS } from '../../utils/constants';
import { formatSlot } from '../../utils/slotUtils';
import useDebouncedValue from '../../hooks/useDebouncedValue';
import './DoctorListPage.css';

const DoctorListPage = () => {
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 450);
  const navigate = useNavigate();
  const messenger = useMessage();

  const load = useCallback(async (term) => {
    try {
      const data = await adminApi.listDoctors(term);
      setDoctors(data || []);
      console.log('[doctor-list] loaded', data?.length, 'doctor(s)');
    } catch (error) {
      console.error('[doctor-list] could not load doctors', error.message);
    }
  }, []);

  useEffect(() => {
    load(debouncedSearch);
  }, [debouncedSearch, load]);

  const toggleDisabled = async (doctor) => {
    try {
      const result = await adminApi.setDisabled(doctor.id, !doctor.isDisabled);
      messenger.success(result.message || 'Doctor status updated');
      load(debouncedSearch);
    } catch (error) {
      console.error('[doctor-list] could not change status', error.message);
    }
  };

  const renderDoctor = (doctor) => (
    <Card
      key={doctor.id}
      title={`Dr. ${doctor.name}`}
      subtitle={doctor.speciality}
      badge={doctor.isDisabled ? 'Disabled' : 'Active'}
      badgeTone={doctor.isDisabled ? 'danger' : 'success'}
      actions={
        <>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/admin/add-doctor/${doctor.id}`)}
          >
            Edit
          </button>
          <button
            type="button"
            className={`btn btn-sm ${doctor.isDisabled ? 'btn-success' : 'btn-warning'}`}
            onClick={() => toggleDisabled(doctor)}
          >
            {doctor.isDisabled ? 'Enable' : 'Disable'}
          </button>
        </>
      }
    >
      <CardRow label="Email" value={doctor.email} />
      <CardRow label="Sex" value={doctor.sex} />
      <div className="doctor-availability">
        <span className="card-row-label">Availability</span>
        <div className="availability-chips">
          {doctor.availability.length === 0 ? (
            <span className="hint">No slot configured</span>
          ) : (
            WEEKDAYS.map((day) => {
              const slots = doctor.availability.filter((slot) => slot.weekday === day.id);
              if (slots.length === 0) return null;
              return (
                <div key={day.id} className="availability-day">
                  <strong>{day.short}</strong>
                  {slots.map((slot) => (
                    <span key={`${day.id}-${slot.startTime}`} className="chip">
                      {formatSlot(slot.startTime, slot.endTime)}
                    </span>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Card>
  );

  return (
    <section className="page doctor-list-page">
      <div className="page-head">
        <div>
          <div className="page-title">Doctor list</div>
          <div className="page-subtitle">Edit a profile, or disable an account to hide it from the patients.</div>
        </div>
        <div className="row">
          <input
            type="search"
            className="doctor-search"
            placeholder="Search by name, email or speciality"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={() => navigate('/admin/add-doctor')}>
            Add doctor
          </button>
        </div>
      </div>

      <Pagination
        items={doctors}
        itemProcessor={renderDoctor}
        listClassName="cards"
        emptyMessage="No doctor has been added yet"
      />
    </section>
  );
};

export default DoctorListPage;
