import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Captcha from '../../components/Captcha/Captcha';
import DatePicker from '../../components/DatePicker/DatePicker';
import Dropdown from '../../components/Dropdown/Dropdown';
import OtpField from '../../components/OtpField/OtpField';
import PasswordInput, { isPasswordValid } from '../../components/PasswordInput/PasswordInput';
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle';
import { authApi } from '../../api/authApi';
import { useMessage } from '../../context/MessageContext';
import { ORG_NAME, SEX_OPTIONS } from '../../utils/constants';
import { todayISO } from '../../utils/dateUtils';
import './RegisterPatientPage.css';
import OrgLogo from '../../components/OrgLogo/OrgLogo';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RegisterPatientPage = () => {
  const [form, setForm] = useState({
    name: '',
    sex: '',
    dateOfBirth: '',
    email: '',
    contactNumber: '',
    password: '',
    confirmPassword: '',
    otp: '',
  });
  const [otpSent, setOtpSent] = useState(false);
  const [captcha, setCaptcha] = useState({ token: '', answer: '' });
  const [captchaKey, setCaptchaKey] = useState(0);
  const messenger = useMessage();
  const navigate = useNavigate();

  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));
  const onCaptchaChange = useCallback((value) => setCaptcha(value), []);

  const sendOtp = async () => {
    if (!EMAIL_PATTERN.test(form.email)) {
      messenger.warning('Please type a valid email address before asking for the OTP');
      return;
    }
    try {
      const result = await authApi.sendOtp({ email: form.email, purpose: 'REGISTER' });
      setOtpSent(true);
      messenger.success(result.message || 'OTP sent to your email address');
    } catch (error) {
      console.error('[register] otp request failed', error.message);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) return messenger.warning('Please type your full name');
    if (!form.sex) return messenger.warning('Please choose your sex');
    if (!form.dateOfBirth) return messenger.warning('Please choose your date of birth');
    if (!EMAIL_PATTERN.test(form.email)) return messenger.warning('Please type a valid email address');
    if (!otpSent || !form.otp) return messenger.warning('Please verify your email address with the OTP');
    if (!/^[0-9]{10,15}$/.test(form.contactNumber.replace(/\D/g, ''))) {
      return messenger.warning('Contact number must contain 10 to 15 digits');
    }
    if (!isPasswordValid(form.password)) return messenger.warning('Password does not satisfy all the rules');
    if (form.password !== form.confirmPassword) return messenger.warning('Password and confirm password do not match');
    if (!captcha.answer) return messenger.warning('Please type the captcha characters');

    try {
      const result = await authApi.registerPatient({
        ...form,
        captchaToken: captcha.token,
        captchaAnswer: captcha.answer,
      });
      messenger.success(result.message || 'Registration successful');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('[register] failed', error.message);
      setCaptchaKey((key) => key + 1);
    }
    return undefined;
  };

  return (
    <div className="auth-wrap register-page">
      <div className="auth-card wide">
        <div className="login-theme-row">
          <ThemeToggle />
        </div>
        <div className="auth-brand">
          <OrgLogo size={48} />
          <div>
            <div className="org">{ORG_NAME}</div>
            <div className="hint">Patient registration</div>
          </div>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="grid cols-2">
            <div className="field">
              <label htmlFor="name">
                Full name<span className="req"> *</span>
              </label>
              <input
                id="name"
                type="text"
                placeholder="Your full name"
                value={form.name}
                onChange={(event) => update('name')(event.target.value)}
                required
              />
            </div>

            <Dropdown
              label="Sex"
              required
              options={SEX_OPTIONS}
              value={form.sex}
              placeholder="Choose sex"
              onOptionSelected={(option) => update('sex')(option?.id || '')}
            />
          </div>

          <div className="grid cols-2">
            <DatePicker
              label="Date of birth"
              required
              value={form.dateOfBirth}
              startDate="1900-01-01"
              endDate={todayISO()}
              onDateSelect={update('dateOfBirth')}
              placeholder="Choose date of birth"
            />

            <div className="field">
              <label htmlFor="contact">
                Contact number<span className="req"> *</span>
              </label>
              <input
                id="contact"
                type="tel"
                placeholder="10 digit mobile number"
                value={form.contactNumber}
                onChange={(event) => update('contactNumber')(event.target.value)}
                required
              />
            </div>
          </div>

          <OtpField
            email={form.email}
            onEmailChange={update('email')}
            onSend={sendOtp}
            otp={form.otp}
            onOtpChange={update('otp')}
            sent={otpSent}
          />

          <div className="grid cols-2">
            <PasswordInput label="Password" name="password" value={form.password} onChange={update('password')} required />
            <PasswordInput
              label="Confirm password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={update('confirmPassword')}
              showRules={false}
              required
              optionalHint={
                form.confirmPassword && form.confirmPassword !== form.password ? 'Both passwords must match' : undefined
              }
            />
          </div>

          <Captcha key={captchaKey} onChange={onCaptchaChange} />

          <button type="submit" className="btn btn-primary btn-block">
            Create my account
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">Back to login</Link>
          <Link to="/reset-password">Reset password</Link>
        </div>
      </div>
    </div>
  );
};

export default RegisterPatientPage;
