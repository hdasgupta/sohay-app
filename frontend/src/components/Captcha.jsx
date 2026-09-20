import { useEffect, useState } from "react";
import { api, getErrorMessage } from "../api/client";
import "./Captcha.css";
export default function Captcha({ onReady, onError }) {
  const [data, setData] = useState(null);
  const load = async () => {
    try {
      const r = await api.get("/captcha");
      alert(JSON.stringify(r));
      setData(r.data);
      onReady?.(r.data);
    } catch (e) {
      alert(e.message);
      console.error("[CAPTCHA]", e);
      onError?.(getErrorMessage(e));
    }
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <div className="captcha">
      <img src={data?.image} alt="captcha" />
      <button type="button" onClick={load}>
        ↻ New captcha
      </button>
    </div>
  );
}
