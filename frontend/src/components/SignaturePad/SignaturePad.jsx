import { useEffect, useRef, useState } from 'react';
import { notify } from '../../utils/eventBus.js';
import './SignaturePad.css';

const MAX_BYTES = 450 * 1024;

/**
 * Draw (mouse / touch / pen) or upload a signature. Produces a PNG data URL (transparent background).
 * @param onChange (dataUrl | null) => void
 */
export default function SignaturePad({ value = null, onChange, height = 160 }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [dirty, setDirty] = useState(false);

  const ctx = () => canvasRef.current?.getContext('2d');

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.clientWidth * ratio || 600;
    c.height = height * ratio;
    const g = ctx();
    if (!g) return;
    g.scale(ratio, ratio);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = 2.4;
    g.strokeStyle = '#0b2a6b';
  }, [height]);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e) => {
    drawing.current = true;
    last.current = pos(e);
    canvasRef.current.setPointerCapture?.(e.pointerId);
  };
  const move = (e) => {
    if (!drawing.current) return;
    const p = pos(e);
    const g = ctx();
    if (!g) return;
    g.beginPath();
    g.moveTo(last.current.x, last.current.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    last.current = p;
    setDirty(true);
  };
  const up = () => { drawing.current = false; };

  const clear = () => {
    const c = canvasRef.current;
    ctx()?.clearRect(0, 0, c.width, c.height);
    setDirty(false);
    onChange?.(null);
  };

  const applyDrawing = () => {
    const data = canvasRef.current.toDataURL('image/png');
    if (data.length > MAX_BYTES * 1.37) { notify.warning('Signature is too large, please clear and draw again'); return; }
    onChange?.(data);
    notify.info('Signature captured');
  };

  const upload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { notify.warning('Please choose a PNG or JPEG image'); return; }
    if (file.size > MAX_BYTES) { notify.warning('Signature image must be smaller than 450 KB'); return; }
    const reader = new FileReader();
    reader.onload = () => onChange?.(String(reader.result));
    reader.readAsDataURL(file);
  };

  return (
    <div className="signature-pad">
      {value && (
        <div className="sp-preview">
          <span className="field-label">Current signature</span>
          <img src={value} alt="Signature preview" />
        </div>
      )}
      <div className="sp-canvas-wrap">
        <canvas
          ref={canvasRef}
          style={{ height }}
          className="sp-canvas"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          aria-label="Signature drawing area"
        />
        {!dirty && <span className="sp-hint">Sign here</span>}
      </div>
      <div className="row">
        <button type="button" className="btn btn-primary btn-sm" onClick={applyDrawing} disabled={!dirty}>Use drawn signature</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={clear}>Clear</button>
        <label className="btn btn-ghost btn-sm sp-upload">
          Upload image
          <input type="file" accept="image/png,image/jpeg" onChange={upload} hidden />
        </label>
      </div>
    </div>
  );
}
