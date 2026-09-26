import { useEffect, useId, useState } from "react";
import { sendOtp, verifyOtp } from "../../api/commonApi.js";
import { notify } from "../../utils/eventBus.js";
import { isEmail } from "../../utils/validators.js";
import { OTP_VALIDITY_SECONDS } from "../../config/constants.js";
import "./OtpEmailVerifier.css";

const RESEND_AFTER_SECONDS = 45;
const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/**
 * Email field verified through an emailed OTP.
 * Shows a countdown of the OTP validity after sending.
 * @param purpose     'register' | 'reset_password'
 * @param onVerified  (verificationToken | null) => void
 */
export default function OtpEmailVerifier({
  purpose,
  email,
  onEmailChange,
  onVerified,
  label = "Email address",
}) {
  const autoId = useId();
  const [stage, setStage] = useState("idle"); // idle | sent | verified
  const [otp, setOtp] = useState("");
  const [expiresAt, setExpiresAt] = useState(0);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (stage !== "sent") return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stage]);

  const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const expired = stage === "sent" && remaining === 0;

  const changeEmail = (v) => {
    onEmailChange?.(v);
    if (stage !== "idle") {
      setStage("idle");
      setOtp("");
      onVerified?.(null);
    }
  };

  const send = async () => {
    if (!isEmail(email)) {
      notify.warning("Please enter a valid email address");
      return;
    }
    try {
      const { data, message } = await sendOtp(email.trim(), purpose);
      const seconds = data?.validitySeconds || OTP_VALIDITY_SECONDS;
      const t = Date.now();
      setExpiresAt(t + seconds * 1000);
      setResendAt(t + RESEND_AFTER_SECONDS * 1000);
      setNow(t);
      setOtp("");
      setStage("sent");
      notify.success(
        message || `OTP sent to ${email}. It is valid for 10 minutes`,
      );
    } catch {
      /* error already shown */
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(otp)) {
      notify.warning("Please enter the 6 digit OTP from the email");
      return;
    }
    try {
      const { data, message } = await verifyOtp(email.trim(), purpose, otp);
      setStage("verified");
      onVerified?.(data.verificationToken);
      notify.success(message || "Email verified successfully");
    } catch {
      /* shown */
    }
  };

  return (
    <div className="field otp-email">
      <label htmlFor={`em-${autoId}`} className="required">
        {label}
      </label>
      <div className="otp-row">
        <div className="otp-email-wrap">
          <input
            id={`em-${autoId}`}
            className={`input ${stage === "verified" ? "otp-verified-input" : ""}`}
            type="email"
            value={email}
            onChange={(e) => changeEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            readOnly={stage === "verified"}
          />
          {stage === "verified" && (
            <span className="otp-badge" aria-label="Email verified">
              ✔ Verified
            </span>
          )}
        </div>
        {stage === "verified" ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => changeEmail(email)}
          >
            Change
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-accent"
            onClick={send}
            disabled={!isEmail(email) || (stage === "sent" && resendIn > 0)}
          >
            {stage === "sent"
              ? resendIn > 0
                ? `Resend in ${resendIn}s`
                : "Resend OTP"
              : "Send OTP"}
          </button>
        )}
      </div>
      {stage === "sent" && (
        <div className="otp-panel">
          <div className="otp-row">
            <input
              className="input otp-code"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="6 digit OTP"
              aria-label="OTP"
              disabled={expired}
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={verify}
              disabled={otp.length !== 6 || expired}
            >
              Verify
            </button>
          </div>
          <div
            className={`otp-timer ${remaining < 60 ? "otp-timer-low" : ""}`}
            role="timer"
            aria-live="off"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            {expired ? (
              "OTP expired. Please request a new one"
            ) : (
              <>
                OTP valid for{" "}
                <strong data-testid="otp-countdown">{fmt(remaining)}</strong>
              </>
            )}
            <span className="otp-bar">
              <span
                style={{
                  width: `${(remaining / OTP_VALIDITY_SECONDS) * 100}%`,
                }}
              />
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
