import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import Dropdown from '../../components/Dropdown/Dropdown.jsx';
import Password from '../../components/Password/Password.jsx';
import AvailabilityEditor from '../../components/AvailabilityEditor/AvailabilityEditor.jsx';
import SignaturePad from '../../components/SignaturePad/SignaturePad.jsx';
import { createDoctor, getDoctor, updateDoctor } from '../../api/adminApi.js';
import { SEX_OPTIONS } from '../../config/constants.js';
import { notify } from '../../utils/eventBus.js';
import { isEmail } from '../../utils/validators.js';
import { isPasswordValid } from '../../utils/password.js';
import { availabilityError } from '../../utils/timeSlots.js';
import './AddEditDoctorPage.css';

const SPECIALITY_SUGGESTIONS = ['Psychiatrist', 'Clinical Psychologist', 'Child & Adolescent Psychiatrist', 'Counselling Psychologist', 'Neuropsychiatrist', 'De-addiction Specialist', 'Geriatric Psychiatrist', 'Psychiatric Social Worker'];
const EMPTY = { name: '', sex: null, speciality: '', email: '', password: '', confirmPassword: '', availability: [], signature: null };

/** Add doctor (default admin page). Reused for editing via /admin/doctors/:id/edit (password optional). */
export default function AddEditDoctorPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [availError, setAvailError] = useState(null);
  const [loaded, setLoaded] = useState(!isEdit);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!isEdit) { setForm(EMPTY); setLoaded(true); return; }
    let alive = true;
    getDoctor(id).then(({ data }) => {
      if (!alive) return;
      setForm({ ...EMPTY, name: data.name, sex: data.sex, speciality: data.speciality, email: data.email, availability: data.availability || [], signature: data.signature || null });
      setLoaded(true);
    }).catch(() => navigate('/admin/doctors', { replace: true }));
    return () => { alive = false; };
  }, [id, isEdit, navigate]);

  const onAvailability = (v) => { set('availability')(v); setAvailError(null); };

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) { notify.warning('Please enter the doctor name'); return; }
    if (!form.sex) { notify.warning('Please select sex'); return; }
    if (form.speciality.trim().length < 2) { notify.warning('Please enter the speciality'); return; }
    if (!isEmail(form.email)) { notify.warning('Please enter a valid email address'); return; }
    const wantsPassword = !isEdit || form.password || form.confirmPassword;
    if (wantsPassword && !isPasswordValid(form.password)) { notify.warning('Password does not satisfy all the rules'); return; }
    if (wantsPassword && form.password !== form.confirmPassword) { notify.warning('Password and confirm password do not match'); return; }
    const aErr = availabilityError(form.availability);
    if (aErr) { setAvailError(aErr); notify.warning(aErr); return; }
    const body = {
      name: form.name.trim(), sex: form.sex, speciality: form.speciality.trim(), email: form.email.trim(),
      availability: form.availability, signature: form.signature || undefined,
      ...(wantsPassword ? { password: form.password, confirmPassword: form.confirmPassword } : {}),
    };
    try {
      if (isEdit) {
        const { message } = await updateDoctor(id, body);
        notify.success(message || 'Doctor updated');
        navigate('/admin/doctors');
      } else {
        const { message } = await createDoctor(body);
        notify.success(message || 'Doctor added');
        setForm(EMPTY);
      }
    } catch { /* shown by client */ }
  };

  if (!loaded) return null;

  return (
    <div className="add-doctor">
      <div className="page-title">
        <div>
          <h1>{isEdit ? 'Edit doctor' : 'Add a new doctor'}</h1>
          <p>{isEdit ? 'Update details and weekly availability. Leave the password empty to keep it unchanged.' : 'Create a doctor account and publish their weekly consultation hours.'}</p>
        </div>
        {isEdit && <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin/doctors')}>← Back to list</button>}
      </div>
      <form onSubmit={submit} noValidate className="ad-form">
        <section className="card ad-section">
          <h2 className="ad-section-title"><span>1</span> Profile</h2>
          <div className="grid grid-2">
            <div className="field">
              <label htmlFor="doc-name" className="required">Doctor name</label>
              <input id="doc-name" className="input" value={form.name} onChange={(e) => set('name')(e.target.value)} placeholder="Dr. Firstname Lastname" />
            </div>
            <Dropdown label="Sex" required options={SEX_OPTIONS} keyProcessor={(s) => s} labelProcessor={(s) => s} selected={form.sex} onOptionSelected={set('sex')} placeholder="Select sex" id="doc-sex" />
            <div className="field">
              <label htmlFor="doc-spec" className="required">Speciality</label>
              <input id="doc-spec" className="input" list="speciality-list" value={form.speciality} onChange={(e) => set('speciality')(e.target.value)} placeholder="e.g. Psychiatrist" />
              <datalist id="speciality-list">{SPECIALITY_SUGGESTIONS.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="field">
              <label htmlFor="doc-email" className="required">Email address</label>
              <input id="doc-email" className="input" type="email" value={form.email} onChange={(e) => set('email')(e.target.value)} placeholder="doctor@example.com" autoComplete="off" />
            </div>
          </div>
        </section>

        <section className="card ad-section">
          <h2 className="ad-section-title"><span>2</span> Login password {isEdit && <em className="ad-optional">optional</em>}</h2>
          <div className="grid grid-2">
            <Password value={form.password} onChange={set('password')} required={!isEdit} id="doc-password" placeholder={isEdit ? 'Leave empty to keep current' : 'Enter password'} />
            <Password label="Confirm password" value={form.confirmPassword} onChange={set('confirmPassword')} matchWith={form.password} required={!isEdit} id="doc-confirm" name="confirmPassword" placeholder="Re-enter password" />
          </div>
        </section>

        <section className="card ad-section">
          <h2 className="ad-section-title"><span>3</span> Weekly time slots</h2>
          <p className="muted small">Toggle the days the doctor consults and add one or more non-overlapping time ranges. Patients book 30 minute slots inside these ranges.</p>
          <AvailabilityEditor value={form.availability} onChange={onAvailability} error={availError} />
        </section>

        <section className="card ad-section">
          <h2 className="ad-section-title"><span>4</span> Signature <em className="ad-optional">optional - the doctor can also add it later</em></h2>
          <SignaturePad value={form.signature} onChange={set('signature')} />
        </section>

        <div className="ad-submit">
          <button type="submit" className="btn btn-primary">{isEdit ? 'Save changes' : 'Add doctor'}</button>
          {!isEdit && <button type="button" className="btn btn-ghost" onClick={() => { setForm(EMPTY); setAvailError(null); }}>Reset form</button>}
        </div>
      </form>
    </div>
  );
}
