import { useId, useState } from "react";
import { PASSWORD_RULES } from "../../utils/password.js";
import "./Password.css";

/**
 * Password input with eye toggle and live rule checklist.
 * @param showRules  show the rule checklist (default true)
 * @param matchWith  when given, adds a "passwords match" rule (for confirm password)
 */
export default function Password({
  value,
  onChange,
  label = "Password",
  placeholder = "Enter password",
  name = "password",
  id,
  required = false,
  showRules = true,
  matchWith,
  autoComplete = "new-password",
  disabled = false,
  hint,
}) {
  const autoId = useId();
  const inputId = id || `pw-${autoId}`;
  const [visible, setVisible] = useState(false);
  const pw = value || "";
  const rules =
    matchWith !== undefined
      ? [
          {
            key: "match",
            label: "Both passwords match",
            ok: pw.length > 0 && pw === matchWith,
          },
        ]
      : PASSWORD_RULES.map((r) => ({
          key: r.key,
          label: r.label,
          ok: r.test(pw),
        }));

  return (
    <div className="field password">
      {label && (
        <label htmlFor={inputId} className={required ? "required" : ""}>
          {label}
        </label>
      )}
      <div className="pw-wrap">
        <input
          id={inputId}
          name={name}
          className="input pw-input"
          type={visible ? "text" : "password"}
          value={pw}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          disabled={disabled}
        />
        <button
          type="button"
          className="pw-eye"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          tabIndex={0}
        >
          {visible ? (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
              <path d="m1 1 22 22" />
            </svg>
          ) : (
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {hint && <span className="hint">{hint}</span>}
      {showRules && (
        <ul className="pw-rules" aria-label="Password rules">
          {rules.map((r) => (
            <li
              key={r.key}
              className={r.ok ? "pw-ok" : "pw-bad"}
              data-rule={r.key}
              data-ok={r.ok}
            >
              <span className="pw-icon" aria-hidden="true">
                {r.ok ? "✔" : "✖"}
              </span>
              <span>{r.label}</span>
              <span className="sr-only">
                {r.ok ? "(satisfied)" : "(not satisfied)"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
