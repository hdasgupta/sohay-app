import logo from "../../assets/logo.png";
import env from "../../config/env.js";
import "./Logo.css";

export default function Logo({ size = 44, showName = true, subtitle }) {
  return (
    <div className="logo">
      <img src={logo} alt="WBFMH logo" width={size} height={size} />
      {showName && (
        <div className="logo-text">
          <span className="logo-name">{env.organisationName}</span>
          {subtitle && <span className="logo-sub">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
