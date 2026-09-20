import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, getErrorMessage } from "../../api/client";
import { useApp } from "../../context/AppContext";
import PasswordInput from "../../components/PasswordInput";
import Captcha from "../../components/Captcha";
import "./Auth.css";
export default function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [captcha, setCaptcha] = useState({});
  const [answer, setAnswer] = useState("");
  const { login, notify } = useApp();
  const nav = useNavigate();
  const submit = async (e) => {
    e.preventDefault();
    try {
      const r = await api.post("/login", {
        email,
        password: pw,
        captchaId: captcha.id,
        captchaAnswer: answer,
      });
      login(r.data);
      notify("success", "Login successful.");
      nav(`/${r.data.user.role}`);
    } catch (err) {
      console.error("[LOGIN]", err);
      notify("error", getErrorMessage(err));
    }
  };
  return (
    <div className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand">
          <img src="/logo.svg" alt="logo" />
          <div>
            <h1>Appointment Booking</h1>
            <div className="muted">West Bengal Forum for Mental Health</div>
          </div>
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
          <label>Password</label>
          <PasswordInput value={pw} onChange={setPw} />
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
          Login
        </button>
        <div className="auth-links">
          <Link to="/register">Register patient</Link>
          <Link to="/reset-password">Reset password</Link>
        </div>
      </form>
    </div>
  );
}
