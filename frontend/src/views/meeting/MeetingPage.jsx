import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { meetingToken } from '../../api/commonApi.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { notify } from '../../utils/eventBus.js';
import { slotLabel, formatDate } from '../../utils/date.js';
import logger from '../../utils/logger.js';
import './MeetingPage.css';

const scriptPromises = new Map();
/** Load the 8x8 JaaS external API script once */
export function loadJitsiScript(appId) {
  if (window.JitsiMeetExternalAPI) return Promise.resolve(window.JitsiMeetExternalAPI);
  const src = `https://8x8.vc/${appId}/external_api.js`;
  if (!scriptPromises.has(src)) {
    scriptPromises.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => (window.JitsiMeetExternalAPI ? resolve(window.JitsiMeetExternalAPI) : reject(new Error('Jitsi API unavailable')));
      s.onerror = () => { scriptPromises.delete(src); reject(new Error('Could not load the video meeting library')); };
      document.head.appendChild(s);
    }));
  }
  return scriptPromises.get(src);
}

/** In-app video consultation (8x8 JaaS). The doctor's side starts recording automatically. */
export default function MeetingPage() {
  const { appointmentId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [info, setInfo] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | joined | error | ended
  const [recording, setRecording] = useState(false);
  const [errorText, setErrorText] = useState('');
  const backPath = user.role === 'doctor' ? '/doctor/appointments' : '/patient/appointments';

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const { data } = await meetingToken(appointmentId);
        if (disposed) return;
        setInfo(data);
        const JitsiMeetExternalAPI = await loadJitsiScript(data.appId);
        if (disposed || !containerRef.current) return;
        const api = new JitsiMeetExternalAPI(data.domain, {
          roomName: data.roomName,
          jwt: data.jwt,
          parentNode: containerRef.current,
          width: '100%',
          height: '100%',
          userInfo: { displayName: user.name, email: user.email },
          configOverwrite: {
            prejoinConfig: {
              enabled: true
            },
            //disableInitialGUM: true,
            disableDeepLinking: true,
            startWithAudioMuted: false,
            startWithVideoMuted: false
         },
          interfaceConfigOverwrite: { MOBILE_APP_PROMO: false },
        });
        apiRef.current = api;
        api.addListener('videoConferenceJoined', () => {
          logger.info(`Joined meeting for appointment ${appointmentId}`);
          setStatus('joined');
          if (data.autoRecord) {
            logger.info('Doctor joined - starting automatic recording');
            try { api.executeCommand('startRecording', { mode: 'file' }); } catch (e) { logger.error('startRecording failed', e); }
          }
        });
        api.addListener('recordingStatusChanged', (e) => {
          logger.info('Recording status', e);
          setRecording(Boolean(e?.on));
          if (e?.error) notify.warning(`Recording issue: ${e.error}`);
          else if (e?.on && data.autoRecord) notify.info('This consultation is being recorded');
        });
        api.addListener('readyToClose', () => { setStatus('ended'); navigate(backPath); });
      } catch (e) {
        logger.error('Meeting setup failed', e.message);
        if (!disposed) { setStatus('error'); setErrorText(e.message); }
      }
    })();
    return () => {
      disposed = true;
      try { apiRef.current?.dispose(); } catch { /* ignore */ }
      apiRef.current = null;
    };
  }, [appointmentId, user.name, user.email, navigate, backPath]);

  const a = info?.appointment;
  return (
    <div className="meeting">
      <div className="meet-bar card">
        <div>
          <h1 className="meet-title">Video consultation</h1>
          {a && <p className="muted small">{user.role === 'doctor' ? a.patientName : a.doctorName} · {formatDate(a.date)} · {slotLabel(a.date, a.startTime, a.endTime)}</p>}
        </div>
        <div className="row">
          {recording && <span className="meet-rec" aria-live="polite"><span className="meet-rec-dot" /> Recording</span>}
          {user.role === 'doctor' && <button type="button" className="btn btn-accent btn-sm" onClick={() => navigate('/doctor/prescription')}>Write prescription</button>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate(backPath)}>Leave</button>
        </div>
      </div>
      {status === 'error' ? (
        <div className="empty-state meet-error"><strong>Unable to open the consultation room</strong>{errorText}</div>
      ) : (
        <div className="meet-frame" ref={containerRef} data-testid="jitsi-container">
          {status === 'loading' && <p className="meet-wait">Connecting to the secure video room...</p>}
        </div>
      )}
    </div>
  );
}
