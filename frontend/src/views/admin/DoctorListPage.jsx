import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Pagination from '../../components/Pagination/Pagination.jsx';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog.jsx';
import { listDoctors, setDoctorDisabled } from '../../api/adminApi.js';
import { WEEKDAYS_SHORT } from '../../config/constants.js';
import { formatTime } from '../../utils/date.js';
import { initials } from '../../utils/validators.js';
import { notify } from '../../utils/eventBus.js';
import './DoctorListPage.css';

function groupAvailability(availability = []) {
  const byDay = new Map();
  [1, 2, 3, 4, 5, 6, 0].forEach((d) => byDay.set(d, []));
  availability.forEach((a) => byDay.get(a.weekday)?.push(a));
  return [...byDay.entries()];
}

export default function DoctorListPage() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    try { setDoctors((await listDoctors()).data); } catch { setDoctors([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (doc) => {
    setConfirm(null);
    try {
      const { message } = await setDoctorDisabled(doc.id, !doc.isDisabled);
      notify.success(message);
      setDoctors((list) => list.map((d) => (d.id === doc.id ? { ...d, isDisabled: !doc.isDisabled } : d)));
    } catch { /* shown */ }
  };

  const renderDoctor = (d) => (
    <article className={`doc-card ${d.isDisabled ? 'doc-disabled' : ''}`} data-testid={`doctor-${d.id}`}>
      <header className="doc-head">
        <span className="doc-avatar" aria-hidden="true">{initials(d.name)}</span>
        <div className="doc-id">
          <h3>{d.name}</h3>
          <span className="doc-spec">{d.speciality}</span>
        </div>
        <span className={`badge ${d.isDisabled ? 'badge-disabled' : 'badge-enabled'}`}>{d.isDisabled ? 'Disabled' : 'Active'}</span>
      </header>
      <ul className="doc-meta">
        <li><span className="faint">Email</span>{d.email}</li>
        <li><span className="faint">Sex</span>{d.sex}</li>
        <li><span className="faint">Signature</span>{d.hasSignature ? 'Added' : 'Not added yet'}</li>
      </ul>
      <div className="doc-week" aria-label="Weekly availability">
        {groupAvailability(d.availability).map(([day, slots]) => (
          <div key={day} className={`doc-day ${slots.length ? 'doc-day-on' : ''}`}>
            <span className="doc-day-name">{WEEKDAYS_SHORT[day]}</span>
            <span className="doc-day-slots">{slots.length ? slots.map((s) => `${formatTime(s.startTime)}-${formatTime(s.endTime)}`).join(', ') : '—'}</span>
          </div>
        ))}
      </div>
      <footer className="doc-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(`/admin/doctors/${d.id}/edit`)}>Edit</button>
        {d.isDisabled
          ? <button type="button" className="btn btn-success btn-sm" onClick={() => setConfirm(d)}>Enable</button>
          : <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirm(d)}>Disable</button>}
      </footer>
    </article>
  );

  return (
    <div className="doctor-list">
      <div className="page-title">
        <div>
          <h1>Doctors</h1>
          <p>{doctors ? `${doctors.length} doctor(s) registered` : 'Loading...'}. Disabled doctors cannot login and are hidden from patients.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/admin/add-doctor')}>+ Add doctor</button>
      </div>
      {doctors && (
        <Pagination
          items={doctors}
          itemProcessor={renderDoctor}
          searchText={(d) => `${d.name} ${d.email} ${d.speciality} ${d.sex} ${d.isDisabled ? 'disabled' : 'active'}`}
          searchPlaceholder="Search by name, email, speciality or status"
          emptyMessage="No doctors added yet"
        />
      )}
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.isDisabled ? 'Enable doctor?' : 'Disable doctor?'}
        message={confirm?.isDisabled
          ? `${confirm?.name} will be able to login and patients can book appointments again.`
          : `${confirm?.name} will not be able to login and will be hidden from patients.`}
        confirmText={confirm?.isDisabled ? 'Enable' : 'Disable'}
        tone={confirm?.isDisabled ? 'primary' : 'danger'}
        onConfirm={() => toggle(confirm)}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
