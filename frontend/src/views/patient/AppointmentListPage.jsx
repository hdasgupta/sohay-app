import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import Pagination from '../../components/Pagination/Pagination.jsx';
import AppointmentCard from '../../components/AppointmentCard/AppointmentCard.jsx';
import ConfirmDialog from '../../components/ConfirmDialog/ConfirmDialog.jsx';
import { listAppointments, cancelAppointment } from '../../api/patientApi.js';
import { downloadPrescription } from '../../api/commonApi.js';
import { notify } from '../../utils/eventBus.js';
import { saveBlob } from '../../utils/download.js';
import { todayIso, formatDate } from '../../utils/date.js';
import './AppointmentListPage.css';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

export async function downloadPdf(a) {
  try {
    const blob = await downloadPrescription(a.id);
    if (Capacitor.isNativePlatform()) {
     
      const base64Data = blob;
      await Filesystem.writeFile({
        path: `prescription-${a.date}-${a.id}.pdf`,
        data: base64Data,
        directory: Directory.Documents, // 📁 Saves in Documents folder
      });
    
      notify.success('Prescription downloaded');
    } else {
      saveBlob(blob, `prescription-${a.date}-${a.id}.pdf`);
      notify.success('Prescription downloaded');
    }
  } catch { /* shown */ }
}

export default function AppointmentListPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [toCancel, setToCancel] = useState(null);

  const load = useCallback(async () => {
    try { setItems((await listAppointments()).data); } catch { setItems([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const cancel = async (a) => {
    setToCancel(null);
    try {
      const { message, data } = await cancelAppointment(a.id);
      notify.success(message || 'Appointment cancelled');
      setItems((list) => list.map((x) => (x.id === a.id ? { ...x, ...data } : x)));
    } catch { /* shown */ }
  };

  const today = todayIso();
  const actionsFor = (a) => {
    const btns = [];
    if (a.isUpcoming && a.date === today) btns.push(<button key="join" type="button" className="btn btn-accent btn-sm" onClick={() => navigate(`/meeting/${a.id}`)}>Join video call</button>);
    if (a.isUpcoming) btns.push(<button key="cancel" type="button" className="btn btn-danger btn-sm" onClick={() => setToCancel(a)}>Cancel</button>);
    if (a.status === 'completed' && a.hasPrescription) btns.push(<button key="pdf" type="button" className="btn btn-success btn-sm" onClick={() => downloadPdf(a)}>Download prescription</button>);
    return btns.length ? btns : null;
  };

  return (
    <div className="appt-list">
      <div className="page-title">
        <div><h1>My appointments</h1><p>Latest first. Includes appointments you booked for family members.</p></div>
        <button type="button" className="btn btn-primary" onClick={() => navigate('/patient/book')}>+ Book new</button>
      </div>
      {items && (
        <Pagination
          items={items}
          itemProcessor={(a) => <AppointmentCard appointment={a} viewer="patient" actions={actionsFor(a)} />}
          searchText={(a) => `${a.doctorName} ${a.doctorSpeciality} ${a.patientName} ${a.status} ${a.date} ${formatDate(a.date)} ${a.startTime} #${a.id}`}
          searchPlaceholder="Search doctor, patient, status or date"
          emptyMessage="You have no appointments yet"
        />
      )}
      <ConfirmDialog
        open={Boolean(toCancel)}
        title="Cancel appointment?"
        message={toCancel ? `Your appointment with ${toCancel.doctorName} on ${formatDate(toCancel.date)} will be cancelled and the slot released.` : ''}
        confirmText="Cancel appointment"
        cancelText="Keep it"
        onConfirm={() => cancel(toCancel)}
        onCancel={() => setToCancel(null)}
      />
    </div>
  );
}
