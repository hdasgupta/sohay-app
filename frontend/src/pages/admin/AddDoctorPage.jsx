import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Dropdown from '../../components/Dropdown/Dropdown';
import PasswordInput, { isPasswordValid } from '../../components/PasswordInput/PasswordInput';
import { adminApi } from '../../api/adminApi';
import { useMessage } from '../../context/MessageContext';
import { SEX_OPTIONS, WEEKDAYS } from '../../utils/constants';
import { buildSlotEnds, buildSlotStarts, endsAfter, formatSlot, overlaps, toOption } from '../../utils/slotUtils';
import './AddDoctorPage.css';

const emptyForm = { name: '', sex: '', speciality: '', email: '', password: '', confirmPassword: '' };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Used both for adding a new doctor and for editing an existing one, where the
 * password fields become optional.
 */
const AddDoctorPage = () => {
  const { doctorId } = useParams();
  const editing = Boolean(doctorId);
  const navigate = useNavigate();
  const messenger = useMessage();

  const [form, setForm] = useState(emptyForm);
  const [availability, setAvailability] = useState([]);
  const [draft, setDraft] = useState({ weekday: '', startTime: '', endTime: '' });
  const [catalog, setCatalog] = useState({ starts: buildSlotStarts(), ends: buildSlotEnds() });

  useEffect(() => {
    const load = async () => {
      try {
        const data = await adminApi.slotCatalog();
        if (data?.starts?.length) setCatalog(data);
      } catch (error) {
        console.warn('[add-doctor] using local slot catalog', error.message);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!editing) {
      setForm(emptyForm);
      setAvailability([]);
      return;
    }
    const load = async () => {
      try {
        const doctor = await adminApi.getDoctor(doctorId);
        setForm({
          name: doctor.name,
          sex: doctor.sex,
          speciality: doctor.speciality,
          email: doctor.email,
          password: '',
          confirmPassword: '',
        });
        setAvailability(doctor.availability.map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime })));
        console.log('[add-doctor] loaded doctor for editing', doctor.id);
      } catch (error) {
        console.error('[add-doctor] could not load doctor', error.message);
      }
    };
    load();
  }, [doctorId, editing]);

  const startOptions = useMemo(() => catalog.starts.map(toOption), [catalog.starts]);
  // While selecting the start time the end list only keeps the later times.
  const endOptions = useMemo(() => endsAfter(draft.startTime, catalog.ends).map(toOption), [draft.startTime, catalog.ends]);

  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const addSlot = () => {
    if (draft.weekday === '' || draft.weekday === null) return messenger.warning('Choose a weekday for the time slot');
    if (!draft.startTime) return messenger.warning('Choose a start time');
    if (!draft.endTime) return messenger.warning('Choose an end time');

    const weekday = Number(draft.weekday);
    const clash = availability.find(
      (slot) => slot.weekday === weekday && overlaps(slot.startTime, slot.endTime, draft.startTime, draft.endTime),
    );
    if (clash) {
      return messenger.error(
        `This slot conflicts with ${formatSlot(clash.startTime, clash.endTime)} already added on ${
          WEEKDAYS[weekday].name
        }`,
      );
    }

    setAvailability((current) =>
      [...current, { weekday, startTime: draft.startTime, endTime: draft.endTime }].sort(
        (a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime),
      ),
    );
    setDraft({ weekday: String(weekday), startTime: '', endTime: '' });
    messenger.success('Time slot added to the weekly availability', 4);
    return undefined;
  };

  const removeSlot = (index) => setAvailability((current) => current.filter((unused, position) => position !== index));

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return messenger.warning('Doctor name is required');
    if (!form.sex) return messenger.warning('Please choose the sex');
    if (!form.speciality.trim()) return messenger.warning('Speciality is required');
    if (!editing && !EMAIL_PATTERN.test(form.email)) return messenger.warning('Please type a valid email address');
    if (!editing || form.password || form.confirmPassword) {
      if (!isPasswordValid(form.password)) return messenger.warning('Password does not satisfy all the rules');
      if (form.password !== form.confirmPassword) return messenger.warning('Password and confirm password do not match');
    }
    if (availability.length === 0) return messenger.warning('Add at least one time slot in the week');

    const payload = {
      name: form.name,
      sex: form.sex,
      speciality: form.speciality,
      email: form.email,
      password: form.password || undefined,
      confirmPassword: form.confirmPassword || undefined,
      availability,
    };

    try {
      const result = editing
        ? await adminApi.updateDoctor(doctorId, payload)
        : await adminApi.createDoctor(payload);
      messenger.success(result.message || 'Saved successfully');
      if (editing) navigate('/admin/doctor-list');
      else {
        setForm(emptyForm);
        setAvailability([]);
        setDraft({ weekday: '', startTime: '', endTime: '' });
      }
    } catch (error) {
      console.error('[add-doctor] save failed', error.message);
    }
    return undefined;
  };

  const grouped = useMemo(
    () =>
      WEEKDAYS.map((day) => ({
        ...day,
        slots: availability
          .map((slot, index) => ({ ...slot, index }))
          .filter((slot) => slot.weekday === day.id),
      })),
    [availability],
  );

  return (
    <section className="page add-doctor-page">
      <div className="page-head">
        <div>
          <div className="page-title">{editing ? 'Edit doctor' : 'Add doctor'}</div>
          <div className="page-subtitle">
            {editing
              ? 'Update the profile and weekly availability. Leave the password blank to keep the current one.'
              : 'Create a doctor account and define the weekly 30 minute consultation windows.'}
          </div>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => navigate('/admin/doctor-list')}>
          View doctor list
        </button>
      </div>

      <form className="surface" onSubmit={submit} noValidate>
        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="doctor-name">
              Doctor name<span className="req"> *</span>
            </label>
            <input
              id="doctor-name"
              type="text"
              placeholder="Full name"
              value={form.name}
              onChange={(event) => update('name')(event.target.value)}
              required
            />
          </div>
          <Dropdown
            label="Sex"
            required
            options={SEX_OPTIONS}
            value={form.sex}
            placeholder="Choose sex"
            onOptionSelected={(option) => update('sex')(option?.id || '')}
          />
        </div>

        <div className="grid cols-2">
          <div className="field">
            <label htmlFor="speciality">
              Speciality<span className="req"> *</span>
            </label>
            <input
              id="speciality"
              type="text"
              placeholder="For example Clinical Psychiatry"
              value={form.speciality}
              onChange={(event) => update('speciality')(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="doctor-email">
              Email address<span className="req"> *</span>
            </label>
            <input
              id="doctor-email"
              type="email"
              placeholder="doctor@example.com"
              value={form.email}
              onChange={(event) => update('email')(event.target.value)}
              disabled={editing}
              required
            />
            {editing ? <span className="hint">Email address cannot be changed after the account is created.</span> : null}
          </div>
        </div>

        <div className="grid cols-2">
          <PasswordInput
            label={editing ? 'New password (optional)' : 'Password'}
            name="doctor-password"
            value={form.password}
            onChange={update('password')}
            required={!editing}
            showRules={!editing || Boolean(form.password)}
            optionalHint={editing ? 'Leave blank to keep the existing password' : undefined}
          />
          <PasswordInput
            label="Confirm password"
            name="doctor-confirm"
            value={form.confirmPassword}
            onChange={update('confirmPassword')}
            showRules={false}
            required={!editing}
            optionalHint={
              form.confirmPassword && form.confirmPassword !== form.password ? 'Both passwords must match' : undefined
            }
          />
        </div>

        <h3 className="section-title">Weekly available time slots</h3>
        <p className="hint">
          Every window is stored as 30 minute consultation slots. Slots on the same weekday must not overlap and at least
          one slot is required in the week.
        </p>

        <div className="slot-builder">
          <Dropdown
            label="Weekday"
            options={WEEKDAYS}
            value={draft.weekday}
            placeholder="Choose weekday"
            onOptionSelected={(option) => setDraft((current) => ({ ...current, weekday: String(option?.id ?? '') }))}
          />
          <Dropdown
            label="Start time"
            options={startOptions}
            value={draft.startTime}
            placeholder="Choose start time"
            onOptionSelected={(option) => setDraft((current) => ({ ...current, startTime: option?.id || '', endTime: '' }))}
          />
          <Dropdown
            label="End time"
            options={endOptions}
            value={draft.endTime}
            placeholder={draft.startTime ? 'Choose end time' : 'Choose start time first'}
            disabled={!draft.startTime}
            onOptionSelected={(option) => setDraft((current) => ({ ...current, endTime: option?.id || '' }))}
          />
          <button type="button" className="btn btn-primary slot-add" onClick={addSlot}>
            Add slot
          </button>
        </div>

        <div className="week-grid">
          {grouped.map((day) => (
            <div key={day.id} className={`week-day ${day.slots.length ? 'has-slots' : ''}`}>
              <div className="week-day-head">
                <strong>{day.name}</strong>
                <span className="chip info">{day.slots.length} slot(s)</span>
              </div>
              {day.slots.length === 0 ? (
                <span className="hint">No availability</span>
              ) : (
                <ul className="slot-list">
                  {day.slots.map((slot) => (
                    <li key={`${slot.weekday}-${slot.startTime}`}>
                      <span>{formatSlot(slot.startTime, slot.endTime)}</span>
                      <button type="button" onClick={() => removeSlot(slot.index)} aria-label="Remove slot">
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        <div className="row end form-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setForm(emptyForm);
              setAvailability([]);
              setDraft({ weekday: '', startTime: '', endTime: '' });
            }}
          >
            Clear form
          </button>
          <button type="submit" className="btn btn-primary">
            {editing ? 'Save changes' : 'Add doctor'}
          </button>
        </div>
      </form>
    </section>
  );
};

export default AddDoctorPage;
