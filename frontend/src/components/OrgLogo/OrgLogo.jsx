import './OrgLogo.css';

/**
 * Organisation logo drawn as inline SVG so it never depends on a public asset
 * path. `size` is any CSS length, `className` lets the caller position it.
 */
const OrgLogo = ({ size = 44, className = '', title = 'Organisation logo' }) => (
  <span className={`org-logo ${className}`.trim()} style={{ width: size, height: size }}>
    <svg viewBox="0 0 120 120" role="img" aria-label={title} focusable="false">
      <defs>
        <linearGradient id="orgLogoGradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1b73e8" />
          <stop offset="1" stopColor="#0b2a54" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="55" fill="url(#orgLogoGradient)" stroke="#7fd3ff" strokeWidth="4" />
      <circle cx="60" cy="48" r="20" fill="none" stroke="#eaf4ff" strokeWidth="5" />
      <path
        d="M28 96c6-18 18-26 32-26s26 8 32 26"
        fill="none"
        stroke="#7fd3ff"
        strokeWidth="6"
        strokeLinecap="round"
      />
      <path d="M52 44c4-8 12-8 16 0" fill="none" stroke="#7fd3ff" strokeWidth="4" strokeLinecap="round" />
    </svg>
  </span>
);

export default OrgLogo;
