import { useState } from "react";
import { Link, useNavigate } from "react-router";
import AuthLayout from "../../components/AuthLayout/AuthLayout.jsx";
import Password from "../../components/Password/Password.jsx";
import Captcha from "../../components/Captcha/Captcha.jsx";
import OtpEmailVerifier from "../../components/OtpEmailVerifier/OtpEmailVerifier.jsx";
import { resetPassword } from "../../api/commonApi.js";
import { OTP_PURPOSE } from "../../config/constants.js";
import { notify } from "../../utils/eventBus.js";
import { isPasswordValid } from "../../utils/password.js";
import "./ResetPasswordPage.css";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationToken, setVerificationToken] = useState(null);
  const [captcha, setCaptcha] = useState({ captchaId: null, captchaText: "" });
  const [captchaKey, setCaptchaKey] = useState(0);

  const submit = async (e) => {
    e.preventDefault();
    if (!verificationToken) {
      notify.warning("Please verify your email address with the OTP");
      return;
    }
    if (!isPasswordValid(password)) {
      notify.warning("Password does not satisfy all the rules");
      return;
    }
    if (password !== confirmPassword) {
      notify.warning("Password and confirm password do not match");
      return;
    }
    if (!captcha.captchaText) {
      notify.warning("Please type the captcha characters");
      return;
    }
    try {
      const { message } = await resetPassword({
        email: email.trim(),
        password,
        confirmPassword,
        verificationToken,
        ...captcha,
      });
      notify.success(message || "Password reset successfully. Please login");
      navigate("/login", { replace: true });
    } catch {
      setCaptchaKey((k) => k + 1);
    }
  };

  return (
    <AuthLayout
      title="Reset password"
      subtitle="We will email a one time password to your registered email address."
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <OtpEmailVerifier
          purpose={OTP_PURPOSE.RESET}
          email={email}
          onEmailChange={setEmail}
          onVerified={setVerificationToken}
          label="Registered email address"
        />
        <Password
          label="New password"
          value={password}
          onChange={setPassword}
          required
          id="rp-password"
        />
        <Password
          label="Confirm new password"
          placeholder="Re-enter password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          matchWith={password}
          required
          id="rp-confirm"
          name="confirmPassword"
        />
        <Captcha onChange={setCaptcha} refreshKey={captchaKey} />
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={!verificationToken}
        >
          Reset password
        </button>
        <div className="auth-links reset-links">
          <Link to="/login">Back to sign in</Link>
          <Link to="/register">New patient? Register</Link>
        </div>
      </form>
    </AuthLayout>
  );
}
