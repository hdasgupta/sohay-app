import { useCallback, useEffect, useState } from 'react';
import { authApi } from '../../api/authApi';
import './Captcha.css';

/**
 * Captcha component. The backend returns an SVG whose characters are vector
 * paths (never selectable text) plus a signed token that carries the answer,
 * so no bot can read the code from the DOM.
 * onChange({ token, answer }) is called whenever either value changes.
 */
const Captcha = ({ onChange, label = 'Captcha verification', required = true }) => {
  const [svg, setSvg] = useState('');
  const [token, setToken] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authApi.captcha();
      setSvg(data.svg);
      setToken(data.token);
      setAnswer('');
      onChange?.({ token: data.token, answer: '' });
      console.log('[Captcha] new challenge loaded');
    } catch (error) {
      console.error('[Captcha] could not load challenge', error);
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAnswer = (value) => {
    setAnswer(value);
    onChange?.({ token, answer: value });
  };

  return (
    <div className="field captcha-field">
      <label htmlFor="captcha-answer">
        {label}
        {required ? <span className="req"> *</span> : null}
      </label>
      <div className="captcha-row">
        <div
          className={`captcha-image ${loading ? 'loading' : ''}`}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: svg }}
          aria-label="Captcha image"
          role="img"
        />
        <button type="button" className="btn btn-ghost btn-sm captcha-refresh" onClick={refresh} title="New captcha">
          ⟳
        </button>
      </div>
      <input
        id="captcha-answer"
        name="captcha"
        type="text"
        autoComplete="off"
        placeholder="Type the characters you see"
        value={answer}
        onChange={(event) => handleAnswer(event.target.value)}
        required={required}
      />
    </div>
  );
};

export default Captcha;
