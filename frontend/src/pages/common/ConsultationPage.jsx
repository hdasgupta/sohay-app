import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { sharedApi } from '../../api/sharedApi';
import { useMessage } from '../../context/MessageContext';
import { formatSlot } from '../../utils/slotUtils';
import { prettyDate } from '../../utils/dateUtils';
import Loader from '../../components/Loader/Loader';
import './ConsultationPage.css';

const loadExternalApi = (domain) =>
  new Promise((resolve, reject) => {
    if (window.JitsiMeetExternalAPI) {
      resolve(window.JitsiMeetExternalAPI);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://${domain}/external_api.js`;
    script.async = true;
    script.onload = () => resolve(window.JitsiMeetExternalAPI);
    script.onerror = () => reject(new Error('Could not load the video conference library'));
    document.body.appendChild(script);
  });

/**
 * In app video consultation. The doctor joins as moderator and the recording is
 * started programmatically, so the session is captured and later pushed to the
 * configured Google Drive account by the backend webhook.
 */
const ConsultationPage = () => {
  const { appointmentId } = useParams();
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [context, setContext] = useState(null);
  const [starting, setStarting] = useState(true);
  const [failure, setFailure] = useState(null);
  const messenger = useMessage();

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        const data = await sharedApi.consultation(appointmentId);
        if (cancelled) return;
        setContext(data);

        /**
         * 8x8.vc refuses a tokenless join with "Sorry, you are not allowed to
         * join this call", so say that plainly instead of letting the iframe
         * show it.
         */
        if (data.jaas && !data.jwt) {
          const text =
            'The video room could not be authorised. The 8x8.vc (JaaS) credentials on the server are incomplete.';
          console.error('[consultation]', text);
          setFailure(text);
          setStarting(false);
          messenger.error(text);
          return;
        }
        if (data.notice) {
          console.warn('[consultation]', data.notice);
          messenger.warning(data.notice);
        }

        const JitsiMeetExternalAPI = await loadExternalApi(data.domain);
        if (cancelled || !containerRef.current) return;

        const api = new JitsiMeetExternalAPI(data.domain, {
          roomName: data.roomName,
          jwt: data.jwt || undefined,
          parentNode: containerRef.current,
          userInfo: { displayName: data.displayName, email: data.email },
          configOverwrite: {
            prejoinPageEnabled: false,
            startWithAudioMuted: false,
            disableDeepLinking: true,
          },
          interfaceConfigOverwrite: { MOBILE_APP_PROMO: false },
        });
        apiRef.current = api;

        api.addListener('videoConferenceJoined', () => {
          console.log('[consultation] joined room', data.roomName);
          setStarting(false);
          if (data.autoRecord) {
            try {
              api.executeCommand('startRecording', { mode: 'file' });
              console.log('[consultation] recording requested for the doctor session');
              messenger.info('This consultation is being recorded for the clinical record');
            } catch (error) {
              console.error('[consultation] could not start recording', error);
            }
          }
        });

        api.addListener('recordingStatusChanged', (event) => {
          console.log('[consultation] recording status', event);
          if (event?.error) {
            messenger.warning(`Recording could not start: ${event.error}`);
          }
        });

        api.addListener('errorOccurred', (event) => {
          console.error('[consultation] conference error', event);
          const reason = event?.error?.message || event?.error?.name || 'unknown error';
          setFailure(`The video room rejected the connection (${reason}).`);
          setStarting(false);
        });

        api.addListener('readyToClose', () => {
          console.log('[consultation] call finished');
          window.history.back();
        });
      } catch (error) {
        console.error('[consultation] could not start', error.message);
        setFailure(error.message || 'The consultation room could not be opened.');
        setStarting(false);
      }
    };

    boot();
    return () => {
      cancelled = true;
      apiRef.current?.dispose?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  return (
    <section className="page consultation-page">
      <div className="page-head">
        <div>
          <div className="page-title">Video consultation</div>
          <div className="page-subtitle">
            {context
              ? `Dr. ${context.doctorName} with ${context.patientName} · ${prettyDate(context.date)} · ${formatSlot(
                  context.startTime,
                  context.endTime,
                )}`
              : 'Preparing the secure meeting room...'}
          </div>
        </div>
        <div className="row">
          {context && !context.jaas ? <span className="chip warning">Public Jitsi room</span> : null}
          {context?.autoRecord ? <span className="chip danger">Recording enabled</span> : null}
        </div>
      </div>

      <div className="meet-shell surface">
        <div ref={containerRef} className="meet-frame" />
        {starting ? <Loader inline message="Connecting you to the consultation room..." /> : null}
        {failure ? (
          <div className="meet-failure">
            <div className="meet-failure-title">Could not join the consultation</div>
            <p>{failure}</p>
            <p className="meet-failure-hint">
              An administrator has to set JAAS_APP_ID, JAAS_API_KEY and the JaaS private key in the backend
              environment, or clear JAAS_APP_ID to use the public Jitsi deployment instead.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default ConsultationPage;
