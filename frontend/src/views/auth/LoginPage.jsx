import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import AuthLayout from '../../components/AuthLayout/AuthLayout.jsx';
import Password from '../../components/Password/Password.jsx';
import Captcha from '../../components/Captcha/Captcha.jsx';
import { login } from '../../api/commonApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { notify } from '../../utils/eventBus.js';
import { isEmail } from '../../utils/validators.js';
import { takeRedirect } from '../../utils/authStorage.js';
import { defaultPathFor, isPathAllowed } from '../../routes/navConfig.js';
import logger from '../../utils/logger.js';
import './LoginPage.css';

export default function LoginPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState({ captchaId: null, captchaText: '' });
  const [captchaKey, setCaptchaKey] = useState(0);

  const from = location.state?.from ? `${location.state.from.pathname}${location.state.from.search || ''}` : null;

  const submit = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) { notify.warning('Please enter a valid email address'); return; }
    if (!password) { notify.warning('Please enter your password'); return; }
    if (!captcha.captchaText) { notify.warning('Please type the captcha characters'); return; }
    try {
      const { data, message } = await login({ email: email.trim(), password, ...captcha });
      auth.login(data);
      notify.success(message || 'Login successful');
      const wanted = from || takeRedirect();
      const target = isPathAllowed(data.user.role, wanted?.split('?')[0]) ? wanted : defaultPathFor(data.user.role);
      logger.info(`Redirecting after login to ${target}`);
      navigate(target, { replace: true });
    } catch {
      setCaptchaKey((k) => k + 1);
    }
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to book, attend or manage consultations. Admin, doctors and patients all sign in here.">
      {from && <div className="login-deeplink">Please login to continue to <strong>{from}</strong></div>}
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="login-email" className="required">Email address</label>
          <input id="login-email" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="username" required />
        </div>
        <Password value={password} onChange={setPassword} autoComplete="current-password" required id="login-password" />
        <Captcha onChange={setCaptcha} refreshKey={captchaKey} />
        <button type="submit" className="btn btn-primary btn-block">Sign in</button>
        <div className="auth-links">
          <Link to="/register">New patient? Register</Link>
          <Link to="/reset-password">Forgot password?</Link>
        </div>
      </form>
    </AuthLayout>
  );
}
