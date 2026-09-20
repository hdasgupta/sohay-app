import { useTheme } from '../../context/ThemeContext';
import './ThemeToggle.css';

const ThemeToggle = ({ compact = false }) => {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle ${compact ? 'compact' : ''}`}
      onClick={toggleTheme}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      aria-label="Toggle colour theme"
    >
      <span className="knob">{dark ? '🌙' : '☀'}</span>
      {compact ? null : <span className="theme-label">{dark ? 'Dark' : 'Light'}</span>}
    </button>
  );
};

export default ThemeToggle;
