import { useEffect, useId, useMemo, useRef, useState } from "react";
import { MONTHS, WEEKDAYS_SHORT } from "../../config/constants.js";
import {
  toIso,
  parseIso,
  daysInMonth,
  formatDate,
  todayIso,
} from "../../utils/date.js";
import "./DatePicker.css";

export const MIN_YEAR = 1900;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/**
 * Custom date picker.
 * Views: days -> (click month) months -> (click year) decades -> years
 * Year selection starts with decades (from 1900) then years of that decade.
 * @param startDate      'YYYY-MM-DD' first selectable date (default 1900-01-01)
 * @param endDate        'YYYY-MM-DD' last selectable date  (default 31 Dec of current year + 10)
 * @param enabledWeekDays array of weekday numbers (0 = Sunday) that can be picked
 * @param onDateSelect   (isoDate) => void
 */
export default function DatePicker({
  startDate,
  endDate,
  enabledWeekDays = ALL_DAYS,
  onDateSelect,
  value = null,
  label,
  placeholder = "Select a date",
  required = false,
  disabled = false,
  hint,
  id,
}) {
  const autoId = useId();
  const inputId = id || `dp-${autoId}`;
  const min =
    startDate && startDate > `${MIN_YEAR}-01-01`
      ? startDate
      : `${MIN_YEAR}-01-01`;
  const max = endDate || `${new Date().getFullYear() + 10}-12-31`;
  const minP = parseIso(min);
  const maxP = parseIso(max);
  const enabled = useMemo(() => new Set(enabledWeekDays), [enabledWeekDays]);

  const initial = () => {
    const base =
      value || (todayIso() >= min && todayIso() <= max ? todayIso() : min);
    const p = parseIso(base);
    return { y: p.y, m: p.m };
  };
  const [open, setOpen] = useState(false);
  const [view, setView] = useState("days"); // days | months | decades | years
  const [cursor, setCursor] = useState(initial);
  const [decade, setDecade] = useState(Math.floor(initial().y / 10) * 10);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target))
        setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (disabled) return;
    if (!open) {
      const c = initial();
      setCursor(c);
      setDecade(Math.floor(c.y / 10) * 10);
      setView("days");
    }
    setOpen((o) => !o);
  };

  const isSelectable = (iso) =>
    iso >= min &&
    iso <= max &&
    enabled.has(new Date(`${iso}T00:00:00Z`).getUTCDay());
  const monthInRange = (y, m) =>
    toIso(y, m, daysInMonth(y, m)) >= min && toIso(y, m, 1) <= max;
  const yearInRange = (y) => y >= minP.y && y <= maxP.y;

  const pick = (iso) => {
    if (!isSelectable(iso)) return;
    onDateSelect?.(iso);
    setOpen(false);
  };

  const shiftMonth = (delta) =>
    setCursor(({ y, m }) => {
      const d = new Date(Date.UTC(y, m + delta, 1));
      return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
    });
  const canShiftMonth = (delta) => {
    const d = new Date(Date.UTC(cursor.y, cursor.m + delta, 1));
    return monthInRange(d.getUTCFullYear(), d.getUTCMonth());
  };

  // ------------------------------------------------ views
  const renderDays = () => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay();
    const count = daysInMonth(cursor.y, cursor.m);
    const cells = [];
    for (let i = 0; i < first; i += 1)
      cells.push(<span key={`b${i}`} className="dp-cell dp-blank" />);
    for (let d = 1; d <= count; d += 1) {
      const iso = toIso(cursor.y, cursor.m, d);
      const ok = isSelectable(iso);
      cells.push(
        <button
          type="button"
          key={iso}
          data-date={iso}
          className={`dp-cell dp-day ${iso === value ? "dp-selected" : ""} ${iso === todayIso() ? "dp-today" : ""}`}
          disabled={!ok}
          onClick={() => pick(iso)}
          aria-label={formatDate(iso)}
          aria-pressed={iso === value}
        >
          {d}
        </button>,
      );
    }
    return (
      <>
        <div className="dp-head">
          <button
            type="button"
            className="dp-nav"
            onClick={() => shiftMonth(-1)}
            disabled={!canShiftMonth(-1)}
            aria-label="Previous month"
          >
            ‹
          </button>
          <div className="dp-title">
            <button
              type="button"
              className="dp-title-btn"
              onClick={() => setView("months")}
              aria-label="Choose month"
            >
              {MONTHS[cursor.m]}
            </button>
            <button
              type="button"
              className="dp-title-btn"
              onClick={() => {
                setDecade(Math.floor(cursor.y / 10) * 10);
                setView("decades");
              }}
              aria-label="Choose year"
            >
              {cursor.y}
            </button>
          </div>
          <button
            type="button"
            className="dp-nav"
            onClick={() => shiftMonth(1)}
            disabled={!canShiftMonth(1)}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <div className="dp-grid dp-grid-days">
          {WEEKDAYS_SHORT.map((w, i) => (
            <span
              key={w}
              className={`dp-weekday ${enabled.has(i) ? "" : "dp-weekday-off"}`}
            >
              {w.slice(0, 2)}
            </span>
          ))}
          {cells}
        </div>
      </>
    );
  };

  const renderMonths = () => (
    <>
      <div className="dp-head">
        <span />
        <div className="dp-title">
          <button
            type="button"
            className="dp-title-btn"
            onClick={() => {
              setDecade(Math.floor(cursor.y / 10) * 10);
              setView("decades");
            }}
            aria-label="Choose year"
          >
            {cursor.y}
          </button>
        </div>
        <span />
      </div>
      <div className="dp-grid dp-grid-3">
        {MONTHS.map((mName, m) => (
          <button
            type="button"
            key={mName}
            className={`dp-cell dp-big ${m === cursor.m ? "dp-selected" : ""}`}
            disabled={!monthInRange(cursor.y, m)}
            onClick={() => {
              setCursor((c) => ({ ...c, m }));
              setView("days");
            }}
          >
            {mName.slice(0, 3)}
          </button>
        ))}
      </div>
    </>
  );

  const firstDecade = Math.floor(minP.y / 10) * 10;
  const lastDecade = Math.floor(maxP.y / 10) * 10;
  const renderDecades = () => {
    const decades = [];
    for (let d = firstDecade; d <= lastDecade; d += 10) decades.push(d);
    return (
      <>
        <div className="dp-head">
          <span />
          <div className="dp-title">
            <span className="dp-title-static">Select decade</span>
          </div>
          <span />
        </div>
        <div className="dp-grid dp-grid-3 dp-scroll">
          {decades.map((d) => (
            <button
              type="button"
              key={d}
              data-decade={d}
              className={`dp-cell dp-big ${Math.floor(cursor.y / 10) * 10 === d ? "dp-selected" : ""}`}
              onClick={() => {
                setDecade(d);
                setView("years");
              }}
            >
              {d}s
            </button>
          ))}
        </div>
      </>
    );
  };

  const renderYears = () => {
    const years = Array.from({ length: 10 }, (_, i) => decade + i);
    return (
      <>
        <div className="dp-head">
          <button
            type="button"
            className="dp-nav"
            onClick={() => setDecade((d) => d - 10)}
            disabled={decade - 10 < firstDecade}
            aria-label="Previous decade"
          >
            ‹
          </button>
          <div className="dp-title">
            <button
              type="button"
              className="dp-title-btn"
              onClick={() => setView("decades")}
            >
              {decade} - {decade + 9}
            </button>
          </div>
          <button
            type="button"
            className="dp-nav"
            onClick={() => setDecade((d) => d + 10)}
            disabled={decade + 10 > lastDecade}
            aria-label="Next decade"
          >
            ›
          </button>
        </div>
        <div className="dp-grid dp-grid-3">
          {years.map((y) => (
            <button
              type="button"
              key={y}
              className={`dp-cell dp-big ${y === cursor.y ? "dp-selected" : ""}`}
              disabled={!yearInRange(y)}
              onClick={() => {
                let m = cursor.m;
                if (!monthInRange(y, m)) m = y === minP.y ? minP.m : maxP.m;
                setCursor({ y, m });
                setView("months");
              }}
            >
              {y}
            </button>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className={`field datepicker ${open ? "dp-open" : ""}`} ref={rootRef}>
      {label && (
        <label htmlFor={inputId} className={required ? "required" : ""}>
          {label}
        </label>
      )}
      <button
        type="button"
        id={inputId}
        className={`input dp-input ${value ? "" : "dp-placeholder"}`}
        onClick={toggle}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{value ? formatDate(value) : placeholder}</span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      {hint && <span className="hint">{hint}</span>}
      {open && (
        <div className="dp-popup" role="dialog" aria-label="Choose date">
          {view === "days" && renderDays()}
          {view === "months" && renderMonths()}
          {view === "decades" && renderDecades()}
          {view === "years" && renderYears()}
          {view === "days" && enabledWeekDays.length < 7 && (
            <p className="dp-footnote">
              Available on:{" "}
              {enabledWeekDays
                .slice()
                .sort()
                .map((d) => WEEKDAYS_SHORT[d])
                .join(", ") || "no days"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
