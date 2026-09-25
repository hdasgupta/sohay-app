import Logo from '../Logo/Logo.jsx';
import ThemeToggle from '../ThemeToggle/ThemeToggle.jsx';
import './AuthLayout.css';

const POINTS = [
  { t: 'Video consultations', d: 'Meet our psychiatrists and counsellors securely from home.' },
  { t: 'Book in seconds', d: 'Pick a doctor, a date and a free 30 minute slot.' },
  { t: 'Digital prescriptions', d: 'Download signed prescriptions right after your visit.' },
  { t: 'Care for your family', d: 'Create a family and book for your loved ones.' },
];

/** Split screen layout for login / register / reset password */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="auth-layout">
      <aside className="auth-hero">
        <Logo size={64} subtitle="Sohay online application" />
        <h2 className="auth-hero-title">Your mental health matters.<br /><span>We are here to listen.</span></h2>
        <ul className="auth-points">
          {POINTS.map((p) => (
            <li key={p.t}><span className="auth-tick" aria-hidden="true">✓</span><div><strong>{p.t}</strong><p>{p.d}</p></div></li>
          ))}
        </ul>
        <div className="auth-orb auth-orb-1" aria-hidden="true" />
        <div className="auth-orb auth-orb-2" aria-hidden="true" />
      </aside>
      <section className="auth-panel">
        <div className="auth-toolbar"><ThemeToggle /></div>
        <div className="auth-card">
          <h1>{title}</h1>
          {subtitle && <p className="muted auth-subtitle">{subtitle}</p>}
          {children}
        </div>
      </section>
    </div>
  );
}
