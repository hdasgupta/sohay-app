import { useId } from "react";
import "./Dropdown.css";

/**
 * Generic dropdown built on select/option.
 * @param options          array of any objects / values
 * @param labelProcessor   (option) => label text
 * @param keyProcessor     (option) => unique key (defaults to option.id / option.code / option)
 * @param onOptionSelected (selectedOption) => void  (receives the whole object)
 * @param selected         currently selected option object (controlled) or null
 * @param placeholder      disabled first option text
 */
const defaultKey = (o) =>
  o && typeof o === "object"
    ? (o.id ?? o.code ?? o.value ?? JSON.stringify(o))
    : o;

export default function Dropdown({
  options = [],
  labelProcessor = (o) => String(o),
  keyProcessor = defaultKey,
  onOptionSelected,
  selected = null,
  placeholder = "Select an option",
  label,
  required = false,
  disabled = false,
  id,
  name,
  hint,
  className = "",
  compact = false,
}) {
  const autoId = useId();
  const selectId = id || `dd-${autoId}`;
  const keys = options.map((o) => String(keyProcessor(o)));
  const value =
    selected === null || selected === undefined
      ? ""
      : String(keyProcessor(selected));
  const safeValue = keys.includes(value) ? value : "";

  const handleChange = (e) => {
    const idx = keys.indexOf(e.target.value);
    if (idx >= 0) onOptionSelected?.(options[idx]);
  };

  return (
    <div
      className={`field dropdown ${compact ? "dropdown-compact" : ""} ${className}`}
    >
      {label && (
        <label htmlFor={selectId} className={required ? "required" : ""}>
          {label}
        </label>
      )}
      <div className="dropdown-wrap">
        <select
          id={selectId}
          name={name}
          className="select dropdown-select"
          value={safeValue}
          onChange={handleChange}
          disabled={disabled}
          required={required}
          aria-label={label || placeholder}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((o, i) => (
            <option key={keys[i]} value={keys[i]}>
              {labelProcessor(o)}
            </option>
          ))}
        </select>
        <span className="dropdown-caret" aria-hidden="true">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </div>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}
