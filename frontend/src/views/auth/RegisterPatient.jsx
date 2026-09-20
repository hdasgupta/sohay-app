import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../../api/client";
import { useApp } from "../../context/AppContext";
import PasswordInput from "../../components/PasswordInput";
import Captcha from "../../components/Captcha";
import Datepicker from "../../components/Datepicker";
import Dropdown from "../../components/Dropdown";
import { validPassword } from "../../utils/validation";
import useCountdown from "../../utils/useCountdown";
import "./Auth.css";
export default function RegisterPatient() {
  const [name, setName] = useState("");
  const [sex, setSex] = useState("");
  const [dob, setDob] = useState("");
  const [email, setEmail] = useState("");
  const [contact, setContact] = useState("");
  const [pw, setPw] = useState("");
  const [cpw, setCpw] = useState("");
  const [captcha, setCaptcha] = useState({});
  const [answer, setAnswer] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [expires, setExpires] = useState(0);
  const { notify } = useApp();
  const nav = useNavigate();
  const remain = useCountdown(expires);
  const send = async () => {
    try {
      const r = await api.post("/otp/request", {
        email,
        purpose: "register",
        captchaId: captcha.id,
        captchaAnswer: answer,
      });
      setExpires(r.data.expiresAt);
      notify("success", r.data.message);
    } catch (e) {
      notify("error", getErrorMessage(e));
    }
  };
  const verify = async () => {
    try {
      const r = await api.post("/otp/verify", {
        email,
        purpose: "register",
        otp,
      });
      setToken(r.data.otpVerificationToken);
      notify("success", r.data.message);
    } catch (e) {
      notify("error", getErrorMessage(e));
    }
  };
  const submit = async (e) => {
    e.preventDefault();
    if (!validPassword(pw) || pw !== cpw || !token || remain <= 0)
      return notify(
        "warning",
        "Complete password rules and valid OTP verification first.",
      );
    try {
      await api.post("/auth/patient/register", {
        name,
        sex,
        dateOfBirth: dob,
        email,
        contactNumber: contact,
        password: pw,
        confirmPassword: cpw,
        captchaId: captcha.id,
        captchaAnswer: answer,
        otpVerificationToken: token,
      });
      notify("success", "Registration completed.");
      nav("/login");
    } catch (e) {
      notify("error", getErrorMessage(e));
    }
  };
  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand">
          <img src="/logo.svg" alt="logo" />
          <div>
            <h1>Register Patient</h1>
            <div className="muted">Email verification by one-time password</div>
          </div>
        </div>
        <div className="form-grid">
          <div className="field">
            <label>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Sex</label>
            <Dropdown
              options={["male", "female", "other", "prefer_not_to_say"]}
              value={sex}
              onOptionSelected={setSex}
              placeholder="Select sex"
              labelProcessor={(x) => x.replaceAll("_", " ")}
            />
          </div>
          <div className="field">
            <label>Date of birth</label>
            <Datepicker
              value={dob}
              startDate="1900-01-01"
              endDate={new Date().toISOString().slice(0, 10)}
              onDateSelect={setDob}
            />
          </div>
          <div className="field">
            <label>Contact number</label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>OTP</label>
            <div className="otp-row">
              <input
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength={6}
              />
              <button type="button" className="btn secondary" onClick={send}>
                Send
              </button>
              <button type="button" className="btn secondary" onClick={verify}>
                Verify
              </button>
            </div>
          </div>
        </div>
        {expires > 0 && (
          <div className="otp-timer">OTP remaining: {remain} seconds</div>
        )}
        <div className="form-grid">
          <div className="field">
            <label>Password</label>
            <PasswordInput value={pw} onChange={setPw} />
          </div>
          <div className="field">
            <label>Confirm password</label>
            <PasswordInput value={cpw} onChange={setCpw} />
          </div>
        </div>
        <Captcha onReady={setCaptcha} />
        <div className="field">
          <label>Captcha</label>
          <input
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            maxLength={6}
            required
          />
        </div>
        <button className="btn" type="submit">
          Register patient
        </button>
        <div className="auth-links">
          <Link to="/login">Back to login</Link>
        </div>
      </form>
    </div>
  );
}
