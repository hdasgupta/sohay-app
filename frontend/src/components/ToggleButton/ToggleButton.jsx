import "./ToggleButton.css";

/** Pill toggle button (aria-pressed) */
export default function ToggleButton({
  label,
  pressed,
  onToggle,
  icon,
  tone = "primary",
}) {
  return (
    <button
      type="button"
      className={`toggle-btn tone-${tone} ${pressed ? "tb-on" : ""}`}
      aria-pressed={pressed}
      onClick={() => onToggle(!pressed)}
    >
      {icon && (
        <span className="tb-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span>{label}</span>
      <span className="tb-dot" aria-hidden="true" />
    </button>
  );
}
