import { useMemo, useState } from 'react';
import './PasswordInput.css';

export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters long', test: (value) => value.length >= 8 },
  { key: 'upper', label: 'At least one upper case letter', test: (value) => /[A-Z]/.test(value) },
  { key: 'lower', label: 'At least one lower case letter', test: (value) => /[a-z]/.test(value) },
  { key: 'digit', label: 'At least one digit', test: (value) => /[0-9]/.test(value) },
  { key: 'special', label: 'At least one special character', test: (value) => /[^A-Za-z0-9\s]/.test(value) },
  { key: 'nospace', label: 'No space character', test: (value) => value.length > 0 && !/\s/.test(value) },
];

export const isPasswordValid = (value) => PASSWORD_RULES.every((rule) => rule.test(String(value || '')));

/**
 * Password box with show/hide eye button and live rule checklist.
 * Set showRules={false} on the login page where the checklist is not wanted.
 */
const PasswordInput = ({
  label = 'Password',
  value = '',
  onChange,
  name = 'password',
  placeholder = 'Enter password',
  showRules = true,
  required = false,
  autoComplete = 'new-password',
  optionalHint,
}) => {
  const [visible, setVisible] = useState(false);
  const results = useMemo(() => PASSWORD_RULES.map((rule) => ({ ...rule, ok: rule.test(String(value || '')) })), [value]);

  return (
    <div className="field password-field">
      <label htmlFor={name}>
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      <div className="password-shell">
        <input
          id={name}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange?.(event.target.value)}
          autoComplete={autoComplete}
          required={required}
        />
        <button
          type="button"
          className="eye"
          onClick={() => setVisible((previous) => !previous)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? '🙈' : '👁'}
        </button>
      </div>
      {optionalHint ? <span className="hint">{optionalHint}</span> : null}
      {showRules ? (
        <ul className="password-rules">
          {results.map((rule) => (
            <li key={rule.key} className={rule.ok ? 'ok' : 'bad'}>
              <span className="mark" aria-hidden="true">{rule.ok ? '✓' : '✕'}</span>
              {rule.label}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
};

export default PasswordInput;
