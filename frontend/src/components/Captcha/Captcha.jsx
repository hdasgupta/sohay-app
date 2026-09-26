import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getCaptcha } from "../../api/commonApi.js";
import logger from "../../utils/logger.js";
import "./Captcha.css";

/**
 * Server generated distorted captcha. The answer never reaches the browser - only an image.
 * The image is painted onto a canvas (not an <img> with a reusable URL).
 * @param onChange   ({ captchaId, captchaText }) => void
 * @param refreshKey change this value to force a new captcha (e.g. after a failed submit)
 */
export default function Captcha({
  onChange,
  refreshKey = 0,
  label = "Captcha",
}) {
  const autoId = useId();
  const canvasRef = useRef(null);
  const [captchaId, setCaptchaId] = useState(null);
  const [text, setText] = useState("");
  const [failed, setFailed] = useState(false);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const load = useCallback(async () => {
    try {
      setFailed(false);
      const { data } = await getCaptcha();
      setCaptchaId(data.captchaId);
      setText("");
      onChangeRef.current?.({ captchaId: data.captchaId, captchaText: "" });
      const img = new Image();
      img.onload = () => {
        const c = canvasRef.current;
        if (!c) return;
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d");
        ctx?.clearRect(0, 0, c.width, c.height);
        ctx?.drawImage(img, 0, 0);
      };
      img.src = data.image;
    } catch (e) {
      logger.error("Captcha load failed", e.message);
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const update = (v) => {
    const t = v.replace(/\s/g, "").slice(0, 8);
    setText(t);
    onChangeRef.current?.({ captchaId, captchaText: t });
  };

  return (
    <div className="field captcha">
      <label htmlFor={`cap-${autoId}`} className="required">
        {label}
      </label>
      <div className="cap-row">
        <div className="cap-image" aria-label="Captcha image" role="img">
          <canvas
            ref={canvasRef}
            width="220"
            height="70"
            data-captcha-id={captchaId || ""}
          />
          {failed && <span className="cap-failed">Could not load</span>}
        </div>
        <button
          type="button"
          className="icon-btn cap-refresh"
          onClick={load}
          aria-label="Load a new captcha"
          title="New captcha"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>
      <input
        id={`cap-${autoId}`}
        className="input cap-input"
        value={text}
        onChange={(e) => update(e.target.value)}
        placeholder="Type the characters shown above"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck="false"
        required
      />
      <span className="hint">
        Letters are not case sensitive. Click refresh if it is hard to read.
      </span>
    </div>
  );
}
