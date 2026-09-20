import { useEffect, useState } from 'react';
import './OtpField.css';

const format = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * Email + OTP pair. The parent owns the email value and the send handler; this
 * component renders the send button, the countdown timer and the otp box.
 */
const OtpField = ({ email, onEmailChange, onSend, otp, onOtpChange, sent, ttlSeconds = 600, emailLabel = 'Email address', disabled = false }) => {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!sent) return undefined;
    setRemaining(ttlSeconds);
    const timer = setInterval(() => {
      setRemaining((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [sent, ttlSeconds]);

  return (
    <div className="otp-block">
      <div className="field">
        <label htmlFor="otp-email">
          {emailLabel}
          <span className="req"> *</span>
        </label>
        <div className="otp-email-row">
          <input
            id="otp-email"
            type="email"
            value={email}
            placeholder="name@example.com"
            onChange={(event) => onEmailChange?.(event.target.value)}
            autoComplete="email"
            disabled={disabled}
            required
          />
          <button type="button" className="btn btn-primary btn-sm otp-send" onClick={onSend} disabled={disabled}>
            {sent ? 'Resend OTP' : 'Send OTP'}
          </button>
        </div>
      </div>

      {sent ? (
        <div className="field">
          <label htmlFor="otp-code">
            One time password
            <span className="req"> *</span>
          </label>
          <div className="otp-code-row">
            <input
              id="otp-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              className="otp-code"
              value={otp}
              placeholder="● ● ● ● ● ●"
              onChange={(event) => onOtpChange?.(event.target.value.replace(/\D/g, ''))}
              required
            />
            <span className={`otp-timer ${remaining === 0 ? 'expired' : ''}`}>
              {remaining > 0 ? `Valid for ${format(remaining)}` : 'OTP expired, please resend'}
            </span>
          </div>
          <span className="hint">The OTP was emailed to {email} and stays valid for 10 minutes.</span>
        </div>
      ) : null}
    </div>
  );
};

export default OtpField;
