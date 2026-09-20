import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Captcha from '../../components/Captcha/Captcha';
import OtpField from '../../components/OtpField/OtpField';
import PasswordInput, { isPasswordValid } from '../../components/PasswordInput/PasswordInput';
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle';
import { authApi } from '../../api/authApi';
import { useMessage } from '../../context/MessageContext';
import { ORG_NAME } from '../../utils/constants';
import './ResetPasswordPage.css';
import OrgLogo from '../../components/OrgLogo/OrgLogo';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ResetPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captcha, setCaptcha] = useState({ token: '', answer: '' });
  const [captchaKey, setCaptchaKey] = useState(0);
  const messenger = useMessage();
  const navigate = useNavigate();

  const onCaptchaChange = useCallback((value) => setCaptcha(value), []);

  const sendOtp = async () => {
    if (!EMAIL_PATTERN.test(email)) {
      messenger.warning('Please type a valid email address first');
      return;
    }
    try {
      // The backend rejects addresses that are not present in the users table.
      const result = await authApi.sendOtp({ email, purpose: 'RESET_PASSWORD' });
      setOtpSent(true);
      messenger.success(result.message || 'OTP sent to your email address');
    } catch (error) {
      console.error('[reset] otp request failed', error.message);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!otpSent || !otp) return messenger.warning('Please verify your email address with the OTP');
    if (!isPasswordValid(password)) return messenger.warning('Password does not satisfy all the rules');
    if (password !== confirmPassword) return messenger.warning('Password and confirm password do not match');
    if (!captcha.answer) return messenger.warning('Please type the captcha characters');

    try {
      const result = await authApi.resetPassword({
        email,
        otp,
        password,
        confirmPassword,
        captchaToken: captcha.token,
        captchaAnswer: captcha.answer,
      });
      messenger.success(result.message || 'Password reset successfully');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('[reset] failed', error.message);
      setCaptchaKey((key) => key + 1);
    }
    return undefined;
  };

  return (
    <div className="auth-wrap reset-page">
      <div className="auth-card">
        <div className="login-theme-row">
          <ThemeToggle />
        </div>
        <div className="auth-brand">
          <OrgLogo size={48} />
          <div>
            <div className="org">{ORG_NAME}</div>
            <div className="hint">Reset your password</div>
          </div>
        </div>

        <form onSubmit={submit} noValidate>
          <OtpField
            email={email}
            onEmailChange={setEmail}
            onSend={sendOtp}
            otp={otp}
            onOtpChange={setOtp}
            sent={otpSent}
            emailLabel="Registered email address"
          />

          <PasswordInput label="New password" name="password" value={password} onChange={setPassword} required />
          <PasswordInput
            label="Confirm new password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={setConfirmPassword}
            showRules={false}
            required
            optionalHint={confirmPassword && confirmPassword !== password ? 'Both passwords must match' : undefined}
          />

          <Captcha key={captchaKey} onChange={onCaptchaChange} />

          <button type="submit" className="btn btn-primary btn-block">
            Reset password
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">Back to login</Link>
          <Link to="/register">Register as a new patient</Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
