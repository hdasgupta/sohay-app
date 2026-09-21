import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Captcha from '../../components/Captcha/Captcha';
import PasswordInput from '../../components/PasswordInput/PasswordInput';
import ThemeToggle from '../../components/ThemeToggle/ThemeToggle';
import { authApi } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { useMessage } from '../../context/MessageContext';
import { ORG_NAME } from '../../utils/constants';
import './LoginPage.css';
import OrgLogo from '../../components/OrgLogo/OrgLogo';

/**
 * Single login page for all three kinds of user. The role is detected on the
 * backend from the users table, so no role selector is shown here.
 */
const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState({ token: '', answer: '' });
  const [captchaKey, setCaptchaKey] = useState(0);
  const { login, isAuthenticated, defaultPage } = useAuth();
  const messenger = useMessage();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) navigate(defaultPage, { replace: true });
  }, [isAuthenticated, defaultPage, navigate]);

  const onCaptchaChange = useCallback((value) => setCaptcha(value), []);

  const submit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      messenger.warning('Email and password are both required');
      return;
    }
    if (!captcha.answer) {
      messenger.warning('Please type the captcha characters');
      return;
    }
    try {
      const result = await authApi.login({
        email,
        password,
        captchaToken: captcha.token,
        captchaAnswer: captcha.answer,
      });
      const session = login(result.data);
      messenger.success(result.message || 'Logged in successfully');
      navigate(session.defaultPage, { replace: true });
    } catch (error) {
      console.error('[login] failed', error.message);
      setCaptchaKey((key) => key + 1);
    }
  };

  return (
    <div className="auth-wrap login-page">
      <div className="auth-card">
        <div className="login-theme-row">
          <ThemeToggle />
        </div>
        <div className="auth-brand">
          <OrgLogo size={48} />
          <div>
            <div className="org">{ORG_NAME}</div>
            <div className="hint">Appointment portal sign in</div>
          </div>
        </div>

        <form onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="email">
              Email address<span className="req"> *</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <PasswordInput
            label="Password"
            name="login-password"
            value={password}
            onChange={setPassword}
            showRules={false}
            autoComplete="current-password"
            required
          />

          <Captcha key={captchaKey} onChange={onCaptchaChange} />

          <button type="submit" className="btn btn-primary btn-block">
            Login
          </button>
        </form>

        <div className="auth-links">
          <Link to="/register">Register as a new patient</Link>
          <Link to="/reset-password">Forgot password? Reset it</Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
