import { useState } from "react";
import { Link, useNavigate } from "react-router";
import AuthLayout from "../../components/AuthLayout/AuthLayout.jsx";
import Password from "../../components/Password/Password.jsx";
import Captcha from "../../components/Captcha/Captcha.jsx";
import Dropdown from "../../components/Dropdown/Dropdown.jsx";
import DatePicker from "../../components/DatePicker/DatePicker.jsx";
import OtpEmailVerifier from "../../components/OtpEmailVerifier/OtpEmailVerifier.jsx";
import { registerPatient } from "../../api/commonApi.js";
import { SEX_OPTIONS, OTP_PURPOSE } from "../../config/constants.js";
import { notify } from "../../utils/eventBus.js";
import { isPasswordValid } from "../../utils/password.js";
import { isPhone } from "../../utils/validators.js";
import { todayIso } from "../../utils/date.js";
import "./RegisterPage.css";

export default function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    sex: null,
    dateOfBirth: null,
    email: "",
    contactNumber: "",
    password: "",
    confirmPassword: "",
  });
  const [verificationToken, setVerificationToken] = useState(null);
  const [captcha, setCaptcha] = useState({ captchaId: null, captchaText: "" });
  const [captchaKey, setCaptchaKey] = useState(0);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const problems = () => {
    if (form.name.trim().length < 2) return "Please enter your full name";
    if (!form.sex) return "Please select your sex";
    if (!form.dateOfBirth) return "Please select your date of birth";
    if (!verificationToken)
      return "Please verify your email address with the OTP";
    if (!isPhone(form.contactNumber))
      return "Please enter a valid contact number (7-15 digits)";
    if (!isPasswordValid(form.password))
      return "Password does not satisfy all the rules";
    if (form.password !== form.confirmPassword)
      return "Password and confirm password do not match";
    if (!captcha.captchaText) return "Please type the captcha characters";
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    const p = problems();
    if (p) {
      notify.warning(p);
      return;
    }
    try {
      const { message } = await registerPatient({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        contactNumber: form.contactNumber.replace(/[\s-]/g, ""),
        verificationToken,
        ...captcha,
      });
      notify.success(message || "Registration successful. Please login");
      navigate("/login", { replace: true });
    } catch {
      setCaptchaKey((k) => k + 1);
    }
  };

  return (
    <AuthLayout
      title="Create patient account"
      subtitle="Register once to book video consultations for yourself and your family."
    >
      <form className="auth-form" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="reg-name" className="required">
            Full name
          </label>
          <input
            id="reg-name"
            className="input"
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="e.g. Ananya Sen"
            autoComplete="name"
            required
          />
        </div>
        <div className="reg-grid">
          <Dropdown
            label="Sex"
            required
            options={SEX_OPTIONS}
            keyProcessor={(s) => s}
            labelProcessor={(s) => s}
            selected={form.sex}
            onOptionSelected={set("sex")}
            placeholder="Select sex"
            id="reg-sex"
          />
          <DatePicker
            label="Date of birth"
            required
            startDate="1900-01-01"
            endDate={todayIso()}
            value={form.dateOfBirth}
            onDateSelect={set("dateOfBirth")}
            placeholder="Select date of birth"
            id="reg-dob"
          />
        </div>
        <OtpEmailVerifier
          purpose={OTP_PURPOSE.REGISTER}
          email={form.email}
          onEmailChange={set("email")}
          onVerified={setVerificationToken}
        />
        <div className="field">
          <label htmlFor="reg-phone" className="required">
            Contact number
          </label>
          <input
            id="reg-phone"
            className="input"
            type="tel"
            value={form.contactNumber}
            onChange={(e) => set("contactNumber")(e.target.value)}
            placeholder="+91 98xxxxxxxx"
            autoComplete="tel"
            required
          />
        </div>
        <Password
          value={form.password}
          onChange={set("password")}
          required
          id="reg-password"
        />
        <Password
          label="Confirm password"
          placeholder="Re-enter password"
          value={form.confirmPassword}
          onChange={set("confirmPassword")}
          matchWith={form.password}
          required
          id="reg-confirm"
          name="confirmPassword"
        />
        <Captcha onChange={setCaptcha} refreshKey={captchaKey} />
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={!verificationToken}
        >
          Register
        </button>
        {!verificationToken && (
          <p className="hint reg-hint">
            Verify your email with the OTP to enable registration.
          </p>
        )}
        <div className="auth-links">
          <Link to="/login">Already registered? Sign in</Link>
        </div>
      </form>
    </AuthLayout>
  );
}
