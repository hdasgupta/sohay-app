import { useState } from "react";
import { passwordRules } from "../utils/validation";
import "./PasswordInput.css";
export default function PasswordInput({
  value,
  onChange,
  optional = false,
  placeholder = "Password",
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="password-wrap">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button type="button" onClick={() => setShow((v) => !v)}>
          {show ? "🙈" : "👁️"}
        </button>
      </div>
      <div className="password-rules">
        {passwordRules.map(([k, f, l]) => {
          const ok = optional && !value ? true : f(value);
          return (
            <div key={k} className={ok ? "ok" : "bad"}>
              {ok ? "✓" : "✕"} {l}
            </div>
          );
        })}
      </div>
    </div>
  );
}
