import { useEffect, useMemo, useRef, useState } from 'react';
import './DatePicker.css';

const WEEK_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const toISO = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseISO = (value) => {
  if (!value) return null;
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/**
 * Custom calendar.
 *  startDate / endDate  : ISO strings, only dates inside the range are enabled
 *  enabledWeekdays      : array of 0..6, other weekdays are disabled
 *  onDateSelect         : (isoDate) => void
 */
const DatePicker = ({
  label,
  value = '',
  startDate,
  endDate,
  enabledWeekdays = [0, 1, 2, 3, 4, 5, 6],
  onDateSelect,
  placeholder = 'Select a date',
  required = false,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => parseISO(value) || parseISO(startDate) || new Date());
  const wrapRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => {
    if (value) setCursor(parseISO(value));
  }, [value]);

  const min = useMemo(() => parseISO(startDate), [startDate]);
  const max = useMemo(() => parseISO(endDate), [endDate]);

  const days = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = first.getDay();
    const total = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const cells = Array.from({ length: offset }, () => null);
    for (let day = 1; day <= total; day += 1) {
      cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    }
    return cells;
  }, [cursor]);

  const isEnabled = (date) => {
    if (!date) return false;
    if (min && date < new Date(min.getFullYear(), min.getMonth(), min.getDate())) return false;
    if (max && date > new Date(max.getFullYear(), max.getMonth(), max.getDate())) return false;
    return enabledWeekdays.includes(date.getDay());
  };

  const pick = (date) => {
    if (!isEnabled(date)) return;
    const iso = toISO(date);
    console.log('[DatePicker] selected', iso);
    onDateSelect?.(iso);
    setOpen(false);
  };

  return (
    <div className="field datepicker" ref={wrapRef}>
      {label ? (
        <label>
          {label}
          {required ? <span className="req"> *</span> : null}
        </label>
      ) : null}
      <button
        type="button"
        className={`datepicker-input ${disabled ? 'is-disabled' : ''}`}
        onClick={() => !disabled && setOpen((previous) => !previous)}
        disabled={disabled}
      >
        <span className={value ? '' : 'placeholder'}>{value || placeholder}</span>
        <span className="calendar-icon" aria-hidden="true">📅</span>
      </button>

      {open ? (
        <div className="datepicker-pop">
          <div className="datepicker-head">
            <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
              ‹
            </button>
            <div className="dp-month">
              <select
                value={cursor.getMonth()}
                onChange={(event) => setCursor(new Date(cursor.getFullYear(), Number(event.target.value), 1))}
              >
                {MONTHS.map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>
              <select
                value={cursor.getFullYear()}
                onChange={(event) => setCursor(new Date(Number(event.target.value), cursor.getMonth(), 1))}
              >
                {Array.from({ length: 121 }, (unused, index) => new Date().getFullYear() - 100 + index).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
              ›
            </button>
          </div>

          <div className="datepicker-grid">
            {WEEK_LABELS.map((day) => (
              <span key={day} className="dp-weekday">
                {day}
              </span>
            ))}
            {days.map((date, index) => {
              if (!date) return <span key={`empty-${index}`} className="dp-cell empty" />;
              const iso = toISO(date);
              const enabled = isEnabled(date);
              return (
                <button
                  key={iso}
                  type="button"
                  className={`dp-cell ${enabled ? '' : 'disabled'} ${value === iso ? 'selected' : ''}`}
                  onClick={() => pick(date)}
                  disabled={!enabled}
                  title={enabled ? iso : 'Not available'}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DatePicker;
