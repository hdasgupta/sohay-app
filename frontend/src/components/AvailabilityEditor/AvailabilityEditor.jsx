import Dropdown from '../Dropdown/Dropdown.jsx';
import { WEEKDAYS } from '../../config/constants.js';
import { formatTime } from '../../utils/date.js';
import { startOptionsFor, endOptionsFor, toMinutes, toHHMM, totalHours } from '../../utils/timeSlots.js';
import { notify } from '../../utils/eventBus.js';
import './AvailabilityEditor.css';

const ORDER = [1, 2, 3, 4, 5, 6, 0]; // Monday first
const sortRows = (rows) => [...rows].sort((a, b) => a.weekday - b.weekday || toMinutes(a.startTime || '99:99') - toMinutes(b.startTime || '99:99'));

/**
 * Weekly availability editor.
 * value: [{ weekday: 0-6, startTime: 'HH:MM', endTime: 'HH:MM' }]
 * Every day can have many non overlapping 30-minute aligned slots.
 */
export default function AvailabilityEditor({ value = [], onChange, error }) {
  const dayRows = (day) => value.map((r, i) => ({ ...r, gi: i })).filter((r) => r.weekday === day);
  const emit = (rows) => onChange(sortRows(rows));

  const addSlot = (day) => {
    const rows = dayRows(day);
    const busy = rows.filter((r) => r.startTime && r.endTime);
    const candidateStarts = startOptionsFor(busy, -1);
    const lastEnd = busy.length ? Math.max(...busy.map((r) => toMinutes(r.endTime))) : toMinutes('09:00');
    const start = candidateStarts.find((t) => toMinutes(t) >= lastEnd) || candidateStarts[0];
    if (!start) { notify.warning(`${WEEKDAYS[day]} is already fully covered`); return; }
    const probe = [...busy, { weekday: day, startTime: start, endTime: null }];
    const ends = endOptionsFor(probe, probe.length - 1);
    const end = ends.find((t) => toMinutes(t) >= toMinutes(start) + 60) || ends[ends.length - 1];
    emit([...value, { weekday: day, startTime: start, endTime: end }]);
  };

  const update = (gi, patch) => {
    const next = value.map((r, i) => (i === gi ? { ...r, ...patch } : r));
    const row = next[gi];
    const same = next.map((r, i) => ({ ...r, gi: i })).filter((r) => r.weekday === row.weekday);
    const localIdx = same.findIndex((r) => r.gi === gi);
    const ends = endOptionsFor(same, localIdx);
    if (patch.startTime && (!row.endTime || !ends.includes(row.endTime))) {
      next[gi] = { ...row, endTime: ends[0] || null };
    }
    emit(next);
  };

  const remove = (gi) => emit(value.filter((_, i) => i !== gi));
  const toggleDay = (day, on) => {
    if (on) addSlot(day);
    else emit(value.filter((r) => r.weekday !== day));
  };
  const copyToAll = (day) => {
    const src = dayRows(day).filter((r) => r.startTime && r.endTime).map(({ startTime, endTime }) => ({ startTime, endTime }));
    if (!src.length) return;
    const next = [];
    ORDER.forEach((d) => src.forEach((s) => next.push({ weekday: d, ...s })));
    emit(next);
    notify.info(`${WEEKDAYS[day]} slots copied to every day`);
  };

  const hours = totalHours(value);

  return (
    <div className="avail-editor">
      <div className="ae-summary">
        <span className="chip">{new Set(value.map((r) => r.weekday)).size} day(s)</span>
        <span className="chip">{value.length} slot(s)</span>
        <span className="chip">Total {hours % 1 === 0 ? hours : hours.toFixed(1)} h / week</span>
      </div>
      {error && <p className="error-text ae-error" role="alert">{error}</p>}
      <div className="ae-days">
        {ORDER.map((day) => {
          const rows = dayRows(day);
          const on = rows.length > 0;
          return (
            <section key={day} className={`ae-day ${on ? 'ae-on' : ''}`} data-testid={`day-${day}`}>
              <header className="ae-day-head">
                <label className="ae-switch">
                  <input type="checkbox" checked={on} onChange={(e) => toggleDay(day, e.target.checked)} aria-label={`${WEEKDAYS[day]} available`} />
                  <span className="ae-slider" />
                </label>
                <h4>{WEEKDAYS[day]}</h4>
                {on && <button type="button" className="ae-link" onClick={() => copyToAll(day)} title="Copy these slots to every day">Copy to all</button>}
              </header>
              {!on && <p className="ae-off">Not available</p>}
              {rows.map((r) => {
                const localIdx = rows.findIndex((x) => x.gi === r.gi);
                const starts = startOptionsFor(rows, localIdx);
                const ends = endOptionsFor(rows, localIdx);
                return (
                  <div className="ae-slot" key={`${day}-${r.gi}`}>
                    <Dropdown compact options={starts} keyProcessor={(t) => t} labelProcessor={formatTime} selected={r.startTime} placeholder="Start" onOptionSelected={(t) => update(r.gi, { startTime: t })} id={`start-${day}-${localIdx}`} />
                    <span className="ae-to">to</span>
                    <Dropdown compact options={ends} keyProcessor={(t) => t} labelProcessor={formatTime} selected={r.endTime} placeholder="End" onOptionSelected={(t) => update(r.gi, { endTime: t })} id={`end-${day}-${localIdx}`} disabled={!r.startTime} />
                    <button type="button" className="ae-remove" onClick={() => remove(r.gi)} aria-label={`Remove ${WEEKDAYS[day]} slot ${localIdx + 1}`}>×</button>
                  </div>
                );
              })}
              {on && (
                <button type="button" className="btn btn-ghost btn-sm ae-add" onClick={() => addSlot(day)}>+ Add slot</button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

export { toHHMM };
